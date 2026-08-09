# 🎴 Sekai Duel · 夜曲决斗

> **基于游戏王规则 + WebSocket 实时对战 + Godot 4 客户端的二次元卡牌游戏**
> A Yu-Gi-Oh! rules card game with WebSocket real-time PvP and a Godot 4 client

[![Java](https://img.shields.io/badge/Java-17-orange)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-brightgreen)](https://spring.io/projects/spring-boot)
[![WebSocket](https://img.shields.io/badge/WebSocket-PvP-blueviolet)](https://developer.mozilla.org/docs/Web/API/WebSockets_API)
[![Spring Data JPA](https://img.shields.io/badge/Spring%20Data%20JPA-3.x-6DB33F)](https://spring.io/projects/spring-data-jpa)
[![Godot 4](https://img.shields.io/badge/Godot-4.7-blue)](https://godotengine.org/)
[![Yu-Gi-Oh](https://img.shields.io/badge/规则-游戏王-important)](https://en.wikipedia.org/wiki/Yu-Gi-Oh!_Trading_Card_Game)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

An anime-style card duel game implementing **Yu-Gi-Oh! rules**, with a **Java Web backend** and a **Godot 4 client**, supporting **real-time PvP battles** over WebSocket.

一款实现游戏王规则的二次元卡牌决斗游戏：**Java Web 后端 + Godot 4 客户端**，支持 **WebSocket 实时 PvP 对战**。

<p align="center">
  <img src="screenshots/demo.webp" alt="Demo" width="720"/>
</p>

---

## 🗂️ Project Structure / 项目组成

### SekaiGame (Java Backend)

- Spring Boot + WebSocket + Spring Data JPA + MySQL
- Account system, collection system
- PvP real-time battle WebSocket relay service (`/ws/pvp`)
- Full Yu-Gi-Oh! rule engine: summon, spell/trap activation, battle phase, direct attacks, token summoning, effect resolution
- 300+ cards with effects, rarities, starter packs, and a card pack system

### SekaiGameGodot (Godot 4 Client)

- Godot 4.7 native client
- 368 valid cards imported
- Deterministic shuffling, opening hands, drawing, turn switching
- Monster summoning, spell activation, setting cards, battle & direct attacks
- Core effect dispatch, basic AI turns
- `/ws/pvp` message protocol
- See `SekaiGameGodot/README.md`

## ▶️ Quick Start / 快速开始

### Backend / 后端

```powershell
cd SekaiGame
# 1. Create MySQL database & set env vars
$env:MYSQL_PASSWORD = "your-db-password"   # same as in application.yml
$env:JWT_SECRET = "your-jwt-secret"
# 2. Run
mvn spring-boot:run
```

### Godot Client / Godot 客户端

Open the `SekaiGameGodot` folder with Godot 4.7.1.

## 📝 Notes / 说明

- **Card images are NOT included** due to copyright. The game data (stats, effects, rarities) is fully included — add your own card art under `SekaiGame/src/main/resources/static/assets/cards/` or replace with generated placeholders. 卡面素材因版权问题未包含，卡牌数据完整保留，请自行准备卡面图片。
- MySQL database name: `sekai_friend`
- Secrets are read from environment variables — never hardcode them.

## 📄 License

[MIT](LICENSE) © 2026 [sekai-lyr](https://github.com/sekai-lyr)

---

**⭐ If this project helped you, star it! 如果这个项目对你有帮助，欢迎 Star！**
