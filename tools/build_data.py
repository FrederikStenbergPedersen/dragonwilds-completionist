#!/usr/bin/env python3
"""Rebuild the generated data files in data/ from an RSDWArchive checkout.

Usage:
    python3 tools/build_data.py --archive path/to/RSDWArchive [--version 1.0.0.5]

Regenerates:
    data/lore.js      lore scraps (game journal entries joined with the wiki lore table)
    data/journal.js   Plants, Factions and Fauna journal entries
    data/crafting.js  every recipe in the crafting journal
    data/buildings.js every building piece in the build menu
    data/agility.js   agility courses, medal times, requirements, gold rewards
    data/maps.js      kebbit burrow positions and map landmarks (urns, course starts)

Hand-maintained files (quests, recipes, urns, mounts, import ids) are not touched.
See tools/README.md for which parts of the archive need to be checked out.
"""
import argparse, collections, glob, json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


class Archive:
    def __init__(self, root, version):
        self.root = root
        self.json = os.path.join(root, version, "json", "RSDragonwilds")
        if not os.path.isdir(self.json):
            sys.exit(f"Not found: {self.json}")
        self.st = {}
        for f in glob.glob(os.path.join(self.json, "**", "ST_*.json"), recursive=True):
            for o in self.load(f):
                if o.get("Type") == "StringTable":
                    # Text references use the asset name; the namespace inside can differ, so index both.
                    self.st[o["StringTable"]["TableNamespace"]] = o["StringTable"]["KeysToEntries"]
                    self.st[os.path.basename(f)[:-5]] = o["StringTable"]["KeysToEntries"]

    @staticmethod
    def load(f):
        try:
            with open(f, encoding="utf-8") as fh:
                return json.load(fh)
        except (OSError, ValueError):
            return []

    def text(self, x):
        if not isinstance(x, dict):
            return None
        return x.get("LocalizedString") or x.get("SourceString") or \
            self.st.get((x.get("TableId") or "").split(".")[-1], {}).get(x.get("Key"))

    def files(self, pattern):
        return sorted(glob.glob(os.path.join(self.json, pattern), recursive=True))

    def journal_entries(self, type_name):
        """All journal entries of one type, skipping deleted ones: (file, object)."""
        out = []
        for f in self.files("**/JournalData/Entries/**/*.json"):
            if "/Deleted" in f:
                continue
            for o in self.load(f):
                if o.get("Type") == type_name and "PersistenceID" in (o.get("Properties") or {}):
                    out.append((f, o))
        return out


def write_js(name, header, consts):
    body = "\n".join(f"const {k} = {json.dumps(v, ensure_ascii=False, separators=(',', ':'))};" for k, v in consts)
    with open(os.path.join(DATA, name), "w", encoding="utf-8") as fh:
        fh.write(header + "\n" + body + "\n")
    print("wrote data/" + name)


# ---------------------------------------------------------------- lore
LORE_REGIONS = ["Brynmoor & Ghornfell", "Fellhollow", "Dowdun Reach", "Umbral Sands", "Scorned Wilderness"]
# Same game title used twice, or spelled differently from the wiki: pin them to a wiki row.
LORE_PIN = {
    "JOURNAL_Know_CathanJournal_Castle": "Cathan's Journal (Bramblemead Valley)",
    "JOURNAL_Know_CathanJournal_Velgarslair": "Cathan's Journal (Fractured Plains)",
    "JOURNAL_Know_LoreScrap_B3": "Weathered Diary (Bramblemead Valley)",
    "JOURNAL_Know_The_Withering_1": "Weathered Diary (Fellhollow)",
}
# In the game files but not in the wiki table: (region, series, area).
LORE_EXTRA = {
    "JOURNAL_Know_The_Dragonkin_5": ("Fellhollow", "Lacrussa's Writings", ""),
    "JOURNAL_XMarksTheSpot_Intro": ("Fellhollow", "Travellers", "Starts X Marks the Spot"),
}
# Quest texts (statue sagas, songs) and the unobtainable Scarecrow trail never reach the journal.
LORE_SKIP = re.compile(r"CampA_Task1|CampC_Tas3|Scarecrow_")


