# Dragonwilds Completionist

A completion tracker for **RuneScape: Dragonwilds**: every quest, every special recipe unlock and all 21 Sanguine Urns, in one page.

**Live site:** https://frederikstenbergpedersen.github.io/dragonwilds-completionist/

## Features

- **Quests**: all primary, secondary and tertiary quests in the order the map opens up, with where to start each one and its rewards.
- **Recipes**: every recipe unlocked by a vestige or found in a Dragonkin vault, listed by the name shown in your crafting journal, with the full crafting recipe and where to get each ingredient.
- **Urns**: all 21 Sanguine Urns by area, with your max-health bonus.
- **Save import**: load your character's `.json` save and your quests and recipes are ticked automatically. In Chrome or Edge you can link the file once and press **Sync** after each session.
- **Backup codes**: move manual ticks (urns, mounts) between browsers.

Progress is stored in your browser. Your save file is read locally and never uploaded.

## Your save file (PC)

`%LOCALAPPDATA%\RSDragonwilds\Saved\SaveCharacters\<CharacterName>.json`

## Data sources

- [RuneScape: Dragonwilds Wiki](https://dragonwilds.runescape.wiki/) for quests, recipes, vestiges and urns.
- [RSDWArchive](https://github.com/RSDWArchive/RSDWArchive) game-data exports (patch 1.0.0.5) for the internal IDs used by the save import.

Fan-made and not affiliated with Jagex.
