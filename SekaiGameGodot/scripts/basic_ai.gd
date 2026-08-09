class_name BasicAI
extends RefCounted

func take_turn(engine: DuelEngine, player_index := 1) -> void:
	if engine.state.active_player != player_index or engine.state.winner >= 0:
		return
	var hand: Array = engine.state.players[player_index].hand
	for index in range(hand.size() - 1, -1, -1):
		if hand[index].type == "spell":
			engine.activate_spell(player_index, index)
			break
	hand = engine.state.players[player_index].hand
	for index in hand.size():
		if hand[index].type == "monster":
			engine.summon(player_index, index)
			break
	if engine.enter_battle_phase(player_index):
		while true:
			var attacker_index := _next_attacker(engine.state.players[player_index].monster_zone)
			if attacker_index < 0: break
			var targets: Array = engine.state.players[engine.state.opponent_of(player_index)].monster_zone
			engine.attack(player_index, attacker_index, 0 if not targets.is_empty() else -1)
	engine.end_turn(player_index)

func _next_attacker(monsters: Array) -> int:
	for index in monsters.size():
		if monsters[index].get("can_attack", false) and not monsters[index].get("has_attacked", false):
			return index
	return -1
