import { mkdir, writeFile } from "node:fs/promises";
import { ALL_CARDS } from "../src/main/resources/static/js/catalog.js";

const output = new URL("../../SekaiGameGodot/data/cards.json", import.meta.url);
await mkdir(new URL("../../SekaiGameGodot/data/", import.meta.url), { recursive: true });
await writeFile(output, JSON.stringify(ALL_CARDS, null, 2), "utf8");
console.log(`exported ${ALL_CARDS.length} cards for Godot`);
