/**
 * PvP WebSocket 中继服务器
 * 端口: 8079
 * 功能: 房间管理、玩家匹配、卡组同步、随机种子分发、操作中继
 */
import { WebSocketServer } from "ws";
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PVP_PORT || 8079);
const rooms = new Map(); // roomId -> { players: [ws, ws], decks: [null, null], turn, seed, ... }
let nextRoomId = 1;

function generateSeed() {
    return crypto.randomBytes(16).toString("hex");
}

function send(ws, data) {
    if (ws?.readyState === 1) ws.send(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Nightcord PvP Server Running");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.roomId = null;
    ws.playerIndex = -1;
    ws.playerName = "Player";

    ws.on("pong", () => { ws.isAlive = true; });

    ws.on("message", (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        switch (msg.type) {
            case "create_room": {
                const roomId = String(nextRoomId++);
                rooms.set(roomId, {
                    players: [ws, null],
                    decks: [null, null],
                    turn: 0,
                    seed: generateSeed(),
                    ready: new Set(),
                });
                ws.roomId = roomId;
                ws.playerIndex = 0;
                ws.playerName = msg.name || "Player 1";
                send(ws, { type: "room_created", roomId });
                console.log(`Room ${roomId} created by ${ws.playerName}`);
                break;
            }

            case "join_room": {
                const room = rooms.get(msg.roomId);
                if (!room) { send(ws, { type: "error", reason: "房间不存在" }); break; }
                if (room.players[1]) { send(ws, { type: "error", reason: "房间已满" }); break; }
                room.players[1] = ws;
                ws.roomId = msg.roomId;
                ws.playerIndex = 1;
                ws.playerName = msg.name || "Player 2";
                send(room.players[0], { type: "opponent_joined", name: ws.playerName });
                send(ws, { type: "room_joined", roomId: msg.roomId, opponent: room.players[0].playerName });
                console.log(`${ws.playerName} joined room ${msg.roomId}`);
                break;
            }

            case "set_deck": {
                const room = rooms.get(ws.roomId);
                if (!room) break;
                // 存储卡组数据（卡牌ID列表）
                room.decks[ws.playerIndex] = msg.deck || [];
                room.ready.add(ws.playerIndex);
                // 双方都准备好后，分发游戏开始信息
                if (room.ready.size === 2) {
                    const firstPlayer = Math.random() < 0.5 ? 0 : 1;
                    room.turn = firstPlayer;
                    room.players.forEach((p, i) => {
                        if (p) send(p, {
                            type: "game_start",
                            yourIndex: i,
                            firstPlayer,
                            seed: room.seed,
                            opponentName: room.players[1 - i].playerName,
                            opponentDeck: room.decks[1 - i], // 对手的卡组ID列表
                        });
                    });
                    console.log(`Room ${ws.roomId}: game started, first=${firstPlayer}, seed=${room.seed.slice(0, 8)}...`);
                }
                break;
            }

            case "game_action": {
                const room = rooms.get(ws.roomId);
                if (!room) break;
                const opponent = room.players[1 - ws.playerIndex];
                send(opponent, { type: "game_action", action: msg.action, playerIndex: ws.playerIndex });
                break;
            }

            case "end_turn": {
                const room = rooms.get(ws.roomId);
                if (!room) break;
                room.turn = 1 - ws.playerIndex;
                send(room.players[room.turn], { type: "your_turn", turn: room.turn });
                break;
            }

            case "game_over": {
                const room = rooms.get(ws.roomId);
                if (!room) break;
                room.players.forEach(p => send(p, { type: "game_over", winner: msg.winner, reason: msg.reason }));
                break;
            }

            case "chat": {
                const room = rooms.get(ws.roomId);
                if (!room) break;
                const opponent = room.players[1 - ws.playerIndex];
                send(opponent, { type: "chat", name: ws.playerName, message: msg.message });
                break;
            }
        }
    });

    ws.on("close", () => {
        if (!ws.roomId) return;
        const room = rooms.get(ws.roomId);
        if (!room) return;
        const opponent = room.players.find(p => p && p !== ws);
        send(opponent, { type: "opponent_disconnected" });
        rooms.delete(ws.roomId);
        console.log(`Room ${ws.roomId} closed`);
    });

    ws.on("error", () => {});
});

// 心跳检测
setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Nightcord PvP Server: ws://localhost:${PORT}`);
});
