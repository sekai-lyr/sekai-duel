# Sekai Duel Godot

Godot 4.7 native client migration. The existing Spring Boot/MySQL server remains the authoritative account, collection and PvP relay service.

## Current playable slice

- Imports the 368 effective cards from the web client.
- Deterministic deck shuffle, opening hand, draw and turn switching.
- Monster summon, spell activation, set spell/trap, battle and direct attack.
- Core effect dispatch, a basic AI turn and the existing `/ws/pvp` message schema.
- A minimal 2D duel scene intended to validate rules before copyrighted art is replaced.

## Run

Open this directory with Godot 4.7.1, or run:

```powershell
Godot_v4.7.1-stable_win64.exe --path D:\Sekai_two\memory-11\SekaiGameGodot --editor
```

Headless rules test:

```powershell
Godot_v4.7.1-stable_win64.exe --headless --path D:\Sekai_two\memory-11\SekaiGameGodot --script res://tests/test_duel_engine.gd
```

Regenerate card data after web rules change:

```powershell
node D:\Sekai_two\memory-11\SekaiGame\scripts\export_godot_cards.mjs
```
