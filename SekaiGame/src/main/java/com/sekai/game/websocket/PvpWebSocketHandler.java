package com.sekai.game.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class PvpWebSocketHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(PvpWebSocketHandler.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecureRandom secureRandom = new SecureRandom();

    // Room management
    private final Map<String, PvpRoom> rooms = new ConcurrentHashMap<>();
    private final AtomicInteger nextRoomId = new AtomicInteger(1);

    // Session to room mapping
    private final Map<String, PvpPlayer> sessionPlayers = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String sessionId = session.getId();
        logger.info("PvP connection established: {}", sessionId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        PvpPlayer player = sessionPlayers.remove(sessionId);
        if (player != null && player.roomId != null) {
            PvpRoom room = rooms.get(player.roomId);
            if (room != null) {
                // Notify opponent
                WebSocketSession opponent = room.getOpponent(session);
                if (opponent != null && opponent.isOpen()) {
                    sendJson(opponent, Map.of("type", "opponent_disconnected"));
                }
                rooms.remove(player.roomId);
                logger.info("Room {} closed", player.roomId);
            }
        }
        logger.info("PvP connection closed: {}", sessionId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode msg = objectMapper.readTree(message.getPayload());
            String type = msg.has("type") ? msg.get("type").asText() : "";

            switch (type) {
                case "create_room" -> handleCreateRoom(session, msg);
                case "join_room" -> handleJoinRoom(session, msg);
                case "set_deck" -> handleSetDeck(session, msg);
                case "game_action" -> handleGameAction(session, msg);
                case "end_turn" -> handleEndTurn(session, msg);
                case "game_over" -> handleGameOver(session, msg);
                case "chat" -> handleChat(session, msg);
                case "ping" -> sendJson(session, Map.of("type", "pong", "at", msg.path("at").asLong(0)));
                default -> logger.warn("Unknown message type: {}", type);
            }
        } catch (Exception e) {
            logger.error("Error handling message", e);
        }
    }

    private void handleCreateRoom(WebSocketSession session, JsonNode msg) throws IOException {
        String roomId = String.valueOf(nextRoomId.getAndIncrement());
        String playerName = msg.has("name") ? msg.get("name").asText() : "Player 1";

        PvpRoom room = new PvpRoom();
        room.host = session;
        room.hostName = playerName;
        room.seed = generateSeed();
        rooms.put(roomId, room);

        PvpPlayer player = new PvpPlayer();
        player.session = session;
        player.roomId = roomId;
        player.playerIndex = 0;
        player.playerName = playerName;
        sessionPlayers.put(session.getId(), player);

        sendJson(session, Map.of("type", "room_created", "roomId", roomId));
        logger.info("Room {} created by {}", roomId, playerName);
    }

    private void handleJoinRoom(WebSocketSession session, JsonNode msg) throws IOException {
        String roomId = msg.has("roomId") ? msg.get("roomId").asText() : "";
        PvpRoom room = rooms.get(roomId);

        if (room == null) {
            sendJson(session, Map.of("type", "error", "reason", "房间不存在"));
            return;
        }
        if (room.guest != null) {
            sendJson(session, Map.of("type", "error", "reason", "房间已满"));
            return;
        }

        String playerName = msg.has("name") ? msg.get("name").asText() : "Player 2";
        room.guest = session;
        room.guestName = playerName;

        PvpPlayer player = new PvpPlayer();
        player.session = session;
        player.roomId = roomId;
        player.playerIndex = 1;
        player.playerName = playerName;
        sessionPlayers.put(session.getId(), player);

        // Notify host
        sendJson(room.host, Map.of("type", "opponent_joined", "name", playerName));
        // Notify guest
        sendJson(session, Map.of("type", "room_joined", "roomId", roomId, "opponent", room.hostName));

        logger.info("{} joined room {}", playerName, roomId);
    }

    private void handleSetDeck(WebSocketSession session, JsonNode msg) throws IOException {
        PvpPlayer player = sessionPlayers.get(session.getId());
        if (player == null) return;

        PvpRoom room = rooms.get(player.roomId);
        if (room == null) return;

        JsonNode deck = msg.has("deck") ? msg.get("deck") : objectMapper.createArrayNode();
        if (room.gameStarted || !deck.isArray() || deck.isEmpty()) {
            sendJson(session, Map.of("type", "error", "reason", "Invalid deck submission"));
            return;
        }
        if (player.playerIndex == 0) {
            room.hostDeck = deck;
            room.ready.add(0);
        } else {
            room.guestDeck = deck;
            room.ready.add(1);
        }

        // Check if both players are ready
        if (room.ready.size() == 2) {
            room.hostDeck = shuffleDeck(room.hostDeck);
            room.guestDeck = shuffleDeck(room.guestDeck);
            room.gameStarted = true;
            int firstPlayer = secureRandom.nextInt(2);
            room.turn = firstPlayer;

            // Send game_start to both players
            ObjectNode hostMsg = objectMapper.createObjectNode();
            hostMsg.put("type", "game_start");
            hostMsg.put("yourIndex", 0);
            hostMsg.put("firstPlayer", firstPlayer);
            hostMsg.put("seed", room.seed);
            hostMsg.set("deck", room.hostDeck);
            hostMsg.put("opponentName", room.guestName);
            hostMsg.set("opponentDeck", room.guestDeck);
            sendJson(room.host, hostMsg);

            ObjectNode guestMsg = objectMapper.createObjectNode();
            guestMsg.put("type", "game_start");
            guestMsg.put("yourIndex", 1);
            guestMsg.put("firstPlayer", firstPlayer);
            guestMsg.put("seed", room.seed);
            guestMsg.set("deck", room.guestDeck);
            guestMsg.put("opponentName", room.hostName);
            guestMsg.set("opponentDeck", room.hostDeck);
            sendJson(room.guest, guestMsg);

            logger.info("Room {}: game started, first={}, seed={}", player.roomId, firstPlayer, room.seed.substring(0, 8));
        }
    }

    private void handleGameAction(WebSocketSession session, JsonNode msg) throws IOException {
        PvpPlayer player = sessionPlayers.get(session.getId());
        if (player == null) return;

        PvpRoom room = rooms.get(player.roomId);
        if (room == null || !room.gameStarted) return;
        if (room.turn != player.playerIndex) {
            sendJson(session, Map.of("type", "turn_changed", "turn", room.turn));
            return;
        }

        JsonNode action = msg.get("action");
        if (action == null || !action.isObject()) return;
        String actionType = action.path("type").asText("");
        if (Set.of("selectTribute", "confirmTribute", "cancelTribute").contains(actionType)) {
            logger.warn("Ignored intermediate PvP action {} from room {}", actionType, player.roomId);
            return;
        }

        WebSocketSession opponent = room.getOpponent(session);
        if (opponent != null && opponent.isOpen()) {
            ObjectNode forwardMsg = objectMapper.createObjectNode();
            forwardMsg.put("type", "game_action");
            forwardMsg.set("action", action);
            forwardMsg.put("playerIndex", player.playerIndex);
            sendJson(opponent, forwardMsg);
        }
    }

    private void handleEndTurn(WebSocketSession session, JsonNode msg) throws IOException {
        PvpPlayer player = sessionPlayers.get(session.getId());
        if (player == null) return;

        PvpRoom room = rooms.get(player.roomId);
        if (room == null || !room.gameStarted) return;
        synchronized (room) {
            String requestId = msg.path("requestId").asText("");
            if (room.turn != player.playerIndex) {
                ObjectNode ack = objectMapper.createObjectNode();
                ack.put("type", "turn_changed");
                ack.put("turn", room.turn);
                if (!requestId.isEmpty()) ack.put("requestId", requestId);
                sendJson(session, ack);
                return;
            }

            JsonNode state = msg.get("state");
            WebSocketSession opponent = room.getOpponent(session);
            if (state != null && state.isObject() && opponent != null && opponent.isOpen()) {
            ObjectNode syncAction = objectMapper.createObjectNode();
            syncAction.put("type", "syncState");
            syncAction.set("state", state);
            ObjectNode forwardMsg = objectMapper.createObjectNode();
            forwardMsg.put("type", "game_action");
            forwardMsg.set("action", syncAction);
            forwardMsg.put("playerIndex", player.playerIndex);
            sendJson(opponent, forwardMsg);
            }

            room.turn = 1 - player.playerIndex;
            ObjectNode turnMessage = objectMapper.createObjectNode();
            turnMessage.put("type", "turn_changed");
            turnMessage.put("turn", room.turn);
            if (!requestId.isEmpty()) turnMessage.put("requestId", requestId);
            sendJson(room.host, turnMessage);
            sendJson(room.guest, turnMessage);
            logger.info("Room {} turn changed to {} ({})", player.roomId, room.turn, requestId);
        }
    }

    private void handleGameOver(WebSocketSession session, JsonNode msg) throws IOException {
        PvpPlayer player = sessionPlayers.get(session.getId());
        if (player == null) return;

        PvpRoom room = rooms.get(player.roomId);
        if (room == null) return;

        // Broadcast to both players
        ObjectNode gameOverMsg = objectMapper.createObjectNode();
        gameOverMsg.put("type", "game_over");
        gameOverMsg.set("winner", msg.get("winner"));
        gameOverMsg.set("reason", msg.get("reason"));

        sendJson(room.host, gameOverMsg);
        sendJson(room.guest, gameOverMsg);
    }

    private void handleChat(WebSocketSession session, JsonNode msg) throws IOException {
        PvpPlayer player = sessionPlayers.get(session.getId());
        if (player == null) return;

        PvpRoom room = rooms.get(player.roomId);
        if (room == null) return;

        WebSocketSession opponent = room.getOpponent(session);
        if (opponent != null && opponent.isOpen()) {
            ObjectNode chatMsg = objectMapper.createObjectNode();
            chatMsg.put("type", "chat");
            chatMsg.put("name", player.playerName);
            chatMsg.set("message", msg.get("message"));
            sendJson(opponent, chatMsg);
        }
    }

    private void sendJson(WebSocketSession session, Object data) {
        if (session == null || !session.isOpen()) return;
        try {
            String json = objectMapper.writeValueAsString(data);
            synchronized (session) {
                if (session.isOpen()) session.sendMessage(new TextMessage(json));
            }
        } catch (Exception e) {
            logger.error("Error sending message", e);
        }
    }

    private String generateSeed() {
        byte[] bytes = new byte[16];
        secureRandom.nextBytes(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private ArrayNode shuffleDeck(JsonNode deck) {
        List<JsonNode> cards = new ArrayList<>();
        deck.forEach(cards::add);
        Collections.shuffle(cards, secureRandom);
        ArrayNode shuffled = objectMapper.createArrayNode();
        shuffled.addAll(cards);
        return shuffled;
    }

    // Inner classes
    static class PvpRoom {
        WebSocketSession host;
        WebSocketSession guest;
        String hostName;
        String guestName;
        JsonNode hostDeck;
        JsonNode guestDeck;
        String seed;
        int turn;
        boolean gameStarted;
        Set<Integer> ready = new HashSet<>();

        WebSocketSession getOpponent(WebSocketSession session) {
            if (session == host) return guest;
            if (session == guest) return host;
            return null;
        }
    }

    static class PvpPlayer {
        WebSocketSession session;
        String roomId;
        int playerIndex;
        String playerName;
    }
}