def build_lore(a):
    with open(os.path.join(HERE, "wiki_lore.tsv"), encoding="utf-8") as fh:
        wiki = [l.rstrip("\n").split("\t") for l in fh][1:]
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower().replace("grimey", "grimy").replace("’", "'"))
    key = lambda t: norm(re.sub(r"\s*\((Bramblemead Valley|Fractured Plains|Fellhollow)\)", "", t))
    by_key = collections.defaultdict(list)
    for i, w in enumerate(wiki):
        by_key[key(w[1])].append((i, w))
    entries = []
    for f, o in a.journal_entries("JournalEntryKnowLoreData"):
        p = o["Properties"]
        folder = f.split("/GameFeatures/")[1].split("/")[0] if "/GameFeatures/" in f else "Base"
        entries.append(dict(t=a.text(p.get("DisplayName")) or o["Name"], pid=p["PersistenceID"], iname=o["Name"], folder=folder))
    entries.sort(key=lambda e: (e["folder"], e["iname"]))
    items = []
    for e in entries:
        if LORE_SKIP.search(e["iname"]):
            continue
        t = e["t"].replace("’", "'")
        w = None
        if e["iname"] in LORE_PIN:
            w = next((i, x) for i, x in enumerate(wiki) if x[1] == LORE_PIN[e["iname"]])
        else:
            c = by_key.get(key(t), [])
            if len(c) == 1:
                w = c[0]
        if w:
            i, (reg, _, ser, area) = w
            order = i
        elif e["iname"] in LORE_EXTRA:
            reg, ser, area = LORE_EXTRA[e["iname"]]
            order = next(i for i, x in enumerate(wiki) if x[2] == ser) + .5
        elif e["folder"] == "ScornedWilderness":
            reg, area = "Scorned Wilderness", ""
            ser = "Main path" if "CriticalPath" in e["iname"] else "Optional"
            order = 1000 + int(re.sub(r"\D", "", e["iname"][-2:]) or 9) + (0 if ser == "Main path" else 20)
        else:
            sys.exit("Lore entry not matched to the wiki table, add it to LORE_PIN or LORE_EXTRA: " + e["iname"])
        sid = slug(re.sub(r"^JOURNAL_(Know_)?", "", e["iname"]))
        items.append(dict(id="l-" + sid, n=t, wk=(w[1][1] if w else t), reg=reg, ser=ser, area=area, pid=e["pid"], o=order))
    items.sort(key=lambda x: (LORE_REGIONS.index(x["reg"]), x["o"]))
    out = []
    for r in LORE_REGIONS:
        groups = []
        for x in items:
            if x["reg"] != r:
                continue
            row = [x["id"], x["n"], x["area"], x["pid"]] + ([x["wk"]] if x["wk"] != x["n"] else [])
            g = next((g for g in groups if g["s"] == x["ser"]), None)
            if not g:
                g = {"s": x["ser"], "i": []}
                groups.append(g)
            g["i"].append(row)
        out.append({"r": r, "g": groups})
    print(f"lore: {len(items)} scraps")
    write_js("lore.js", "// Lore scraps. Generated by tools/build_data.py from RSDWArchive + the wiki lore table. Do not edit by hand.", [("LORE", out)])


# ---------------------------------------------------------------- journal: plants, factions, fauna
FACTION_GROUPS = [("BlackKnight", "Black Knights"), ("Fellhollow", "Fellhollow"), ("Garou", "Garou"), ("Goblin", "Goblins"),
                  ("General_Velgar", "Dragons"), ("Fuzan", "Dragons"), ("SW_Kuldra", "Dragons"), ("LesserDemon", "Demons"),
                  ("Vault", "Vault guardians"), ("Zamorak", "Zamorakians"), ("SW_", "Scorned Wilderness"),
                  ("Kalphite", "Kalphites"), ("KotHaar", "KotHaar")]
FACTION_ORDER = ["Goblins", "Garou", "Black Knights", "Zamorakians", "Demons", "Vault guardians", "Fellhollow",
                 "Kalphites", "KotHaar", "Scorned Wilderness", "Dragons"]


