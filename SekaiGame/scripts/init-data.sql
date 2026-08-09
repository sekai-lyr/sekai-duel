-- ============================================
-- Sekai Friend - 卡牌初始数据
-- 仅 SSR + UR 魔法卡 (共16张)
-- ============================================

INSERT INTO `sekai_card_cards` (`id`, `name`, `series`, `type`, `attribute`, `level`, `attack`, `defense`, `rarity`, `cost`, `effects_json`, `description`, `enabled`) VALUES

-- ============ UR 魔法卡 (10张) ============

('nc_sp_ur_001', '八千年的思念', 'nightcord', 'spell', 'dark', 0, 0, 0, 'UR', 5,
 '[{"trigger":"manual","type":"reviveRecentGraveyard","value":2,"description":"从墓地复活1只2回合以内送入墓地的怪兽卡到场上（不限星数）。"}]',
 '从墓地复活1只2回合以内送入墓地的怪兽卡到场上（不限星数）。', 1),

('nc_sp_ur_002', '薄采序奏', 'nightcord', 'spell', 'dark', 0, 0, 0, 'UR', 4,
 '[{"trigger":"manual","type":"doubleAttack","value":0,"target":{"owner":"self","zone":"monster","selector":"highestAttack","count":1},"description":"指定己方1只怪兽，本回合内可以发动两次攻击。"}]',
 '指定己方1只怪兽，本回合内可以发动两次攻击。', 1),

('nc_sp_ur_003', '不登校的未来', 'nightcord', 'spell', 'dark', 0, 0, 0, 'UR', 3,
 '[{"trigger":"manual","type":"returnToHand","value":0,"target":{"owner":"opponent","zone":"monster","selector":"highestAttack","count":1},"description":"指定对方1只怪兽返回手牌。"}]',
 '指定对方1只怪兽返回手牌。', 1),

('nc_sp_ur_004', '放学后的茶会', 'nightcord', 'spell', 'dark', 0, 0, 0, 'UR', 3,
 '[{"trigger":"manual","type":"recoverRecentDamage","value":3,"description":"回复前3个回合内失去的生命值，并抽1张卡。"}]',
 '回复前3个回合内失去的生命值，并抽1张卡。', 1),

('nc_sp_ur_005', '碎穹', 'nightcord', 'spell', 'dark', 0, 0, 0, 'UR', 6,
 '[{"trigger":"manual","type":"sacrificeDestroy","value":90,"description":"支付90%当前生命值，破坏对方场上任意2只怪兽卡。"}]',
 '支付90%当前生命值，破坏对方场上任意2只怪兽卡。', 1),

('nc_sp_ur_006', '有刺无刺', 'nightcord', 'spell', 'dark', 0, 0, 0, 'UR', 4,
 '[{"trigger":"manual","type":"guessGame","value":0,"description":"对方选择有刺或无刺。猜对：发动者抽1张卡。猜错：双方怪兽区全部破坏。"}]',
 '对方选择有刺或无刺。猜对：发动者抽1张卡。猜错：双方怪兽区全部破坏。', 1),

('nc_sp_ur_007', '社恐的焦虑', 'nightcord', 'spell', 'dark', 0, 0, 0, 'UR', 4,
 '[{"trigger":"manual","type":"swapHands","value":0,"description":"交换双方的手牌。"}]',
 '交换双方的手牌。', 1),

('nc_sp_ur_008', '月下传讯', 'nightcord', 'spell', 'dark', 0, 0, 0, 'UR', 4,
 '[{"trigger":"manual","type":"drawCards","value":3,"description":"抽3张卡。"}]',
 '抽3张卡。', 1),

('nc_sp_ur_009', '最好的伙伴', 'nightcord', 'spell', 'dark', 0, 0, 0, 'UR', 5,
 '[{"trigger":"manual","type":"fusionSummon","value":0,"description":"将手牌或场上两只特定怪兽融合，从牌组或手牌特殊召唤融合怪兽。"}]',
 '将手牌或场上两只特定怪兽融合，从牌组或手牌特殊召唤融合怪兽。', 1),

('nc_sp_ur_010', '游戏王座', 'nightcord', 'spell', 'dark', 0, 0, 0, 'UR', 5,
 '[]',
 '待补充效果描述。', 1),

-- ============ SSR 魔法卡 (6张) ============

('nc_sp_ss_001', '畸变DNA', 'nightcord', 'spell', 'dark', 0, 0, 0, 'SSR', 4,
 '[{"trigger":"manual","type":"buffThenDebuff","value":400,"penalty":700,"target":{"owner":"self","zone":"monster","selector":"all"},"description":"本回合己方所有怪兽攻击力+400，回合结束时永久-700。"}]',
 '本回合己方所有怪兽攻击力+400，回合结束时永久-700。', 1),

('nc_sp_ss_002', '夏风石阶的挚友茶会', 'nightcord', 'spell', 'light', 0, 0, 0, 'SSR', 3,
 '[{"trigger":"manual","type":"drawCards","value":2,"description":"抽2张卡。"}]',
 '抽2张卡。', 1),

('nc_sp_ss_003', '夜刻萦音的永续热忱', 'nightcord', 'spell', 'light', 0, 0, 0, 'SSR', 4,
 '[{"trigger":"manual","type":"healAndDrawV2","value":2000,"draw":1,"description":"回复2000生命值，并抽1张卡。"}]',
 '回复2000生命值，并抽1张卡。', 1),

('nc_sp_ss_004', '幽蝶旧画的沉郁祈愿', 'nightcord', 'spell', 'dark', 0, 0, 0, 'SSR', 5,
 '[{"trigger":"manual","type":"snatchCards","value":2,"description":"随机抽取对方手牌2张。若两张卡类型相同，归还对方（魔法失败）；若类型不同，归你所有（魔法成功）。"}]',
 '随机抽取对方手牌2张。若两张卡类型相同，归还对方（魔法失败）；若类型不同，归你所有（魔法成功）。', 1),

('nc_sp_ss_005', '奏响点亮天空', 'nightcord', 'spell', 'light', 0, 0, 0, 'SSR', 4,
 '[{"trigger":"manual","type":"recycleAndDraw","owner":"self","description":"将己方所有手牌送入墓地，然后抽取相同数量的卡。"}]',
 '将己方所有手牌送入墓地，然后抽取相同数量的卡。', 1),

('nc_sp_ss_006', '沉睡的蓝调', 'nightcord', 'spell', 'water', 0, 0, 0, 'SSR', 4,
 '[{"trigger":"manual","type":"recycleAndDraw","owner":"opponent","description":"将对方所有手牌送入墓地，然后对方抽取相同数量的卡。"}]',
 '将对方所有手牌送入墓地，然后对方抽取相同数量的卡。', 1);
