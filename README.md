# Dragonwilds Completionist

A completion tracker for **RuneScape: Dragonwilds**. Everything a completionist chases, in one page, filled in from your own save file.

**Live site:** https://frederikstenbergpedersen.github.io/dragonwilds-completionist/

## What it tracks

| Section | What's in it |
|---|---|
| Quests | Every primary, secondary and tertiary quest, plus the bigger challenges beyond them |
| Skills | All 12 skills, with progress to level 94 and 99 by level and by XP |
| Agility Courses | All 6 courses and 18 medals, with times, requirements and best runs |
| Recipes | Every vestige and vault recipe, by its crafting-journal name |
| Mounts | The 17 obtainable terrorbird and carpet variants |
| Urns | All 21 Sanguine Urns, on maps of each region |
| Burrows | All 19 kebbit burrows, on maps of each region |
| Lore | All 114 lore scraps, by region and story |
| Plants | All 72 plant and seed journal entries |
| Factions | All 60 enemy journal entries |

Three completion tiers sit on top: **Completionist** (everything except skills), **Completionist+** (every skill at 94) and **Completionist++** (every skill at 99).

## Save import

Drop your character save on the page and everything it records is ticked for you. The file is read in your browser and never uploaded.

`%LOCALAPPDATA%\RSDragonwilds\Saved\SaveCharacters\<CharacterName>.json`

Kebbit burrows are the one exception: the save only counts how many you've opened, so you tick which ones on the maps.

Progress is stored in your browser. Backup codes let you move it to another browser.

## Data sources

- [RuneScape: Dragonwilds Wiki](https://dragonwilds.runescape.wiki/) for quests, recipes, lore and the world map.
- [RSDWArchive](https://github.com/RSDWArchive/RSDWArchive) game-data exports (patch 1.0.0.5) for names, positions and the internal IDs used by the save import.

## License

Code is [MIT](LICENSE). Game names, data and map imagery belong to Jagex; this is a non-commercial fan project and not affiliated with Jagex.