def build_journal(a):
    item_names = {}
    for f in a.files("**/ITEM_*.json"):
        for o in a.load(f):
            p = o.get("Properties") or {}
            if isinstance(p.get("Name"), dict):
                item_names[os.path.basename(f)[:-5]] = a.text(p["Name"])
    rows = []
    for f, o in a.journal_entries("JournalEntryWorldData"):
        m = re.search(r"Entries/(?:World/)?(Flora|Factions|Fauna|Materials)/(\w*)", f)
        if not m:
            continue
        p = o["Properties"]
        u = p.get("UnlockCondition") or {}
        target = None
        for v in u.values():
            if isinstance(v, dict) and "AssetPathName" in v:
                target = v["AssetPathName"].split(".")[-1]
        rows.append(dict(cat=m.group(1), seeds="/Seeds/" in f, fish="/Fishing/" in f, name=o["Name"],
                         t=a.text(p.get("DisplayName")) or o["Name"], ut=(u.get("UnlockType") or "").split("::")[-1],
                         target=target, pid=p["PersistenceID"]))
    rows.sort(key=lambda r: r["t"].lower())

    def jid(r):
        return "j-" + slug(r["name"].replace("JOURNAL_World_", ""))

    plants = collections.OrderedDict([("Plants", []), ("Seeds", []), ("Materials", [])])
    factions = collections.OrderedDict((g, []) for g in FACTION_ORDER)
    fauna = collections.OrderedDict([("Animals", []), ("Fish", [])])
    for r in rows:
        if r["cat"] in ("Flora", "Materials"):
            how = ""
            if r["ut"] == "ItemFirstPickup":
                it = item_names.get(r["target"])
                if it and it != r["t"]:
                    how = "Pick up " + it
            group = "Materials" if r["cat"] == "Materials" else "Seeds" if r["seeds"] else "Plants"
            plants[group].append([jid(r), r["t"], how, r["pid"]])
        elif r["cat"] == "Factions":
            k = r["name"].replace("JOURNAL_World_Factions_", "")
            g = next(g for p, g in FACTION_GROUPS if k.startswith(p))
            factions[g].append([jid(r), r["t"], "Interact" if r["ut"] == "Interaction" else "", r["pid"]])
        else:
            fauna["Fish" if r["fish"] else "Animals"].append([jid(r), r["t"], "", r["pid"]])
    P = [{"r": k, "g": [{"s": "", "i": v}]} for k, v in plants.items()]
    F = [{"r": k, "g": [{"s": "", "i": v}]} for k, v in factions.items()]
    A = [{"r": k, "g": [{"s": "", "i": v}]} for k, v in fauna.items()]
    print(f"journal: {sum(len(v) for v in plants.values())} plants and materials, {sum(len(v) for v in factions.values())} factions, {sum(len(v) for v in fauna.values())} fauna")
    write_js("journal.js", "// Plants (with seeds and materials), Factions and Fauna journal entries. Generated by tools/build_data.py. Do not edit by hand.",
             [("PLANTS", P), ("FACTIONS", F), ("FAUNA", A)])


# ---------------------------------------------------------------- crafting journal
CRAFT_CATEGORY = {"Weapons": "Weapons", "Masterworks": "Weapons", "Armour": "Armour", "Shield": "Armour", "Cape": "Armour",
                  "Tools": "Tools", "Tool": "Tools", "Ammo": "Ammo & runes", "Rune": "Ammo & runes",
                  "Jewelry": "Jewellery & trinkets", "Trinket": "Jewellery & trinkets", "Potion": "Potions", "Potions": "Potions",
                  "Food": "Food", "Drink": "Drinks", "Fish": "Fishing", "FishBait": "Fishing", "Resources": "Materials",
                  "Leather": "Materials", "Scraps": "Materials", "Empty": "Items found"}
CRAFT_ORDER = ["Weapons", "Armour", "Tools", "Ammo & runes", "Jewellery & trinkets", "Potions", "Food", "Drinks", "Fishing", "Materials", "Items found"]
STATIONS = {"ArmourBench": "Armour Bench", "ToolsMeleeBench": "Blacksmith's Bench", "CraftingTable": "Crafting Table",
            "FletchingBenchv2": "Fletching Bench", "BrewingCauldron": "Brewing Cauldron", "MysticForge": "Mystic Forge",
            "Campfire": "Campfire", "JewelersBench": "Jeweler's Bench", "RangeStone": "Range", "RangeBronze": "Range",
            "FermentationBarrel": "Fermentation Barrel", "Kiln": "Kiln", "Grinder": "Grindstone", "Tannery": "Tannery",
            "Spinning Wheel": "Spinning Wheel", "RuneAltar": "Rune Altar", "Loom": "Loom", "Furnace": "Furnace",
            "AdvancedSmelter": "Blast Furnace", "PotteryWheel": "Pottery Wheel", "Sawmill": "Sawmill",
            "Stonecutter": "Stonecutter", "AdvancedTannery": "Advanced Tannery", "Grill": "Grill"}


