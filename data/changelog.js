// Site changelog, newest first. Shown in the "What's new" panel and written to CHANGELOG.md by tools/build_changelog.py.
// Keep entries spoiler-free: no boss, region, quest or item names a new player wouldn't know yet.
const CHANGELOG = [
  {
    date: "2026-10-14",
    title: "Game patch 1.0.1 and No spoilers mode",
    items: [
      "Updated for game patch 1.0.1. The game version the site supports now shows under the title.",
      "Added what 1.0.1 brought: a new compost bin, two new skill tomes in two styles, a bigger compost bucket, a new crossbow part and three new lore scraps. All of them import from your save.",
      "Added three quest items that were missing from Crafting, and the two base mounts to the Mounts tab, so it now lists all 19.",
      "Removed a crafting recipe the game has retired.",
      "New No spoilers switch under the title. It hides hints, maps, quest names and regions you haven't reached, and the item tabs only list what you've found. Totals still count the whole game, and Show hint reveals anything early.",
      "Fixed Reset leaving some lore, gathering and factions ticks behind, and unticking those not sticking.",
    ],
  },
  {
    date: "2026-10-11",
    title: "Launch",
    items: [
      "Tracks quests, skills, agility courses, recipes, crafting, building, mounts, urns, kebbit burrows, map regions, lore, gathering, factions and fauna, with three completion tiers on top.",
      "Import your progress from your PC save file, and move it between browsers with a backup code.",
    ],
  },
];
