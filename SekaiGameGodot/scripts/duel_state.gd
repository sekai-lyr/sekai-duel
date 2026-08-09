class_name DuelState
extends RefCounted

const STARTING_LP := 8000
const STARTING_HAND := 5
const MONSTER_ZONE_SIZE := 5
const SPELL_TRAP_ZONE_SIZE := 5

var turn := 1
var phase := "main"
var active_player := 0
var winner := -1
var log: Array[String] = []
var players: Array[Dictionary] = []

func _init() -> void:
	players = [_new_player("玩家"), _new_player("对手")]

func _new_player(player_name: String) -> Dictionary:
	return {
		"name": player_name,
		"lp": STARTING_LP,
		"deck": [],
		"hand": [],
		"monster_zone": [],
		"spell_trap_zone": [],
		"graveyard": [],
		"banished": [],
		"normal_summoned": false,
		"skip_battle": false,
	}

func opponent_of(player_index: int) -> int:
	return 1 - player_index

func add_log(message: String) -> void:
	log.append(message)
	if log.size() > 200:
		log.pop_front()
