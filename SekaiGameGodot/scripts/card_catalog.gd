extends Node

const CARD_DATA_PATH := "res://data/cards.json"
var cards: Array[Dictionary] = []
var cards_by_id: Dictionary = {}

func _ready() -> void:
	load_cards()

func load_cards() -> bool:
	cards.clear()
	cards_by_id.clear()
	if not FileAccess.file_exists(CARD_DATA_PATH):
		push_error("Card data missing: %s" % CARD_DATA_PATH)
		return false
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(CARD_DATA_PATH))
	if not parsed is Array:
		push_error("Card data must be a JSON array")
		return false
	for value: Variant in parsed:
		if not value is Dictionary or not value.has("id"):
			continue
		var card: Dictionary = value.duplicate(true)
		_normalize_card(card)
		cards.append(card)
		cards_by_id[card.id] = card
	return not cards.is_empty()

func get_card(card_id: String) -> Dictionary:
	return cards_by_id.get(card_id, {}).duplicate(true)

func create_instance(card_id: String) -> Dictionary:
	var card := get_card(card_id)
	if card.is_empty():
		return {}
	card["instance_id"] = "%s_%s" % [card_id, Time.get_ticks_usec()]
	card["current_attack"] = int(card.get("attack", 0))
	card["current_defense"] = int(card.get("defense", 0))
	card["face_up"] = true
	card["position"] = "attack"
	card["has_attacked"] = false
	card["attacks_left"] = 0
	card["can_attack"] = false
	card["cannot_attack"] = false
	card["cannot_be_destroyed_by_battle"] = false
	card["cannot_be_targeted"] = false
	card["cannot_be_destroyed_by_effect"] = false
	return card

func _normalize_card(card: Dictionary) -> void:
	card["type"] = str(card.get("type", "monster"))
	card["rarity"] = str(card.get("rarity", "N"))
	card["level"] = int(card.get("level", 0))
	card["attack"] = int(card.get("attack", 0))
	card["defense"] = int(card.get("defense", 0))
	if not card.get("effects", []) is Array:
		card["effects"] = []
