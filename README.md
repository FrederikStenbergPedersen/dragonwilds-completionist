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
| Crafting | All 869 recipes in the crafting journal |
| Building | All 776 building pieces in the build menu (Deluxe Edition pieces excluded) |
| Mounts | The 17 obtainable terrorbird and carpet variants |
| Urns | All 21 Sanguine Urns, on maps of each region |
| Burrows | All 19 kebbit burrows, on maps of each region |
| Map | How many of the world map's 32 regions you've uncovered |
| Lore | All 117 lore scraps, by region and story |
| Gathering | All 87 plant, seed and material journal entries |
| Factions | All 60 enemy journal entries |
| Fauna | All 69 animal and fish journal entries |

Three completion tiers sit on top: **Completionist** (every section except skills, each weighted equally), **Completionist+** (every skill at 94) and **Completionist++** (every skill at 99).

## Spoiler-free

The page doesn't give answers away until you ask. Where a quest starts, its rewards and boss, vestige names, lore locations, agility gold rewards and the urn, burrow and course maps all stay hidden behind **Show hint** / **Show map**. They show by themselves once you've ticked the item (or finished the region's urns, burrows or courses). Each reveal is remembered in your browser.

## Save import

Drop your character save on the page and everything it records is ticked for you. The file is read in your browser and never uploaded.

`%LOCALAPPDATA%\RSDragonwilds\Saved\SaveCharacters\<CharacterName>.json`

Kebbit burrows are the one exception: the save only counts how many you've opened, so you tick which ones on the maps.

Progress is stored in your browser. Backup codes let you move it to another browser.

## Project layout

Plain HTML, CSS and JavaScript with no build step: open `index.html` and it runs.

```
index.html        page layout
style.css         styles
app.js            behaviour: save import, ticking, maps, progress
data/             one file per section (quests, recipes, lore, journal, crafting, ...)
maps/             region map images
tools/            scripts that rebuild data/ from the game files after a patch
tests/            headless smoke test, run on every push
```

After a game patch, see [tools/README.md](tools/README.md) to rebuild the data.

## Data sources

- [RuneScape: Dragonwilds Wiki](https://dragonwilds.runescape.wiki/) for quests, recipes, lore and the world map.
- [RSDWArchive](https://github.com/RSDWArchive/RSDWArchive) game-data exports (patch 1.0.0.5) for names, positions and the internal IDs used by the save import.
- The installed 1.0.1 game files for what patch 1.0.1 added or removed, until RSDWArchive exports that patch.

## License

Code is [MIT](LICENSE). Game names, data and map imagery belong to Jagex; this is a non-commercial fan project and not affiliated with Jagex.
