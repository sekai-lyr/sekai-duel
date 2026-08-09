extends Control

var engine := DuelEngine.new()
var ai := BasicAI.new()
var selected_hand_index := -1

@onready var status_label: Label = %StatusLabel
@onready var hand_list: ItemList = %HandList
@onready var player_field: ItemList = %PlayerField
@onready var opponent_field: ItemList = %OpponentField
@onready var log_box: RichTextLabel = %LogBox

func _ready() -> void:
	engine.state_changed.connect(_render)
	engine.action_resolved.connect(func(message: String): status_label.text = message)
	start_demo_duel()

func start_demo_duel() -> void:
	var catalog: Node = get_node("/root/CardCatalog")
	var starter: Array[String] = []
	for card: Dictionary in catalog.cards:
		if card.get("series", "") == "starter_ygo": starter.append(str(card.id))
		if starter.size() == 40: break
	if starter.size() < 20:
		status_label.text = "没有足够的卡牌启动决斗"
		return
	engine.start_duel(starter, starter, 20260808)

func _render(state: DuelState) -> void:
	var player := state.players[0]
	var opponent := state.players[1]
	%PlayerLP.text = "玩家 LP %d" % player.lp
	%OpponentLP.text = "对手 LP %d" % opponent.lp
	%TurnLabel.text = "TURN %d · %s · %s" % [state.turn, "你的回合" if state.active_player == 0 else "AI回合", state.phase.to_upper()]
	hand_list.clear()
	for card: Dictionary in player.hand:
		hand_list.add_item(_card_line(card))
	player_field.clear()
	for card: Dictionary in player.monster_zone:
		player_field.add_item(_card_line(card))
	opponent_field.clear()
	for card: Dictionary in opponent.monster_zone:
		opponent_field.add_item(_card_line(card))
	log_box.text = "\n".join(state.log.slice(max(0, state.log.size() - 12)))
	if state.active_player == 1 and state.winner < 0:
		call_deferred("_run_ai")

func _card_line(card: Dictionary) -> String:
	if card.type == "monster":
		return "%s  ATK %d / DEF %d" % [card.name, card.get("current_attack", card.get("attack", 0)), card.get("current_defense", card.get("defense", 0))]
	return "%s  [%s]" % [card.name, str(card.type).to_upper()]

func _run_ai() -> void:
	await get_tree().create_timer(0.4).timeout
	ai.take_turn(engine, 1)

func _on_hand_selected(index: int) -> void:
	selected_hand_index = index

func _on_summon_pressed() -> void:
	engine.summon(0, selected_hand_index)

func _on_activate_pressed() -> void:
	engine.activate_spell(0, selected_hand_index)

func _on_set_pressed() -> void:
	engine.set_spell_trap(0, selected_hand_index)

func _on_battle_pressed() -> void:
	engine.enter_battle_phase(0)

func _on_attack_pressed() -> void:
	var selected := player_field.get_selected_items()
	if selected.is_empty(): return
	var targets := opponent_field.get_selected_items()
	engine.attack(0, selected[0], targets[0] if not targets.is_empty() else -1)

func _on_end_turn_pressed() -> void:
	engine.end_turn(0)
