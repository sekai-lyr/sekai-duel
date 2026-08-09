# Nightcord Duel Network - Backend Server

Spring Boot 后端服务，为 Nightcord Duel Network 前端提供 REST API。

## 技术栈

- Java 17
- Spring Boot 3.2.5
- Spring Data JPA
- MySQL 8.x
- Spring Security (BCrypt)

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `cards` | 卡牌数据库（50张卡） |
| `users` | 用户账号 |
| `user_cards` | 用户拥有的卡牌 |
| `decks` | 卡组 |
| `deck_cards` | 卡组中的卡牌 |
| `duel_records` | 对局记录 |

## 快速开始

### 1. 创建 MySQL 数据库

```sql
CREATE DATABASE nightcord_duel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 修改配置

编辑 `src/main/resources/application.yml`，修改数据库连接信息：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/nightcord_duel
    username: your_username
    password: your_password
```

### 3. 提取卡牌数据

从前端项目提取卡牌数据到数据库：

```bash
node scripts/extract-cards.mjs
```

### 4. 启动服务

```bash
# Maven
mvn spring-boot:run

# 或打包后运行
mvn package
java -jar target/nightcord-server-1.0.0.jar
```

服务启动后访问: http://localhost:8081

## API 接口

### 健康检查
- `GET /api/health` - 服务状态和卡牌数量

### 卡牌
- `GET /api/cards` - 获取所有卡牌
- `GET /api/cards/{id}` - 获取单张卡牌
- `GET /api/cards/type/{type}` - 按类型筛选 (monster/spell/trap)
- `GET /api/cards/rarity/{rarity}` - 按稀有度筛选
- `GET /api/cards/series/{series}` - 按系列筛选
- `POST /api/cards` - 创建卡牌
- `POST /api/cards/batch` - 批量创建卡牌

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录

### 用户
- `GET /api/users/{userId}` - 获取用户信息
- `PUT /api/users/{userId}` - 更新用户信息
- `GET /api/users/{userId}/stats` - 用户统计
- `GET /api/users/{userId}/cards` - 用户拥有的卡牌

### 卡组
- `GET /api/decks/user/{userId}` - 获取用户所有卡组
- `GET /api/decks/{deckId}` - 获取卡组详情
- `POST /api/decks/user/{userId}` - 创建卡组
- `PUT /api/decks/{deckId}` - 更新卡组
- `DELETE /api/decks/{deckId}` - 删除卡组

### 收藏
- `GET /api/collection/{userId}` - 获取用户收藏
- `GET /api/collection/{userId}/stats` - 收藏统计
- `POST /api/collection/{userId}/pack` - 抽卡包

### 对局
- `GET /api/duels/user/{userId}` - 用户对局记录
- `POST /api/duels/user/{userId}` - 记录对局结果
- `GET /api/duels/user/{userId}/stats` - 对局统计
- `GET /api/duels/leaderboard` - 排行榜

## 前端对接

前端项目可以通过 fetch 调用这些 API：

```javascript
// 示例：获取所有卡牌
const cards = await fetch('http://localhost:8081/api/cards').then(r => r.json());

// 示例：用户登录
const result = await fetch('http://localhost:8081/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'player1', password: '123456' })
}).then(r => r.json());
```

## 项目结构

```
nightcord-server/
├── pom.xml
├── README.md
├── scripts/
│   └── extract-cards.mjs       # 卡牌数据提取工具
└── src/main/
    ├── java/com/nightcord/duel/
    │   ├── NightcordApplication.java
    │   ├── config/
    │   │   ├── CorsConfig.java
    │   │   ├── SecurityConfig.java
    │   │   └── DataInitializer.java
    │   ├── entity/
    │   │   ├── Card.java
    │   │   ├── User.java
    │   │   ├── UserCard.java
    │   │   ├── Deck.java
    │   │   ├── DeckCard.java
    │   │   └── DuelRecord.java
    │   ├── repository/
    │   │   ├── CardRepository.java
    │   │   ├── UserRepository.java
    │   │   ├── UserCardRepository.java
    │   │   ├── DeckRepository.java
    │   │   ├── DeckCardRepository.java
    │   │   └── DuelRecordRepository.java
    │   ├── service/
    │   │   ├── CardService.java
    │   │   ├── UserService.java
    │   │   ├── DeckService.java
    │   │   ├── CollectionService.java
    │   │   └── DuelRecordService.java
    │   └── controller/
    │       ├── CardController.java
    │       ├── AuthController.java
    │       ├── UserController.java
    │       ├── DeckController.java
    │       ├── CollectionController.java
    │       ├── DuelRecordController.java
    │       └── HealthController.java
    └── resources/
        ├── application.yml
        └── cards.json
```
