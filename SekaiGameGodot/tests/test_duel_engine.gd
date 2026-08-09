extends SceneTree

var failures := 0

func _init() -> void:
	call_deferred("_run")

func _run() -> void:
	var catalog: Node = root.get_node("CardCatalog")
	_check(catalog.cards.size() == 368, "应迁移全部368张卡")
	_test_effect_handler_coverage(catalog)
	_test_turn_and_summon()
	_test_diego_character_effects()
	_test_diego_destroys_spell_traps()
	_test_four_monsters_can_attack()
	_test_skill_cost_and_condition()
	print("Godot duel tests: %d failure(s)" % failures)
	quit(1 if failures else 0)

func _test_turn_and_summon() -> void:
	var catalog: Node = root.get_node("CardCatalog")
	var ids: Array[String] = []
	for card: Dictionary in catalog.cards:
		if card.type == "monster": ids.append(card.id)
		if ids.size() == 40: break
	var engine := DuelEngine.new()
	_check(engine.start_duel(ids, ids, 7), "应能启动决斗")
	_check(engine.state.players[0].hand.size() == 5, "初始手牌应为5张")
	_check(engine.summon(0, 0), "主阶段应能通常召唤")
	_check(not engine.summon(0, 0), "每回合只能通常召唤一次")
	_check(engine.end_turn(0), "应能结束回合")
	_check(engine.state.active_player == 1, "结束回合后应切换玩家")

func _test_diego_character_effects() -> void:
	var catalog: Node = root.get_node("CardCatalog")
	var diego: Dictionary = catalog.get_card("picture_ex_017")
	_check(not diego.is_empty(), "应包含迪亚哥卡牌")
	var types: Array = diego.get("effects", []).map(func(effect: Dictionary): return effect.get("type"))
	_check(types == ["tokenSummon", "gainAttackByCount", "destroyAllEnemySpellTraps"], "迪亚哥应保留恐龙专属效果")

func _test_effect_handler_coverage(catalog: Node) -> void:
	var engine := DuelEngine.new()
	var missing: Array[String] = []
	for card: Dictionary in catalog.cards:
		for effect: Dictionary in card.get("effects", []):
			var effect_type := str(effect.get("type", ""))
			if not engine.supports_effect_type(effect_type) and effect_type not in missing:
				missing.append(effect_type)
	_check(missing.is_empty(), "全部卡牌效果均有Godot处理器：%s" % ",".join(missing))

func _test_diego_destroys_spell_traps() -> void:
	var catalog: Node = root.get_node("CardCatalog")
	var ids: Array[String] = []
	for card: Dictionary in catalog.cards:
		if card.type == "monster": ids.append(card.id)
		if ids.size() == 40: break
	var engine := DuelEngine.new()
	engine.start_duel(ids, ids, 9)
	engine.state.players[0].hand = [catalog.create_instance("picture_ex_017")]
	engine.state.players[1].spell_trap_zone = [
		{"name":"测试陷阱A", "type":"trap", "effects":[]},
		{"name":"测试魔法B", "type":"spell", "effects":[]},
	]
	_check(engine.summon(0, 0), "应能召唤迪亚哥")
	_check(engine.state.players[1].spell_trap_zone.is_empty(), "兽群践踏应破坏对方全部魔法与陷阱")

func _test_four_monsters_can_attack() -> void:
	var catalog: Node = root.get_node("CardCatalog")
	var engine := DuelEngine.new()
	engine.state.active_player = 0
	for card: Dictionary in catalog.cards:
		if card.type == "monster": engine.state.players[0].monster_zone.append(catalog.create_instance(card.id))
		if engine.state.players[0].monster_zone.size() == 4: break
	_check(engine.enter_battle_phase(0), "应能进入战斗阶段")
	_check(engine.state.players[0].monster_zone.all(func(card: Dictionary): return card.can_attack), "场上4只已有怪兽均应获得攻击权")

func _test_skill_cost_and_condition() -> void:
	var engine := DuelEngine.new()
	engine.state.active_player = 0
	var monster := {
		"name":"代价测试怪兽", "type":"monster", "current_attack":1000, "current_defense":1000,
		"can_attack":false, "has_attacked":false, "cannot_attack":false,
		"effects":[{"trigger":"manual", "type":"doubleAttack", "value":1, "oncePerTurn":true, "cost":{"type":"payLife", "value":1000}}],
	}
	engine.state.players[0].monster_zone = [monster]
	_check(engine.activate_monster_effect(0, 0, 0), "满足代价时应能发动主动技能")
	_check(engine.state.players[0].lp == 7000, "主动技能应真实支付1000LP")
	_check(not engine.activate_monster_effect(0, 0, 0), "每回合一次技能不能重复发动")
	_check(engine.state.players[0].lp == 7000, "重复发动失败时不应再次扣费")

func _check(condition: bool, message: String) -> void:
	if condition:
		print("PASS: %s" % message)
	else:
		failures += 1
		push_error("FAIL: %s" % message)