def build_crafting(a):
    cats = collections.OrderedDict((k, []) for k in CRAFT_ORDER)
    for f, o in a.journal_entries("JournalEntryRecipeData"):
        if not o["Name"].startswith("JOURNAL_Recipes_"):
            continue
        p = o["Properties"]
        prefix = o["Name"].split("_")[2]
        if prefix not in CRAFT_CATEGORY:
            sys.exit("New crafting journal category, add it to CRAFT_CATEGORY: " + o["Name"])
        row = (p.get("StationTableRowHandle") or {}).get("RowName")
        if row and row not in STATIONS:
            sys.exit("New crafting station, add it to STATIONS: " + row)
        cats[CRAFT_CATEGORY[prefix]].append(["c-" + slug(o["Name"].replace("JOURNAL_Recipes_", "")),
                                            a.text(p.get("DisplayName")) or o["Name"], STATIONS.get(row, "") if row else "", p["PersistenceID"]])
    out = []
    for cat, v in cats.items():
        v.sort(key=lambda x: x[1].lower())
        groups = collections.OrderedDict()
        for x in v:
            groups.setdefault(x[2], []).append([x[0], x[1], "", x[3]])
        gl = sorted(groups.items(), key=lambda kv: (kv[0] == "", -len(kv[1])))
        out.append({"r": cat, "g": [{"s": (k or ("No station" if len(gl) > 1 else "")), "i": rows} for k, rows in gl]})
    print(f"crafting: {sum(len(v) for v in cats.values())} recipes")
    write_js("crafting.js", "// Crafting journal recipes. Generated by tools/build_data.py. Do not edit by hand.", [("CRAFTING", out)])


# ---------------------------------------------------------------- building pieces
CATALOGUE = "Content/Gameplay/BaseBuilding_New/BuildingPieces/DA_BuildPieceCatalogue_Default.json"
# Deluxe Edition pieces only exist for owners of that edition, so they are left out.
BUILD_SKIP = re.compile(r"DeluxeEdition")


def asset_file(a, path):
    """/Game/X/Y.Y -> Content/X/Y.json, /Plugin/X/Y.Y -> Plugins/GameFeatures/Plugin/Content/X/Y.json"""
    path = path.split(".")[0]
    root, rest = path.strip("/").split("/", 1)
    rel = "Content/" + rest if root == "Game" else f"Plugins/GameFeatures/{root}/Content/{rest}"
    f = os.path.join(a.json, rel + ".json")
    if os.path.exists(f):
        return f
    # Unreal paths are case-insensitive (the catalogue says BuildPieces, the folder is Buildpieces).
    if not hasattr(a, "_lower"):
        a._lower = {os.path.join(d, n).lower(): os.path.join(d, n) for d, _, ns in os.walk(a.json) for n in ns}
    return a._lower.get(f.lower(), f)


def build_buildings(a):
    cat = a.load(os.path.join(a.json, CATALOGUE))[0]["Properties"]
    out, seen, total = [], set(), 0
    for page in cat["Pages"]:
        groups = []
        for col in page["Collection"]:
            rows = []
            for ref in col["Collection"]:
                path = ref["AssetPathName"]
                name = path.split(".")[-1]
                if BUILD_SKIP.search(name) or name in seen:
                    continue
                objs = a.load(asset_file(a, path))
                if not objs:
                    sys.exit("Building piece file not checked out: " + path)
                p = objs[0]["Properties"]
                n = (a.text(p.get("DisplayName")) or name).strip()
                if n.isupper():
                    n = n.capitalize()
                seen.add(name)
                rows.append(["p-" + slug(re.sub(r"^(BUILDPIECE_|DA_)", "", name)), n, "", p["PersistenceID"]])
            if rows:
                groups.append({"s": a.text(col["Label"]).strip(), "i": rows})
                total += len(rows)
        if groups:
            out.append({"r": a.text(page["Label"]).strip(), "g": groups})
    print(f"buildings: {total} pieces")
    write_js("buildings.js", "// Building pieces, grouped like the in-game build menu. Generated by tools/build_data.py. Do not edit by hand.", [("BUILDINGS", out)])


