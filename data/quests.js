// Quests, from the RuneScape: Dragonwilds Wiki (hand-curated). Edit by hand.
const MAIN = [
  { id: "first-steps", n: "First Steps", where: "Temple Woods", start: "Starts automatically on a new character.", rw: ["Tome of Runecrafting"] },
  { id: "getting-started", n: "Getting Started", where: "Temple Woods", start: "Doric, just outside the temple.", rw: ["Vegetable Soup"] },
  { id: "ratcatcher", n: "Ratcatcher", where: "Temple Woods", start: "Vannaka, near the old windmill.", rw: [] },
  { id: "rune-mysteries", n: "Rune Mysteries", where: "Temple Woods", start: "Zanik, on the path to Bramblemead Valley.", rw: [] },
  { id: "dragon-slayer", n: "Dragon Slayer", where: "Brynmoor & Ghornfell", boss: "Velgar", start: "Wise Old Man in Bramblemead Village.", rw: ["Anti-Dragon Shield", "Noxious Draconic Visage"] },
  { id: "withering-heights", n: "Withering Heights", where: "Fellhollow", boss: "Imaru", start: "Wise Old Man near Ashien's Watch.", rw: ["Dragoncurse Shield", "Undead Draconic Visage"] },
  { id: "black-knights-fortress", n: "Black Knight's Fortress", wiki: "Black Knight's Fortress (Quest)", where: "Dowdun Reach", boss: "Black Knight Titan", start: "Death, in the Forgotten Temple.", rw: ["Titan's Wrath", "Maple Toastie"] },
  { id: "icthlarins-little-helper", n: "Icthlarin's Little Helper", where: "Umbral Sands", boss: "Fuzan", start: "Door to the Umbral Sands in The Bastion, then Shangruuh on arrival.", rw: ["Dragonfire Shield", "Smouldering Draconic Visage", "Tome of Volcano", "Magic Carpet mount", "Fight Caves access"] },
  { id: "regicide", n: "Regicide", where: "Scorned Wilderness", boss: "Kuldra", start: "Dragon Gate north-west of Velgar's Rise.", rw: ["Dragonslayer's Cape", "Dragon Kiteshield", "Lougrim Memorial Shrine"] },
];
const TERT = [
  { clan: "Alcarrid clan · Alcarrid Oasis", items: [
    { id: "t-rogue-trader", n: "Rogue Trader", start: "Domri the Merchant. Find three moonstones under gypsum nodes in the west.", rw: ["200 garou chit", "Domri's shop"] },
    { id: "t-mirror-crackd", n: "The Mirror Crack'd", start: "Valas the Blacksmith. Bring 3 adamant bars.", rw: ["200 garou chit"] },
    { id: "t-rag-and-bone", n: "Rag and Bone Garou", start: "Lagra the Butcher. 3 raw farm meat, 3 kalphite shell fragments, 3 cactus steaks.", rw: ["200 garou chit"] },
  ]},
  { clan: "Manafem clan · Manafem Plains", items: [
    { id: "t-song-ancients", n: "Song of the Ancients", start: "Laguna the Bard. Transcribe the garou statues in the vault south of camp.", rw: [] },
    { id: "t-scaling", n: "Scaling Difficulties", start: "Hedric the Hunter. Find the scouts to the east and kill the red dragon.", rw: ["200 garou chit"] },
    { id: "t-beast-sand", n: "Beast in the Sand", start: "Manathep the Bereaved. Bring 1 clean water; track the Dearg Due.", rw: ["200 garou chit"] },
  ]},
  { clan: "Uzzer clan · Dunes of Uzzer", items: [
    { id: "t-dig-site", n: "The Dig Site", start: "Lehran the Archaeologist. Dig up four Forbidden Scrolls in the southern ruins.", rw: ["200 garou chit"] },
    { id: "t-saga", n: "Saga of the Adventurer", start: "Laguna the Bard. Read the statues on the spires around the pyramid.", rw: ["Crucible Engram of Humiliation"] },
    { id: "t-mark-day", n: "Mark Day", start: "Shangruuh. Convince the three councillors to abandon Mark Day.", rw: [] },
  ]},
  { clan: "Finale", items: [
    { id: "t-fuzan-trials", n: "Trials of Fuzan", start: "Repair the mirrors with Icthlarin, then survive 10 waves in the Fight Caves at The Burning Spire.", rw: ["Path to Fuzan's Lair"] },
  ]},
];
const SIDE = [
  { key: "brynmoor", region: "Brynmoor", unlock: "Open from the start", items: [
    { id: "growing-pains", n: "Growing Pains", start: "Wise Old Man in Bramblemead Village. Farming basics.", rw: [] },
    { id: "shrimp-catcher", n: "Shrimp Catcher", start: "Wise Old Man in Bramblemead Village. Fishing basics.", rw: [] },
    { id: "restless-ghosts", n: "Restless Ghosts", start: "Crumbling well in Bramblemead Village.", rw: [] },
    { id: "goblin-diplomacy", n: "Goblin Diplomacy", start: "Zanik in Bramblemead Valley.", rw: ["Goblin War Banner"] },
    { id: "highlighting-the-problem", n: "Highlighting the Problem", start: "Wizard statue in the Runecrafting Guild, Bramblemead Valley.", rw: ["Staff of Light"] },
  ]},
  { key: "ghornfell", region: "Ghornfell", unlock: "Reached during <strong>Dragon Slayer</strong>", items: [
    { id: "granite-mauled", n: "Granite Mauled", start: "Doric in the Fractured Plains.", rw: ["Granite Maul"] },
    { id: "heartstrings", n: "Heartstrings", start: "Memorial on top of the hill in the Fractured Plains.", rw: ["Crystal Bow"] },
    { id: "a-room-with-a-garou", n: "A Room With A Garou", start: "Caratacus in the Fractured Plains.", rw: ["Hanging Tools", "Pots on a Bench", "Sawhorse"] },
    { id: "dog-days", n: "Dog Days", start: "Vannaka at the centre of the Stormtouched Highlands.", rw: ["Garou Highborn's Cloak"] },
    { id: "cooks-assistant", n: "Cook's Assistant", start: "Slopfinger, on the southern border between the Stormtouched Highlands and the Fractured Plains.", rw: ["Victoria Sponge Cake"] },
    { id: "animal-magnetism", n: "Animal Magnetism", start: "Manktongue, on the same border as Slopfinger.", rw: ["Ava's Accumulator"] },
    { id: "a-melody-remembered", n: "A Melody Remembered", start: "Repair the broken music box in a desk in the Stormtouched Highlands.", rw: ["Ravanna's Ring"] },
    { id: "the-great-body-robbery", n: "The Great Body Robbery", start: "Doctor Fenkenstrain in the Bloodblight Swamp.", rw: ["Zombie Arm", "Lightning Rod"] },
  ]},
  { key: "fellhollow", region: "Fellhollow", unlock: "Opens after <strong>Dragon Slayer</strong>", items: [
    { id: "even-more-restless-ghosts", n: "Even More Restless Ghosts", start: "Zanik in Fellhollow.", rw: ["Dorgeshuun Crossbow"] },
    { id: "the-wild-hunt", n: "The Wild Hunt", start: "Vannaka in Bleaksfield Valley.", rw: [] },
    { id: "things-that-go-boom", n: "Things That Go Boom In The Night", start: "Vannaka in Bleaksfield Valley.", rw: ["Spectral Chinchompa Cape"] },
    { id: "seeking-salvation", n: "Seeking Salvation", start: "Doric, in a cave east of the Lake of Lost Souls.", rw: ["Salve Amulet"] },
    { id: "dorics-quest", n: "Doric's Quest", start: "Doric, in the same cave east of the Lake of Lost Souls.", rw: ["Zombie Axe"] },
    { id: "letters-for-the-dead", n: "Letters for the Dead", start: "Postie Pete in the Forgotten Temple.", rw: [] },
    { id: "what-remains-is-written", n: "What Remains is Written", start: "Abraxus The Eternal in Coalridge Pass.", rw: [] },
    { id: "mirror-mirror", n: "Mirror, Mirror", start: "The mirror west of the Guthix shrine near Emberwood.", rw: ["Ulv's Longbow"] },
  ]},
  { key: "dowdun", region: "Dowdun Reach", unlock: "Opens after <strong>Withering Heights</strong>", items: [
    { id: "biohazard", n: "Biohazard", start: "Kill the corrupted raven in The Courtyard and pick up its drop.", rw: ["Zamorak Cape"] },
    { id: "wanted", n: "Wanted!", start: "Vannaka in The Courtyard.", rw: ["Unholy Symbol"] },
    { id: "whats-theirs-is-mine", n: "What's Theirs is Mine!", start: "Doric next to the Dreaming Stone in The Nexus.", rw: ["Zamorak Staff"] },
  ]},
  { key: "umbral", region: "Umbral Sands", unlock: "Opens after <strong>Black Knight's Fortress</strong>", items: [
    { id: "contact", n: "Contact!", start: "Avisk's crystal in the Dunes of Uzzer.", rw: ["Pharaoh's Sceptre"] },
    { id: "brink-of-extinction", n: "Brink of Extinction", start: "Zi at The Burning Spire, south of the Sinking Pyramid.", rw: ["Obsidian Cape"] },
    { id: "mapping-the-sands-i", n: "Mapping The Sands I", start: "Anamcara in Alcarrid Camp. Find Moon Sprites on high points.", rw: [] },
    { id: "mapping-the-sands-ii", n: "Mapping The Sands II", start: "Anamcara again, after part I. Moon Sprites across all of the Umbral Sands.", rw: ["Bow of Elidinis"] },
  ]},
];
const EXTRA = [
  { id: "statues-of-saradomin", n: "Statues of Saradomin", nowiki: false, start: "Statue in Bramblemead Valley, east of Crasorak Kara. Put an opal, a jade and a sapphire in the three Saradomin statues (Whispering Swamp, Fractured Plains, Stormtouched Highlands), then return.", rw: ["Saradominist cloak"] },
  { id: "x-marks-the-spot", n: "Buried treasure", nowiki: true, start: "Fellhollow. Repeatable treasure digs (listed in the game data as \u201cX Marks the Spot\u201d).", rw: [] },
  { id: "fight-caves-full", n: "Fight Caves", wiki: "Fight Cave", start: "Full access after Icthlarin's Little Helper. Clear it for a chance at the fire cape.", rw: ["Fire cape"] },
  { id: "nightmare-crucible", n: "Nightmare Crucible", start: "Full access after Icthlarin's Little Helper. Upgrades weapons to max Power Level.", rw: [] },
  { id: "scorned-raid", n: "Scorned Wilderness raid runs", wiki: "Scorned Wilderness", start: "Start or resume a run with Commander Zilyana at Rasthin's Rest. Repeat runs to earn the Dragon armour and weapons.", rw: ["Dragon armour set", "Dragon Scimitar", "Dragon Crossbow"] },
];
