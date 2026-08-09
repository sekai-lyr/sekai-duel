class_name PvpClient
extends Node

signal room_created(room_id: String)
signal room_joined(room_id: String, opponent: String)
signal game_started(payload: Dictionary)
signal action_received(action: Dictionary, player_index: int)
signal turn_changed(turn: int, request_id: String)
signal failed(reason: String)

var socket := WebSocketPeer.new()
var connected := false
var pvp_url := "ws://121.40.26.107/ws/pvp"

func connect_to_server() -> Error:
	var error := socket.connect_to_url(pvp_url)
	set_process(error == OK)
	return error

func _process(_delta: float) -> void:
	socket.poll()
	var ready_state := socket.get_ready_state()
	if ready_state == WebSocketPeer.STATE_OPEN:
		connected = true
		while socket.get_available_packet_count() > 0:
			_handle_message(socket.get_packet().get_string_from_utf8())
	elif ready_state == WebSocketPeer.STATE_CLOSED:
		if connected: failed.emit("联机连接已断开")
		connected = false
		set_process(false)

func create_room(player_name: String) -> void:
	_send({"type":"create_room", "name":player_name})

func join_room(room_id: String, player_name: String) -> void:
	_send({"type":"join_room", "roomId":room_id, "name":player_name})

func set_deck(card_ids: Array[String]) -> void:
	_send({"type":"set_deck", "deck":card_ids})

func send_action(action: Dictionary) -> void:
	_send({"type":"game_action", "action":action})

func end_turn(snapshot: Dictionary, request_id: String) -> void:
	_send({"type":"end_turn", "state":snapshot, "requestId":request_id})

func _send(message: Dictionary) -> void:
	if socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		failed.emit("联机消息发送失败：连接已断开")
		return
	socket.send_text(JSON.stringify(message))

func _handle_message(text: String) -> void:
	var parsed: Variant = JSON.parse_string(text)
	if not parsed is Dictionary: return
	match str(parsed.get("type", "")):
		"room_created": room_created.emit(str(parsed.get("roomId", "")))
		"room_joined", "opponent_joined": room_joined.emit(str(parsed.get("roomId", "")), str(parsed.get("opponent", parsed.get("name", ""))))
		"game_start": game_started.emit(parsed)
		"game_action": action_received.emit(parsed.get("action", {}), int(parsed.get("playerIndex", -1)))
		"turn_changed": turn_changed.emit(int(parsed.get("turn", 0)), str(parsed.get("requestId", "")))
		"error": failed.emit(str(parsed.get("reason", "服务器错误")))