# ---------------------------------------------------------------- agility courses
COURSE_ORDER = ["Chasm Dash", "Fractured Ruins", "Thunder Assault", "Grave Run", "Tower Climb", "Lava Fields"]
COURSE_WHERE = {"Chasm Dash": "Brynmoor", "Thunder Assault": "Stormtouched Highlands", "Fractured Ruins": "Fractured Plains",
                "Grave Run": "Fellhollow", "Tower Climb": "Dowdun Reach", "Lava Fields": "Umbral Sands"}
PERKS = {"PerkV2_Runecraftng_Windstep": "Windstep", "PerkV2_Agility_DoubleJump": "Double Jump", "PerkV2_Agility_AirDash": "Air Dash"}


def build_agility(a):
    capes = {}
    for f in a.files("**/RegionCapes/**/ITEM_Cape_*_Golden.json"):
        for o in a.load(f):
            p = o.get("Properties") or {}
            if isinstance(p.get("Name"), dict):
                capes[re.search(r"ITEM_Cape_(\w+)_Golden", f).group(1)] = a.text(p["Name"])
    courses = []
    for f in a.files("**/Agility/Content/Gameplay/CourseData/*.json"):
        p = a.load(f)[0]["Properties"]
        t = p["TimeTrialData"]
        # MedalTime leaves out Minutes when it is 1 (the struct default), so a missing value means one minute.
        sec = lambda m: t[m]["MedalTime"].get("Minutes", 1) * 60 + t[m]["MedalTime"].get("Seconds", 0)
        name = a.text(t["DisplayName"])
        cape_keys = [re.search(r"Cape_(\w+)_Golden", r["ObjectName"]).group(1)
                     for r in t["GoldMedal"].get("FirstTimeCourseReward", {}).get("RecipeUnlocks", [])]
        courses.append({"id": "a-" + slug(name), "n": name, "where": COURSE_WHERE[name], "pid": p["PersistenceID"],
                        "g": sec("GoldMedal"), "s": sec("SilverMedal"), "b": sec("BronzeMedal"), "lvl": t.get("MinSkillLevel", 0),
                        "perks": [PERKS[r["AssetPathName"].split(".")[-1]] for r in t.get("RequiredSkills", [])],
                        "cape": [capes.get(k, k) for k in cape_keys]})
    courses.sort(key=lambda c: COURSE_ORDER.index(c["n"]))
    print(f"agility: {len(courses)} courses")
    write_js("agility.js", "// Agility courses. Generated by tools/build_data.py. Do not edit by hand.", [("COURSES", courses)])
    return courses


# ---------------------------------------------------------------- burrows and landmarks
BURROW_REGIONS = [("Common_BM", "Brynmoor"), ("Common_GF", "Ghornfell"), ("Wild_FH", "Fellhollow"),
                  ("Desert_DR", "Dowdun Reach"), ("Desert_UmS", "Umbral Sands")]
# Course starters are unnamed in the location data; matched once by hand from their positions.
COURSE_STARTERS = {"97b8cf150881e67e": "a-chasm-dash", "2ef7317aac5f3fe2": "a-fractured-ruins", "3b77390781dedbe4": "a-thunder-assault",
                   "436997b84803cbb6": "a-grave-run", "26cbae39c7f55e42": "a-tower-climb", "415cc6eabfe72207": "a-lava-fields"}
BURROW_LANDMARKS = {"Brynmoor": ["u-bramblemead", "u-whispering", "a-chasm-dash"],
                    "Ghornfell": ["u-fractured", "u-stormtouched", "u-bloodblight", "a-fractured-ruins", "a-thunder-assault"],
                    "Fellhollow": ["u-emberwood", "u-hope-s-fall", "u-silverthorn", "a-grave-run"],
                    "Dowdun Reach": ["u-the-grand-hall", "u-the-garrison", "u-the-menagerie", "a-tower-climb"],
                    "Umbral Sands": ["u-alcarrid", "u-the-burning-spire", "u-manafem", "a-lava-fields"]}


