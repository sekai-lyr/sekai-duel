import pymysql
conn = pymysql.connect(host='127.0.0.1', user='root', password='123456520baba', database='sekai_friend', charset='utf8mb4')
cur = conn.cursor()
cur.execute("DELETE FROM sekai_game_cards")
cards = [
    ('card-001', '\u6697\u591c\u9b54\u9f99', 'Sekai', 'monster', 'dark', 7, 2400, 2000, 'UR', 8, '[{"type":"destroy","target":"all"}]', '\u6765\u81ea\u6df1\u6e0a\u7684\u6697\u9ed1\u4e4b\u9f99'),
    ('card-002', '\u5149\u4e4b\u5929\u4f7f', 'Sekai', 'monster', 'light', 5, 1800, 1600, 'SR', 5, '[{"type":"heal","value":1000}]', '\u5723\u5149\u5316\u8eab\u7684\u5b88\u62a4\u5929\u4f7f'),
    ('card-003', '\u706b\u7130\u6218\u58eb', 'Sekai', 'monster', 'fire', 4, 1600, 1200, 'R', 3, '[]', '\u70c8\u7130\u4e2d\u8bde\u751f\u7684\u52c7\u731b\u6218\u58eb'),
    ('card-004', '\u51b0\u6676\u672f\u58eb', 'Sekai', 'monster', 'water', 4, 1400, 1800, 'R', 3, '[{"type":"freeze","target":"single"}]', '\u638c\u63e1\u51b0\u971c\u9b54\u6cd5\u7684\u795e\u79d8\u672f\u58eb'),
    ('card-005', '\u98ce\u4e4b\u7cbe\u7075', 'Sekai', 'monster', 'wind', 3, 1200, 1000, 'N', 2, '[]', '\u8f7b\u76c8\u7684\u98ce\u4e4b\u7cbe\u7075'),
    ('card-006', '\u5927\u5730\u5b88\u536b', 'Sekai', 'monster', 'earth', 4, 1000, 2200, 'R', 3, '[]', '\u5927\u5730\u4e4b\u529b\u7684\u575a\u5b9e\u5b88\u536b'),
    ('card-007', '\u6697\u5f71\u523a\u5ba2', 'Sekai', 'monster', 'dark', 4, 1700, 800, 'R', 3, '[{"type":"direct_attack"}]', '\u6f5c\u4f0f\u4e8e\u6697\u5f71\u4e2d\u7684\u81f4\u547d\u523a\u5ba2'),
    ('card-008', '\u5723\u5149\u6cbb\u6108', 'Sekai', 'spell', 'light', None, None, None, 'N', 1, '[{"type":"heal","value":800}]', '\u795e\u5723\u7684\u5149\u8292\u6cbb\u6108\u53cb\u65b9800\u70b9\u751f\u547d'),
    ('card-009', '\u706b\u7130\u98ce\u66b4', 'Sekai', 'spell', 'fire', None, None, None, 'R', 3, '[{"type":"destroy","target":"all"}]', '\u53ec\u5524\u70c8\u7130\u98ce\u66b4\u6467\u6bc1\u654c\u65b9\u5168\u90e8\u602a\u517d'),
    ('card-010', '\u51b0\u5c01\u9677\u9631', 'Sekai', 'trap', 'water', None, None, None, 'R', 2, '[{"type":"freeze","target":"single"}]', '\u654c\u65b9\u602a\u517d\u653b\u51fb\u65f6\u53d1\u52a8\uff0c\u5c06\u5176\u51b0\u5c01\u4e00\u56de\u5408'),
    ('card-011', '\u9b54\u529b\u589e\u5e45', 'Sekai', 'spell', 'light', None, None, None, 'N', 2, '[{"type":"boost","value":500}]', '\u63d0\u5347\u5df1\u65b9\u602a\u517d500\u70b9\u653b\u51fb\u529b'),
    ('card-012', '\u661f\u4e4b\u5b88\u62a4\u8005', 'Sekai', 'monster', 'light', 8, 2800, 2500, 'SSR', 10, '[{"type":"protect","target":"all"}]', '\u661f\u8fb0\u4e4b\u529b\u51dd\u805a\u7684\u81f3\u9ad8\u5b88\u62a4\u8005'),
    ('card-013', '\u96f7\u9706\u4e4b\u6012', 'Sekai', 'spell', 'light', None, None, None, 'SR', 5, '[{"type":"destroy","target":"single"}]', '\u53ec\u5524\u5929\u96f7\u6467\u6bc1\u654c\u65b9\u4e00\u53ea\u602a\u517d'),
    ('card-014', '\u6df1\u6e0a\u53ec\u5524', 'Sekai', 'spell', 'dark', None, None, None, 'SR', 4, '[{"type":"special_summon"}]', '\u4ece\u5361\u7ec4\u7279\u6b8a\u53ec\u5524\u4e00\u53ea\u6697\u5c5e\u6027\u602a\u517d'),
    ('card-015', '\u955c\u9762\u53cd\u5c04', 'Sekai', 'trap', 'light', None, None, None, 'N', 1, '[{"type":"reflect"}]', '\u53cd\u5c04\u5bf9\u624b\u7684\u4e00\u6b21\u653b\u51fb'),
    ('card-016', '\u75be\u98ce\u65a9', 'Sekai', 'spell', 'wind', None, None, None, 'N', 2, '[{"type":"direct_damage","value":600}]', '\u98ce\u4e4b\u5203\u5bf9\u5bf9\u624b\u9020\u6210600\u70b9\u4f24\u5bb3'),
]
sql = "INSERT INTO sekai_game_cards (id,name,series,type,attribute,level,attack,defense,rarity,cost,effects_json,description,enabled) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE)"
cur.executemany(sql, cards)
conn.commit()
print(f"Inserted {cur.rowcount} cards")
cur.execute('SELECT id, name, rarity FROM sekai_game_cards LIMIT 3')
for row in cur.fetchall(): print(row)
cur.close(); conn.close()
