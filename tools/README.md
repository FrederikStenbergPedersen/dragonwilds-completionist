# Rebuilding the data

Most of the page's data comes straight from the game files, exported by the
[RSDWArchive](https://github.com/RSDWArchive/RSDWArchive) project. When a patch lands,
rebuild it with `build_data.py` instead of editing the data files by hand.

## Which files are generated

| File | Source | How to update |
|---|---|---|
| `data/lore.js` | game journal + `tools/wiki_lore.tsv` | `build_data.py` |
| `data/journal.js` | game journal (plants, factions, fauna) | `build_data.py` |
| `data/crafting.js` | game journal (crafting recipes) | `build_data.py` |
| `data/agility.js` | course data assets | `build_data.py` |
| `data/maps.js` | location data (burrows, course starts) | `build_data.py` |
| `data/quests.js`, `data/recipes.js` | RuneScape: Dragonwilds Wiki | by hand |
| `data/urns.js`, `data/mounts.js`, `data/import.js`, `data/skills.js` | game ids, checked once | by hand |

## 1. Get the archive (sparse checkout)

The full archive is many GB, so check out only what the script reads (about 70 MB):

```sh
git clone --filter=blob:none --no-checkout https://github.com/RSDWArchive/RSDWArchive
cd RSDWArchive
git sparse-checkout set --no-cone --stdin < ../dragonwilds-completionist/tools/archive-paths.txt
git checkout
```

If the new patch lives in a different version folder (for example `1.0.0.6`), edit the
paths in `archive-paths.txt` and pass `--version` below.

## 2. Rebuild

```sh
cd ../dragonwilds-completionist
python3 tools/build_data.py --archive ../RSDWArchive --version 1.0.0.5
git diff --stat data/
```

The script stops with a clear message when the game adds something it doesn't know how
to place yet, such as a new crafting station, a new journal category or a lore scrap
that isn't in the wiki table. Add it to the mapping named in the message and run it again.

`--only lore journal` rebuilds just some files. `--scan-urns` re-reads urn positions
from the world map cells, which are about 2 GB, so it's off by default and the urn
positions already in `data/maps.js` are reused.

## 3. Check it

Run the smoke test (see `tests/README.md`), open `index.html` and import a save.
The map images in `maps/` only need rebuilding if burrows, urns or courses move.
