/**
 * Nightcord Duel Network — PvP WebSocket 中继服务器
 * 
 * 职责：
 *   1. 房间管理（创建/加入，4位房间码）
 *   2. 消息中继（动作指令、状态同步、游戏结束）
 *   3. 连接管理（断开检测、对方通知）
 * 
 * 协议（CLIENT → SERVER）：
 *   { type: "create-room", name: "玩家名" }
 *   { type: "join-room", code: "ABCD", name: "玩家名" }
 *   { type: "relay", data: { ... } }
 * 
 * 协议（SERVER → CLIENT）：
 *   { type: "room-created", code: "ABCD", hostName: "..." }
 *   { type: "room-joined", players: [{ name: "..." }, { name: "..." }] }
 *   { type: "relay", data: { ... } }
 *   { type: "opponent-disconnected" }
 *   { type: "error", message: "..." }
 */

import { WebSocketServer } from "ws";

const PORT = Number(process.env.PVP_PORT || 3001);
const HOST = process.env.PVP_HOST || "0.0.0.0";

const rooms = new Map();

function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    do {
        code = "";
        for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    } while (rooms.has(code));
    return code;
}

function send(ws, data) {
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

const wss = new WebSocketServer({ host: HOST, port: PORT });

wss.on("listening", () => {
    console.log(`PvP 中继服务器已启动: ws://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}`);
    console.log("等待玩家连接...");
});

wss.on("connection", (ws) => {
    let playerRoom = null;
    let playerRole = null; // "host" | "guest"

    ws.on("message", (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        switch (msg.type) {
            case "create-room": {
                const code = generateCode();
                playerRoom = code;
                playerRole = "host";
                rooms.set(code, {
                    host: ws,
                    guest: null,
                    hostName: msg.name || "玩家A",
                    guestName: null,
                    createdAt: Date.now(),
                });
                send(ws, { type: "room-created", code, hostName: rooms.get(code).hostName });
                console.log(`房间 ${code} 已创建，房主: ${rooms.get(code).hostName}`);
                break;
            }

            case "join-room": {
                const code = (msg.code || "").toUpperCase();
                const room = rooms.get(code);
                if (!room) {
                    send(ws, { type: "error", message: "房间不存在或已过期" });
                    return;
                }
                if (room.guest) {
                    send(ws, { type: "error", message: "房间已满" });
                    return;
                }
                playerRoom = code;
                playerRole = "guest";
                room.guest = ws;
                room.guestName = msg.name || "玩家B";

                send(room.host, { type: "room-joined", players: [{ name: room.hostName, role: "host" }, { name: room.guestName, role: "guest" }] });
                send(ws, { type: "room-joined", players: [{ name: room.hostName, role: "host" }, { name: room.guestName, role: "guest" }] });
                console.log(`房间 ${code}: ${room.guestName} 加入`);
                break;
            }

            case "relay": {
                if (!playerRoom) return;
                const room = rooms.get(playerRoom);
                if (!room) return;

                const target = playerRole === "host" ? room.guest : room.host;
                if (target?.readyState === 1) {
                    send(target, { type: "relay", data: msg.data });
                }
                break;
            }

            default:
                break;
        }
    });

    ws.on("close", () => {
        if (!playerRoom) return;
        const room = rooms.get(playerRoom);
        if (!room) return;

        const opponent = playerRole === "host" ? room.guest : room.host;
        if (opponent?.readyState === 1) {
            send(opponent, { type: "opponent-disconnected" });
        }

        rooms.delete(playerRoom);
        console.log(`房间 ${playerRoom} 已关闭`);
    });

    ws.on("error", () => {});
});

process.on("SIGINT", () => { wss.close(); process.exit(0); });
process.on("SIGTERM", () => { wss.close(); process.exit(0); });