def read_js_const(name, const):
    with open(os.path.join(DATA, name), encoding="utf-8") as fh:
        s = fh.read()
    m = re.search(r"const " + const + r" = (\{.*?\});\n", s, re.S)
    return json.loads(m.group(1))


def build_maps(a, location_data, scan_urns):
    with open(location_data, encoding="utf-8") as fh:
        loc = json.load(fh)
    pos = lambda v: tuple(float(x) for x in v.split())
    # Urn positions: the shrine actor carries the save-file id, its "Scene" component the position.
    # Scanning needs the world map cells (about 2 GB), so by default the positions already in data/maps.js are reused.
    landmarks = {}
    if not scan_urns:
        landmarks = {k: v for k, v in read_js_const("maps.js", "LANDMARKS").items() if k.startswith("u-")}
    urn_map = read_js_const("urns.js", "URN_MAP")
    by_hex = {v: k for k, v in urn_map.items()}
    for f in (a.files("**/Maps/**/*.json") if scan_urns else []):
        with open(f, encoding="utf-8") as fh:
            raw = fh.read()
        if "UniqueShrineIdentifier" not in raw:
            continue
        objs = json.loads(raw)
        shrines = {o["Name"]: o["Properties"]["UniqueShrineIdentifier"].replace("-", "")
                   for o in objs if (o.get("Properties") or {}).get("UniqueShrineIdentifier")}
        for o in objs:
            if o.get("Name") != "Scene" or "RelativeLocation" not in (o.get("Properties") or {}):
                continue
            outer = json.dumps(o.get("Outer", ""))
            for actor, hx in shrines.items():
                if actor in outer and hx in by_hex:
                    L = o["Properties"]["RelativeLocation"]
                    if L["X"] > -400000:  # Fragments of Ghornfell and Cataclysm Keep sit in their own map space
                        landmarks[by_hex[hx]] = [round(L["X"]), round(L["Y"])]
    for k, v in loc.items():
        m = re.match(r"BP_AgilityCourseStarter_Base_C_([0-9a-f]+)_", k)
        if m and m.group(1) in COURSE_STARTERS:
            x, y, _ = pos(v)
            landmarks[COURSE_STARTERS[m.group(1)]] = [round(x), round(y)]
    out = []
    for key, name in BURROW_REGIONS:
        pts = sorted((pos(v)[:2] for k, v in loc.items() if k.startswith("BP_Agility_Shortcut_KebbitBurrow_" + key)), key=lambda p: (p[1], p[0]))
        ids = [k for k in landmarks if any(k.startswith(p) for p in BURROW_LANDMARKS[name])]
        burrows = []
        for i, p in enumerate(pts):
            near = min(landmarks, key=lambda k: math.dist(p, landmarks[k]))
            if near not in ids:
                ids.append(near)
            burrows.append({"id": f"b-{slug(name)}-{i + 1}", "x": round(p[0]), "y": round(p[1]), "near": near,
                            "m": int(round(math.dist(p, landmarks[near]) / 100, -1))})
        out.append({"r": name, "b": burrows, "l": ids})
    print(f"maps: {sum(len(r['b']) for r in out)} burrows, {len(landmarks)} landmarks")
    write_js("maps.js", "// Kebbit burrow positions and map landmarks (urns, course starts), in game world units. Generated by tools/build_data.py.",
             [("BURROW_MAP", out), ("LANDMARKS", landmarks)])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--archive", required=True, help="path to an RSDWArchive checkout")
    ap.add_argument("--version", default="1.0.0.5", help="game version folder inside the archive")
    ap.add_argument("--only", nargs="*", choices=["lore", "journal", "crafting", "buildings", "agility", "maps"])
    ap.add_argument("--scan-urns", action="store_true", help="re-read urn positions from the world map cells (needs them checked out)")
    args = ap.parse_args()
    a = Archive(args.archive, args.version)
    todo = args.only or ["lore", "journal", "crafting", "buildings", "agility", "maps"]
    if "lore" in todo: build_lore(a)
    if "journal" in todo: build_journal(a)
    if "crafting" in todo: build_crafting(a)
    if "buildings" in todo: build_buildings(a)
    if "agility" in todo: build_agility(a)
    if "maps" in todo: build_maps(a, os.path.join(args.archive, "website", "tools", "LocationData", "LocationData.json"), args.scan_urns)


if __name__ == "__main__":
    main()
