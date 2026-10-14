// Dragonwilds Completionist: page behaviour. Data lives in data/*.js, loaded first by index.html.
"use strict";
const WIKI = "https://dragonwilds.runescape.wiki/w/";
const w = (t) => WIKI + encodeURIComponent(t.replace(/ /g, "_")).replace(/%2C/g, ",");

/* ---------- gear planner data ---------- */
// Where a material comes from. `craft` = recipe; `src` = gather/drop sources.
const ALL_REC = RECIPES.flatMap(g => g.items);
const REC_IDS = ALL_REC.map(r => r.id);



const ALL_Q = [...MAIN, ...TERT.flatMap(c => c.items), ...SIDE.flatMap(s => s.items)];
const ALL_IDS = ALL_Q.map(q => q.id);
const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX"];
const LABEL = { none: "Not started", started: "In progress", done: "Complete" };

let progress = {};
let db = null, user = null, uid = null, canWrite = true, mode = "local", savedIds = [], resetting = false;
const pending = new Set();
const LS_KEY = "dw-quest-progress";
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const stateOf = (id) => { const p = progress[id]; if (!p) return "none"; if (typeof p.medal === "number") return p.medal >= 3 ? "done" : p.medal > 0 ? "started" : "none"; if (typeof p.count === "number") return p.count >= (COUNT_MAX[id] || BURROWS) ? "done" : p.count > 0 ? "started" : "none"; return p.state || (p.done ? "done" : "none"); };
const valBody = (v) => { if (!v) return null; if (typeof v.medal === "number") return v.best ? { medal: v.medal, best: v.best } : { medal: v.medal }; if (typeof v.count === "number") return { count: v.count }; if (typeof v.xp === "number") return { xp: v.xp }; return null; };
try { progress = JSON.parse(lsGet(LS_KEY) || "{}") || {}; } catch { progress = {}; }

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';

/* Spoiler-free by default: anything that gives the answer away (where to go, what you get, maps) sits in .spoil
   and stays hidden until the item is done or the player taps "Show hint" / "Show map". Peeks are remembered per browser. */
const PEEK_KEY = "dw-peek";
let peeks = new Set();
try { peeks = new Set(JSON.parse(lsGet(PEEK_KEY) || "[]")); } catch { peeks = new Set(); }
const savePeeks = () => lsSet(PEEK_KEY, JSON.stringify([...peeks]));
const HINT_BTN = `<button type="button" class="hint-btn" aria-expanded="false">Show hint</button>`;
function mapGate(key, what, svg) {
  if (!svg) return "";
  return `<div class="mapgate" data-gate="map:${key}"><button type="button" class="hint-btn map-btn" aria-expanded="false">Show map</button><span class="gate-note">Shows where ${what}.</span><div class="spoil">${svg}</div></div>`;
}
function paintPeeks() {
  document.querySelectorAll("[data-gate]").forEach(el => {
    const open = peeks.has(el.dataset.gate);
    el.classList.toggle("peek", open);
    const b = el.querySelector(":scope > .hint-btn, :scope .title-row > .hint-btn, :scope .cinfo > .hint-btn");
    if (b) { b.textContent = (open ? "Hide " : "Show ") + (b.classList.contains("map-btn") ? "map" : "hint"); b.setAttribute("aria-expanded", String(open)); }
  });
}
// "Show everything": one switch for players who don't mind spoilers. Remembered per browser.
const showAll = () => document.body.classList.contains("show-all");
function setShowAll(on) {
  document.body.classList.toggle("show-all", on);
  document.getElementById("spoilToggle").checked = !on;
  document.getElementById("spoilNote").textContent = on ? "" : "Hints, maps and anything you haven't reached yet are hidden.";
  // The search boxes' example names are spoilers too.
  document.querySelectorAll(".searchbar input").forEach(i => { i.dataset.ph = i.dataset.ph || i.placeholder; i.placeholder = on ? i.dataset.ph : "Type a full name"; });
  lsSet("dw-spoilers", on ? "shown" : "hidden");
}
// Everything shows by default; "No spoilers" is opt-in.
document.getElementById("spoilToggle").addEventListener("change", (e) => {
  setShowAll(!e.target.checked); paint();
  document.querySelectorAll(".searchbar input").forEach(i => i.dispatchEvent(new Event("input")));
});
setShowAll(lsGet("dw-spoilers") !== "hidden");
/* No spoilers on the item-list tabs (recipes, crafting, building, mounts, gathering, fauna): only what you've found is listed,
   a search finds anything else only by its full name, and each section says how many are left to discover. */
const FOUND_ONLY = ["mounts", "plants", "buildings", "fauna", "crafting", "factions"];
const normQ = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function searchHit(li, q, text, names) {
  if (!q) { li.classList.remove("exact"); return true; }
  const loose = normQ(text).includes(q), exact = names.some(n => normQ(n) === q);
  const foundOnly = !!li.closest(".foundonly, #loreMain") && !showAll() && !li.classList.contains("done");
  li.classList.toggle("exact", foundOnly && exact);
  return foundOnly ? exact : loose;
}
const FOUND_NOUN = { recipes: ["recipe", "recipes"], crafting: ["crafting recipe", "crafting recipes"], buildings: ["building piece", "building pieces"],
  mounts: ["mount", "mounts"], factions: ["enemy", "enemies"], plants: ["plant, seed or material", "plants, seeds and materials"], fauna: ["animal or fish", "animals and fish"] };
function undiscLine(key, n, noun) {
  const el = document.querySelector(`[data-undisc="${key}"]`); if (!el) return;
  el.hidden = !n;
  el.textContent = `${n} more ${n === 1 ? noun[0] : noun[1]} to discover.`;
}
const SEARCH_NOTE = `<p class="search-note">No spoilers is on: type an item's full name to find one you haven't found yet.</p>`;
document.addEventListener("click", (e) => {
  const b = e.target.closest(".hint-btn"); if (!b) return;
  const el = b.closest("[data-gate]"), k = el.dataset.gate;
  if (peeks.has(k)) peeks.delete(k); else peeks.add(k);
  savePeeks(); paint();
});

/* Story gates: which main-story quest opens each part of the quest list. [quest id, "started" | "done"]. */
const OPENS = { ghornfell: ["dragon-slayer", "started"], fellhollow: ["dragon-slayer", "done"], dowdun: ["withering-heights", "done"], umbral: ["black-knights-fortress", "done"], tertiary: ["icthlarins-little-helper", "started"],
  "icthlarin-done": ["icthlarins-little-helper", "done"], scorned: ["regicide", "started"] };
// Beyond the Quests: which story gate each activity sits behind (missing = open from the start).
const EXTRA_OPENS = { "x-marks-the-spot": "fellhollow", "fight-caves-full": "icthlarin-done", "nightmare-crucible": "icthlarin-done", "scorned-raid": "scorned" };
const reached = (id, need) => { const s = stateOf(id); return need === "started" ? s !== "none" : s === "done"; };
const isOpen = (key) => !OPENS[key] || reached(...OPENS[key]);
/* Regions (and region-specific groups) the story hasn't opened are left out entirely, names and all,
   and totals only count what's visible. A region with anything already ticked always shows. */
const REGION_KEY = { "Ghornfell": "ghornfell", "Fractured Plains": "ghornfell", "Stormtouched Highlands": "ghornfell", "Fellhollow": "fellhollow",
  "Dowdun Reach": "dowdun", "Black Knights": "dowdun", "Umbral Sands": "umbral", "Kalphites": "umbral", "KotHaar": "umbral",
  "Scorned Wilderness": "scorned", "Clan quests": "tertiary" };
let REG = null;
function regions() {
  if (REG) return REG;
  const ids = {}, of = {}, add = (r, id) => { if (REGION_KEY[r]) { (ids[r] = ids[r] || []).push(id); of[id] = r; } };
  SIDE.forEach(sd => sd.items.forEach(q => add(sd.region, q.id)));
  TERT.forEach(c => c.items.forEach(t => add("Clan quests", t.id)));
  URN_LIST.forEach(u => add(u.region, u.id));
  BURROW_LIST.forEach(b => add(b.reg, b.id));
  COLLS.forEach(c => c.list.forEach(x => add(x.reg, x.id)));
  COURSES.forEach(c => add(c.where, c.id));
  return (REG = { ids, of });
}
let SEALED = new Set();
// The nameless "N more … waiting" line at the end of each tab, so totals stay honest without naming anything.
const UNDISC = [["quests", ["quest", "quests"], () => ALL_IDS], ["urns", ["urn", "urns"], () => URN_IDS], ["burrows", ["burrow", "burrows"], () => BURROW_IDS],
  ["agility", ["agility course", "agility courses"], () => COURSE_IDS], ["lore", ["lore scrap", "lore scraps"], () => LORE_IDS]];
const undiscHTML = (key) => `<p class="panel undisc" data-undisc="${key}" hidden></p>`;
function computeSealed() {
  SEALED = new Set();
  if (showAll()) return;
  Object.entries(regions().ids).forEach(([r, ids]) => { if (!isOpen(REGION_KEY[r]) && ids.every(id => stateOf(id) === "none")) SEALED.add(r); });
}
function paintStory() {
  // Main story: a quest's name shows once it's started, done, or the next one in line.
  MAIN.forEach((q, i) => document.querySelector(`[data-id="${q.id}"]`).classList.toggle("locked", i > 0 && stateOf(MAIN[i - 1].id) !== "done" && stateOf(q.id) === "none"));
  const lock = (ids, key) => ids.forEach(id => document.querySelector(`[data-id="${id}"]`).classList.toggle("locked", !isOpen(key) && stateOf(id) === "none"));
  computeSealed();
  document.querySelectorAll("[data-region]").forEach(el => el.classList.toggle("sealed", SEALED.has(el.dataset.region)));
  COURSES.forEach(c => { const g = document.querySelector(`.mpt[data-mid="${c.id}"]`); if (g) g.classList.toggle("sealed", SEALED.has(c.where)); });
  UNDISC.forEach(([key, noun, ids]) => {
    const n = ids().filter(id => SEALED.has(regions().of[id])).length, el = document.querySelector(`[data-undisc="${key}"]`);
    if (!el) return;
    el.hidden = !n;
    el.textContent = `${n} more ${n === 1 ? noun[0] : noun[1]} ${n === 1 ? "is" : "are"} waiting in parts of the story you haven't reached yet.`;
  });
  const lh = document.querySelector("#lore-brynmoor-ghornfell h2"); if (lh) lh.textContent = SEALED.has("Ghornfell") ? "Brynmoor" : "Brynmoor & Ghornfell";
  SIDE.forEach(sd => lock(sd.items.map(q => q.id), sd.key));
  EXTRA.forEach(q => { if (EXTRA_OPENS[q.id]) lock([q.id], EXTRA_OPENS[q.id]); });
  document.querySelectorAll(".q.scrap").forEach(li => li.classList.toggle("locked", stateOf(li.dataset.id) !== "done"));
  document.querySelectorAll(".sgate").forEach(el => el.classList.toggle("done", isOpen(el.dataset.gate.slice(4))));
}

function itemHTML(q, kind, step) {
  const rewards = q.rw.length ? `<div class="rewards spoil">${q.rw.map(r => `<span>${esc(r)}</span>`).join("")}</div>` : "";
  const link = q.nowiki ? "" : `<a class="wiki" href="${w(q.wiki || q.n)}" target="_blank" rel="noopener">Wiki</a>`;
  const hasHint = q.start || q.where || q.rw.length || q.boss;
  return `<li class="q ${kind}" data-id="${q.id}" data-gate="${q.id}">
    <button class="mark" type="button" id="m-${q.id}"><span class="d">${CHECK}</span></button>
    <div>
      <div class="title-row">${step ? `<span class="step">${step}</span>` : ""}<span class="name"><span class="real">${esc(q.n)}</span><span class="ph">${kind === "activity" ? "Undiscovered activity" : "Undiscovered quest"}</span></span><span class="status" hidden></span>${q.boss ? `<span class="boss spoil">${esc(q.boss)}</span>` : ""}${link}${hasHint ? HINT_BTN : ""}</div>
      <div class="start spoil">${q.where ? `<strong>${esc(q.where)}</strong> · ` : ""}${esc(q.start)}</div>
      ${rewards}
    </div>
  </li>`;
}

function build() {
  let html = `<section class="panel" id="main-story"><div class="sec-head"><h2>Main Story</h2><span class="count"></span></div><div class="rule"></div>
    <p class="unlock">Strictly in order: each quest needs the one before it, and each opens the next region.</p><ol class="path">`;
  MAIN.forEach((q, i) => {
    html += itemHTML(q, "primary", ROMAN[i]);
    if (q.id === "icthlarins-little-helper") {
      // The clan quests stay out of sight entirely until Icthlarin's Little Helper is started: even their existence is a spoiler.
      html += `<li class="tertiary" data-region="Clan quests"><h3>Tertiary quests in Icthlarin's Little Helper</h3>`;
      TERT.forEach(c => { html += `<div class="clan">${esc(c.clan)}</div><ul class="list">${c.items.map(t => itemHTML(t, "tertiary-q")).join("")}</ul>`; });
      html += `</li>`;
    }
  });
  html += `</ol><p class="empty">Main story complete. Kuldra has fallen.</p></section>`;

  SIDE.forEach(s => {
    html += `<section class="panel" id="${s.key}" data-region="${esc(s.region)}"><div class="sec-head"><h2>${esc(s.region)}</h2><span class="count"></span></div><div class="rule"></div>
      ${OPENS[s.key] ? `<p class="unlock sgate" data-gate="sec:${s.key}"><span class="spoil">${s.unlock}</span><span class="ph">Opens later in the main story.</span> ${HINT_BTN}</p>` : `<p class="unlock">${s.unlock}</p>`}<ul class="list">${s.items.map(q => itemHTML(q, "secondary")).join("")}</ul><p class="empty">Every quest here is complete.</p></section>`;
  });

  html += undiscHTML("quests");
  html += `<section class="panel" id="extra"><div class="sec-head"><h2>Beyond the Quests</h2><span class="count"></span></div><div class="rule"></div>
    <p class="unlock">Activities, bosses and repeatable content that aren't quests. Not counted in the quest total.</p>
    <ul class="list">${EXTRA.map(q => itemHTML(q, "activity")).join("")}</ul></section>`;
  const main = document.getElementById("main");
  main.innerHTML = html;

  const groups = [["main-story", "Main story", MAIN.map(q => q.id).concat(TERT.flatMap(c => c.items.map(t => t.id)))], ...SIDE.map(s => [s.key, s.region, s.items.map(q => q.id)])];
  document.getElementById("jump").innerHTML = groups.map(([k, label]) => `<a class="chip" href="#${k}" data-jump="${k}" data-region="${esc(label)}">${esc(label)} <span></span></a>`).join("") + `<a class="chip" href="#extra">Extras <span id="exChip"></span></a>`;
  window.__groups = groups;

  main.addEventListener("click", (e) => { const b = e.target.closest(".mark"); if (b) cycle(b.closest(".q").dataset.id); });
}

const uslug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const URN_LIST = URNS.flatMap(g => g.areas.flatMap(([a, n]) => Array.from({ length: n }, (_, i) => ({ id: `u-${uslug(a)}-${i + 1}`, n: n > 1 ? `${a} urn ${i + 1}` : `${a} urn`, area: a, region: g.region }))));
const URN_IDS = URN_LIST.map(u => u.id);
const COLLS = [
  { key: "lore", p: "l", tab: "tabLore", data: LORE, status: "Read", kind: "Lore Scrap Read", empty: "Every scrap here is read.", short: { "Brynmoor & Ghornfell": "Brynmoor" }, src: "journal" },
  { key: "mounts", p: "mo", tab: "tabMounts", data: MOUNTS, status: "Unlocked", kind: "Mount Unlocked", empty: "Every mount here is unlocked.", src: "mounts" },
  { key: "plants", p: "pl", tab: "tabPlants", data: PLANTS, status: "Found", kind: "Journal Entry", empty: "Everything here is found.", src: "journal" },
  { key: "factions", p: "fa", tab: "tabFactions", data: FACTIONS, status: "Defeated", kind: "Journal Entry", empty: "Every enemy here is in your journal.", src: "journal" },
  { key: "buildings", p: "bu", tab: "tabBuildings", data: BUILDINGS, status: "Unlocked", kind: "Building Unlocked", empty: "Every piece here is unlocked.", src: "buildings", noWiki: true },
  { key: "fauna", p: "fn", tab: "tabFauna", data: FAUNA, status: "Found", kind: "Journal Entry", empty: "Everything here is in your journal.", src: "journal" },
  { key: "crafting", p: "cr", tab: "tabCrafting", data: CRAFTING, status: "Learned", kind: "Recipe Learned", empty: "Every recipe here is learned.", src: "journal", short: { "Ammo & runes": "Ammo", "Jewellery & trinkets": "Jewellery" } },
];
COLLS.forEach(c => { c.list = c.data.flatMap(r => r.g.flatMap(g => g.i.map(([id, n, sub, pid, wk]) => ({ id, n, sub, pid, wk, reg: r.r, ser: g.s })))); c.ids = c.list.map(x => x.id); });
const COLL_OF = {}; COLLS.forEach(c => c.list.forEach(x => { COLL_OF[x.id] = c; }));
const LORE_LIST = COLLS[0].list, LORE_IDS = COLLS[0].ids, COLL_IDS = COLLS.flatMap(c => c.ids);
const COURSE_IDS = COURSES.map(c => c.id), BURROWS = 19, BUR_ID = "k-burrows", MAP_ID = "k-map", MAP_REGIONS = 32;
const COUNT_MAX = { [BUR_ID]: BURROWS, [MAP_ID]: MAP_REGIONS };
const BURROW_LIST = BURROW_MAP.flatMap(r => r.b.map((b, i) => ({ ...b, n: `${r.r} burrow ${i + 1}`, reg: r.r })));
const BURROW_IDS = BURROW_LIST.map(b => b.id);
const BY_ID = Object.fromEntries([...ALL_Q, ...EXTRA, ...ALL_REC, ...URN_LIST, ...COLLS.flatMap(c => c.list), ...COURSES, ...BURROW_LIST, { id: BUR_ID, n: "Kebbit burrows" }, { id: MAP_ID, n: "Map regions" }].map(q => [q.id, q]));
const SKILL_IDS = ["attack","ranged","magic","mining","woodcutting","fishing","farming","cooking","artisan","construction","runecrafting","agility"].map(k => "s-" + k);
SKILL_IDS.forEach(id => { BY_ID[id] = { id, n: id }; });
function buildUrns() {
  const host = document.getElementById("urnMain");
  const urnMap = (g) => { const pts = g.areas.flatMap(([a, n]) => Array.from({ length: n }, (_, i) => { const id = `u-${uslug(a)}-${i + 1}`, L = LANDMARKS[id]; return L && { id, x: L[0], y: L[1], txt: n > 1 ? i + 1 : "", label: a, cls: "urn", click: true, aria: `${a} urn${n > 1 ? " " + (i + 1) : ""}` }; })).filter(Boolean);
    return pts.length ? mapGate("urns-" + uslug(g.region), `every urn in ${g.region} is`, mapSVG("urns-" + uslug(g.region), `Map of ${g.region} urns`, pts)) : ""; };
  host.innerHTML = URNS.map(g => `<section class="panel" id="urns-${uslug(g.region)}" data-region="${esc(g.region)}"><div class="sec-head"><h2>${esc(g.region)}</h2><span class="count"></span></div><div class="rule"></div>
    ${urnMap(g)}<ul class="list">${g.areas.map(([a, n]) => `<li class="urn-area" data-area="${uslug(a)}"><div><div class="an">${esc(a)}</div><div class="ac"></div></div>
      <div class="umarks">${Array.from({ length: n }, (_, i) => { const id = `u-${uslug(a)}-${i + 1}`; return `<button class="mark umark" type="button" id="m-${id}" data-id="${id}" aria-label="${esc(a)} urn ${i + 1}"><span class="d">${CHECK}</span></button>`; }).join("")}</div></li>`).join("")}</ul>
    <p class="empty">Every urn here is absorbed.</p></section>`).join("") + undiscHTML("urns");
  wireMaps(host);
  host.addEventListener("click", (e) => { const b = e.target.closest(".umark"); if (b) cycle(b.dataset.id); });
}
const lslug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function buildColl(c) {
  const host = document.getElementById(c.key + "Main"), gid = (r, g) => `${c.key}-${lslug(r.r + "-" + g.s)}`, scrap = c.key === "lore";
  if (FOUND_ONLY.includes(c.key)) { host.classList.add("foundonly"); document.getElementById(c.p + "Search").insertAdjacentHTML("afterend", SEARCH_NOTE); }
  host.innerHTML = c.data.map(r => `<section class="panel" id="${c.key}-${lslug(r.r)}" data-region="${esc(r.r)}"><div class="sec-head"><h2>${esc(r.r)}</h2><span class="count"></span></div><div class="rule"></div>
    ${r.g.map(g => `<div class="lgrp" data-lg="${gid(r, g)}">${g.s ? `<div class="lser"><span>${scrap ? `<span class="real">${esc(g.s)}</span><span class="ph">Undiscovered story</span>` : esc(g.s)}</span><span class="lc"></span></div>` : ""}<ul class="list">${g.i.map(([id, n, sub, pid, wk]) => `<li class="q lore${scrap ? " scrap" : ""}" data-id="${id}" data-status="${c.status}" data-gate="${id}">
      <button class="mark" type="button" id="m-${id}"><span class="d">${CHECK}</span></button>
      <div><div class="title-row"><span class="name">${scrap ? `<span class="real">${esc(n)}</span><span class="ph">Unread lore scrap</span>` : esc(n)}</span><span class="status" hidden></span>${c.noWiki ? "" : `<a class="wiki" href="${w(wk || n)}" target="_blank" rel="noopener">Wiki</a>`}${sub || scrap ? HINT_BTN : ""}</div>${sub ? `<div class="start spoil">${esc(sub)}</div>` : ""}</div></li>`).join("")}</ul></div>`).join("")}
    <p class="empty">${esc(c.empty)}</p></section>`).join("") + undiscHTML(c.key);
  document.getElementById(c.p + "Jump").innerHTML = c.data.length > 1 ? c.data.map(r => `<a class="chip" href="#${c.key}-${lslug(r.r)}" data-jump="${c.key}-${lslug(r.r)}" data-region="${esc(r.r)}">${esc((c.short || {})[r.r] || r.r)} <span></span></a>`).join("") : "";
  host.addEventListener("click", (e) => { const b = e.target.closest(".mark"); if (b) cycle(b.closest(".q").dataset.id); });
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const input = document.getElementById(c.p + "Search");
  input.addEventListener("input", () => {
    const q = norm(input.value); let any = false;
    c.data.forEach(r => {
      let rh = 0;
      r.g.forEach(g => {
        let gh = 0;
        g.i.forEach(([id, n, sub]) => { const li = host.querySelector(`[data-id="${id}"]`), ok = searchHit(li, q, `${n} ${sub} ${g.s}`, [n]); li.classList.toggle("nomatch", !ok); if (ok) gh++; });
        host.querySelector(`[data-lg="${gid(r, g)}"]`).classList.toggle("nomatch", !gh); rh += gh;
      });
      document.getElementById(`${c.key}-${lslug(r.r)}`).classList.toggle("nomatch", !rh); if (rh) any = true;
    });
    document.getElementById(c.p + "No").hidden = any;
  });
}
function paintColl(c) {
  const ids = c.ids, d = ids.filter(id => stateOf(id) === "done").length;
  if (FOUND_ONLY.includes(c.key)) undiscLine(c.key, ids.length - d, FOUND_NOUN[c.key]); // one line for everything still to find
  document.getElementById(c.p + "Done").textContent = d;
  document.getElementById(c.p + "Total").textContent = ids.length;
  document.getElementById(c.p + "Bar").style.width = (100 * d / ids.length) + "%";
  c.data.forEach(r => {
    let rd = 0, rt = 0;
    r.g.forEach(g => {
      const gd = g.i.filter(([id]) => stateOf(id) === "done").length; rd += gd; rt += g.i.length;
      const el = document.querySelector(`[data-lg="${c.key}-${lslug(r.r + "-" + g.s)}"]`);
      const lc = el.querySelector(".lc"); if (lc) lc.textContent = `${gd} / ${g.i.length}`;
      el.classList.toggle("all-done", gd === g.i.length);
    });
    const sec = document.getElementById(`${c.key}-${lslug(r.r)}`);
    sec.querySelector(".count").textContent = `${rd} / ${rt}`;
    if (FOUND_ONLY.includes(c.key)) { const ch = document.querySelector(`[data-jump="${c.key}-${lslug(r.r)}"]`); if (ch) ch.classList.toggle("nofound", !rd); }
    sec.classList.toggle("all-done", rd === rt);
    const a = document.querySelector(`[data-jump="${c.key}-${lslug(r.r)}"]`);
    if (a) { a.querySelector("span").textContent = `${rd}/${rt}`; a.classList.toggle("full", rd === rt); }
  });
}
const fmtT = (sec) => { const m = Math.floor(sec / 60), s2 = sec - m * 60; return `${m}:${s2 < 10 ? "0" : ""}${(Math.round(s2 * 10) / 10).toFixed(Number.isInteger(sec) ? 0 : 1)}`; };
const MEDALS = [["b", "Bronze", ""], ["s", "Silver", "silver"], ["g", "Gold", "goldm"]];
function buildAgility() {
  const cm = document.getElementById("courseMap");
  cm.innerHTML = mapGate("agility-courses", "every course starts", mapSVG("agility-courses", "Map of agility courses", COURSES.map(c => ({ id: c.id, x: LANDMARKS[c.id][0], y: LANDMARKS[c.id][1], label: c.n, cls: "crs" })), { minSpan: 0 }));
  wireMaps(cm);
  document.getElementById("courseList").innerHTML = COURSES.map(c => `<li class="course" data-cid="${c.id}" data-gate="${c.id}" data-region="${esc(c.where)}">
    <div class="cinfo"><div class="cn">${esc(c.n)}</div><div class="cw">${esc(c.where)}</div>
      <div class="creq">${c.lvl || c.perks.length ? "Needs " + [c.lvl ? `Agility ${c.lvl}` : "", ...c.perks].filter(Boolean).map(esc).join(" · ") : "No requirements"}</div>
      <div class="crw spoil">Gold reward: <b>${c.cape.map(esc).join("</b> and <b>")}</b> recipe</div>${HINT_BTN}
      <div class="cbest"></div></div>
    <div class="medals">${MEDALS.map(([k, nm, cls], i) => `<button type="button" class="medal ${cls}" data-m="${i + 1}" aria-label="${esc(c.n)}: ${nm} medal, ${fmtT(c[k])} or faster"><span class="coin">${nm[0]}</span>${fmtT(c[k])}</button>`).join("")}</div></li>`).join("");
  document.getElementById("courseList").insertAdjacentHTML("afterend", `<p class="undisc" data-undisc="agility" hidden></p>`);
  document.getElementById("courseList").addEventListener("click", (e) => {
    const b = e.target.closest(".medal"); if (!b || b.disabled) return;
    const id = b.closest(".course").dataset.cid, m = Number(b.dataset.m), p = progress[id] || {}, cur = p.medal || 0;
    setVal(id, { medal: cur === m ? m - 1 : m, ...(p.best ? { best: p.best } : {}) });
    if (m === 3 && cur !== 3) showBanner({ id, n: BY_ID[id].n, rw: BY_ID[id].cape });
  });
  buildBurrows();
}
const DIRS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
const dirOf = (dx, dy) => DIRS[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
function lmName(id) { const o = BY_ID[id]; return id.startsWith("u-") ? o.n : `the ${o.n} course start`; }
/* Map backgrounds: stitched from the RuneScape: Dragonwilds Wiki map (maps/<key>.jpg), sized to each SVG's viewBox at 2x. */
function mapSVG(key, title, pts, opt = {}) {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const minSpan = opt.minSpan || 30000;
  if (x1 - x0 < minSpan) { const c = (x0 + x1) / 2; x0 = c - minSpan / 2; x1 = c + minSpan / 2; }
  if (y1 - y0 < minSpan * 0.6) { const c = (y0 + y1) / 2; y0 = c - minSpan * 0.3; y1 = c + minSpan * 0.3; }
  const W = 380, padX = (x1 - x0) * 0.1 + 5000, padY = (y1 - y0) * 0.1 + 5000;
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY + (x1 - x0) * 0.03;
  const k = W / (x1 - x0), H = Math.max(170, Math.round((y1 - y0) * k)), cy = (H - (y1 - y0) * k) / 2;
  const P = (x, y) => [+((x - x0) * k).toFixed(1), +((y - y0) * k + cy).toFixed(1)];
  const step = [500, 1000, 2000, 5000, 10000, 20000].find(m => m * 100 * k > 60) || 20000, sw = step * 100 * k;
  const boxes = pts.map(p => { const [px, py] = P(p.x, p.y); return [px - 11, py - 11, px + 11, py + 11]; });
  const hit = (q) => boxes.some(o => q[0] < o[2] && q[2] > o[0] && q[1] < o[3] && q[3] > o[1]);
  const marks = pts.map(p => {
    const [px, py] = P(p.x, p.y);
    let lab = "";
    if (p.label) {
      const tw = p.label.length * 5.6; let best = null;
      for (const dy of [0, -12, 12, -22, 22]) for (const right of [true, false]) {
        const x = right ? px + 13 : px - 13, q = right ? [x, py + dy - 8, x + tw, py + dy + 3] : [x - tw, py + dy - 8, x, py + dy + 3];
        if (q[0] < 2 || q[2] > W - 2) continue;
        if (!hit(q)) { best = { x, y: py + dy + 3.5, right, q }; break; }
      }
      if (!best) { const right = px < W / 2; best = { x: right ? px + 13 : px - 13, y: py + 3.5, right, q: [0, 0, 0, 0] }; }
      boxes.push(best.q);
      lab = `<text class="ml" x="${best.x}" y="${best.y}" text-anchor="${best.right ? "start" : "end"}">${esc(p.label)}</text>`;
    }
    return `<g class="mpt ${p.cls || ""}" data-mid="${p.id}"${p.click ? ` role="button" aria-label="${esc(p.aria || p.label || p.id)}"` : ""}><rect x="${px - 9}" y="${py - 9}" width="18" height="18" rx="3" transform="rotate(45 ${px} ${py})"/><text x="${px}" y="${py}">${esc(p.txt || "")}</text>${lab}</g>`;
  }).join("");
  return `<svg class="bmap" viewBox="0 0 ${W} ${H}" aria-label="${esc(title)}" data-map="${key}" data-geo="${x0.toFixed(1)},${y0.toFixed(1)},${k.toExponential(6)},${cy.toFixed(2)},${W},${H}"><image class="tile" href="maps/${key}.jpg" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/><rect class="shade" width="${W}" height="${H}"/>${marks}<g class="scale"><line x1="12" y1="${H - 14}" x2="${(12 + sw).toFixed(1)}" y2="${H - 14}"/><text x="12" y="${H - 20}">${step >= 1000 ? step / 1000 + " km" : step + " m"}</text></g></svg>
      <p class="mapcredit">Map: <a href="https://dragonwilds.runescape.wiki/w/Map" target="_blank" rel="noopener">RuneScape: Dragonwilds Wiki</a></p>`;
}
function wireMaps(host) {
  host.querySelectorAll("image.tile").forEach(im => {
    im.addEventListener("load", () => im.closest("svg").classList.add("has-map"), { once: true });
    im.addEventListener("error", () => im.remove(), { once: true });
  });
  host.addEventListener("click", (e) => {
    const g = e.target.closest(".mpt[role=button]"); if (g && canWrite) cycle(g.dataset.mid);
  });
}
function paintMaps() {
  document.querySelectorAll(".mpt").forEach(g => g.classList.toggle("on", stateOf(g.dataset.mid) === "done"));
}
function buildBurrows() {
  const host = document.getElementById("burMain");
  host.innerHTML = BURROW_MAP.map(r => {
    const rows = r.b.map((b, i) => { const L = LANDMARKS[b.near];
      return `<li class="q burrow" data-id="${b.id}"><button class="mark" type="button" id="m-${b.id}"><span class="d">${CHECK}</span></button><div><div class="title-row"><span class="name">Burrow ${i + 1}</span><span class="status" hidden></span></div></div></li>`; }).join("");
    return `<section class="panel" id="bur-${lslug(r.r)}" data-region="${esc(r.r)}"><div class="sec-head"><h2>${esc(r.r)}</h2><span class="count"></span></div><div class="rule"></div>
      ${mapGate("burrows-" + lslug(r.r), `every burrow in ${r.r} is`, mapSVG("burrows-" + lslug(r.r), `Map of ${r.r} burrows`, r.b.map((b, i) => ({ id: b.id, x: b.x, y: b.y, txt: i + 1, cls: "bur", click: true, aria: `${r.r} burrow ${i + 1}` }))))}
      <ul class="list">${rows}</ul><p class="empty">Every burrow here is ticked.</p></section>`;
  }).join("") + undiscHTML("burrows");
  wireMaps(host);
  host.addEventListener("click", (e) => { const m = e.target.closest(".mark"); if (m) cycle(m.closest(".q").dataset.id); });
}
const burTicked = () => BURROW_IDS.filter(id => stateOf(id) === "done").length;
const burDone = () => Math.min(BURROWS, Math.max(burCount(), burTicked()));
const countOf = (id) => { const p = progress[id]; return p && typeof p.count === "number" ? p.count : 0; };
const burCount = () => countOf(BUR_ID);
const medalSum = () => COURSE_IDS.reduce((a, id) => a + Math.min(3, medalOf(id)), 0);
const medalOf = (id) => { const p = progress[id]; return p && typeof p.medal === "number" ? p.medal : 0; };
async function setVal(id, body) {
  progress[id] = { ...body, at: Date.now() };
  paint();
  if (mode === "local") { lsSet(LS_KEY, JSON.stringify(progress)); return; }
  pending.add(id);
  try { await myCol().doc(id).set({ ...body, at: Date.now() }); }
  catch (e) { if (e && e.code === "invalid_argument") goLocal("<b>Your log</b> · saved in this browser"); else setSync("That change didn't save. Check your connection and try again."); }
  finally { pending.delete(id); }
}
function paintAgility() {
  let gold = 0;
  COURSES.forEach(c => {
    const li = document.querySelector(`[data-cid="${c.id}"]`), m = medalOf(c.id), best = (progress[c.id] || {}).best;
    if (m >= 3) gold++;
    li.classList.toggle("gold", m >= 3);
    li.querySelectorAll(".medal").forEach(b => { const on = Number(b.dataset.m) <= m; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.disabled = !canWrite; });
    li.querySelector(".cbest").textContent = best ? `Your best: ${fmtT(best)}${m >= 3 ? "" : ` · ${fmtT(Math.max(0, best - c.g))} off gold`}` : "";
  });
  const bs = burCount(), bt = burTicked(), bT = BURROW_IDS.length, bc = Math.min(bT, burDone());
  const ms = medalSum(), oc = COURSE_IDS.length;
  document.getElementById("aGold").textContent = ms;
  document.getElementById("aGoldT").textContent = oc * 3;
  document.getElementById("aBur").textContent = bc;
  document.getElementById("aBurT").textContent = bT;
  document.getElementById("aGoldBar").style.width = (100 * ms / (oc * 3)) + "%";
  document.getElementById("aBurBar").style.width = (100 * bc / bT) + "%";
  const ci = document.querySelector("#agCourses .count"); ci.textContent = `${gold} / ${oc} gold`;
  document.getElementById("burSave").textContent = (progress[BUR_ID] ? `Opened in game: ${bs} · ` : "") + `Ticked on the maps: ${bt}` + (bs > bt ? ` · ${bs - bt} still to tick` : "");
  BURROW_MAP.forEach(r => {
    const d = r.b.filter(b => stateOf(b.id) === "done").length, sec = document.getElementById("bur-" + lslug(r.r));
    sec.querySelector(".count").textContent = `${d} / ${r.b.length}`; sec.classList.toggle("all-done", d === r.b.length);
  });
}
function paintMap() {
  const n = countOf(MAP_ID);
  document.getElementById("mapDone").textContent = n;
  document.getElementById("mapBar").style.width = (100 * n / MAP_REGIONS) + "%";
}
function paintUrns() {
  const uv = URN_IDS, d = uv.filter(id => stateOf(id) === "done").length;
  document.getElementById("uDone").textContent = d;
  document.getElementById("uTotal").textContent = uv.length;
  document.getElementById("uBar").style.width = (100 * d / uv.length) + "%";
  document.getElementById("uHp").textContent = `+${d * 10}`;
  document.querySelectorAll(".umark").forEach(b => {
    const on = stateOf(b.dataset.id) === "done";
    b.classList.toggle("on", on); b.disabled = !canWrite;
    b.setAttribute("aria-pressed", String(on));
  });
  URNS.forEach(g => {
    let rd = 0, rt = 0;
    g.areas.forEach(([a, n]) => {
      const ids = Array.from({ length: n }, (_, i) => `u-${uslug(a)}-${i + 1}`);
      const ad = ids.filter(id => stateOf(id) === "done").length;
      rd += ad; rt += n;
      const row = document.querySelector(`[data-area="${uslug(a)}"]`);
      row.querySelector(".ac").textContent = `${ad} of ${n} absorbed`;
      row.classList.toggle("all-done", ad === n);
    });
    const sec = document.getElementById("urns-" + uslug(g.region));
    sec.querySelector(".count").textContent = `${rd} / ${rt}`;
    sec.classList.toggle("all-done", rd === rt);
  });
}
function analyzeSave(data) {
  const gp = data && data.GameProgress;
  if (!gp || !gp.Progress || !gp.QuestProgress) return null;
  const unlocked = new Set(gp.Progress.RecipesUnlocked || []);
  const qs = {}; (gp.QuestProgress.Quests || []).forEach(q => { qs[q.QuestId] = q.QuestState; });
  const rank = { none: 0, started: 1, done: 2 };
  const ups = [];
  Object.entries(IMPORT_MAP.q).forEach(([id, pids]) => {
    if (!BY_ID[id]) return;
    const best = Math.max(-1, ...pids.map(p => (qs[p] === undefined ? -1 : qs[p])));
    const st = best === 2 ? "done" : best === 1 ? "started" : null;
    if (st && rank[st] > rank[stateOf(id)]) ups.push({ id, state: st, kind: id.startsWith("r-") ? "r" : "q" });
  });
  const shrines = new Set(gp.Progress.ShrinesUnlocked || []);
  Object.entries(URN_MAP).forEach(([id, sid]) => {
    if (BY_ID[id] && stateOf(id) !== "done" && shrines.has(sid)) ups.push({ id, state: "done", kind: "u" });
  });
  const journal = new Set((gp.Journal && gp.Journal.UnlockedEntries) || []);
  const mounts = new Set((((gp.Character || {}).Mount || {}).MountsUnlockedList || []).map(m => String(m).split(":").pop()));
  const builds = new Set(gp.Progress.BuildingsUnlocked || []);
  const srcSet = { mounts, buildings: builds, journal };
  COLLS.forEach(c => c.list.forEach(l => { if (stateOf(l.id) !== "done" && srcSet[c.src].has(l.pid)) ups.push({ id: l.id, state: "done", kind: c.key }); }));
  const runs = {}; (gp.Progress.AgilityCourseScores || []).forEach(r => { const o = runs[r.CourseID] || (runs[r.CourseID] = { m: 0, t: 0 }); o.m = Math.max(o.m, r.HighestUnlockedMedal || 0); if (r.PersonalBestCompletionTime > 0) o.t = o.t ? Math.min(o.t, r.PersonalBestCompletionTime) : r.PersonalBestCompletionTime; });
  COURSES.forEach(c => { const r = runs[c.pid]; if (!r) return; const p = progress[c.id] || {}, best = r.t ? Math.round(r.t * 10) / 10 : 0;
    const nb = best && (!p.best || best < p.best) ? best : p.best || 0, nm = Math.max(r.m, p.medal || 0);
    if (nm > (p.medal || 0) || nb !== (p.best || 0)) ups.push({ id: c.id, body: nb ? { medal: nm, best: nb } : { medal: nm }, kind: "a", gold: nm >= 3 && (p.medal || 0) < 3 }); });
  const nbur = Math.min(BURROWS, ((gp.Progress.KebbitBurrowsActivated) || []).length);
  if (nbur > burCount()) ups.push({ id: BUR_ID, body: { count: nbur }, kind: "k", n: nbur - burCount() });
  let bits = Number((gp.RevealedFog || {}).RevealedRegionsBitmap) >>> 0, nmap = 0;
  while (bits) { nmap += bits & 1; bits >>>= 1; }
  nmap = Math.min(MAP_REGIONS, nmap);
  if (nmap > countOf(MAP_ID)) ups.push({ id: MAP_ID, body: { count: nmap }, kind: "map" });
  const sxp = {}; ((gp.Skills && gp.Skills.Skills) || []).forEach(sk => { sxp[sk.Id] = sk.Xp; });
  SKILLS.forEach(sk => { const xp = sxp[sk.pid]; if (typeof xp === "number" && xp > xpOf(sk.id)) ups.push({ id: sk.id, xp, kind: "s" }); });
  Object.entries(IMPORT_MAP.r).forEach(([id, pids]) => {
    if (BY_ID[id] && stateOf(id) !== "done" && pids.some(p => unlocked.has(p))) ups.push({ id, state: "done", kind: "r" });
  });
  return { name: (data.meta_data && data.meta_data.char_name) || "your character", ups };
}
function setImp(html) { document.getElementById("impResult").innerHTML = html; }
document.getElementById("copyPath").addEventListener("click", () => {
  const t = document.getElementById("savePath").textContent;
  const done = () => { document.getElementById("copyPath").textContent = "Copied"; };
  try { navigator.clipboard.writeText(t).then(done, () => { const r = document.createRange(); r.selectNodeContents(document.getElementById("savePath")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }); } catch {}
});
function readFile(f, auto) {
  const rd = new FileReader();
  rd.onload = () => handleSaveText(rd.result, auto);
  rd.onerror = () => setImp(`<span class="err">Couldn't read that file. Try picking it again.</span>`);
  rd.readAsText(f);
}
document.getElementById("saveFile").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  e.target.value = "";
  readFile(f, false);
});
function handleSaveText(text, auto) {
  {
    let data = null; try { data = JSON.parse(text); } catch {}
    const res = data && analyzeSave(data);
    document.getElementById("importer").open = true;
    if (!res) return setImp(`<span class="err">That doesn't look like a Dragonwilds character file. Pick the .json named after your character in the SaveCharacters folder, not a .backup file or a world .sav.</span>`);
    const nq = res.ups.filter(u => u.kind === "q" && u.state === "done").length;
    const ns = res.ups.filter(u => u.kind === "q" && u.state === "started").length;
    const nr = res.ups.filter(u => u.kind === "r").length;
    const nu = res.ups.filter(u => u.kind === "u").length;
    const ns2 = res.ups.filter(u => u.kind === "s").length;
    const nl = res.ups.filter(u => u.kind === "lore").length, nmo = res.ups.filter(u => u.kind === "mounts").length, npl = res.ups.filter(u => u.kind === "plants").length, nfa = res.ups.filter(u => u.kind === "factions").length, nfn = res.ups.filter(u => u.kind === "fauna").length, nbu = res.ups.filter(u => u.kind === "buildings").length, nmp = (res.ups.find(u => u.kind === "map") || {}).body, ncr = res.ups.filter(u => u.kind === "crafting").length;
    const na = res.ups.filter(u => u.kind === "a").length, ng = res.ups.filter(u => u.kind === "a" && u.gold).length;
    const nk = (res.ups.find(u => u.kind === "k") || {}).n || 0;
    if (!res.ups.length) return setImp(`<div class="who">${esc(res.name)}</div><p>Your log is already up to date with this save.</p>`);
    setImp(`<div class="who">${esc(res.name)}</div><p>Found new progress to add:</p><ul>
      ${nq ? `<li>${nq} quest${nq > 1 ? "s" : ""} completed</li>` : ""}${ns ? `<li>${ns} quest${ns > 1 ? "s" : ""} in progress</li>` : ""}${nr ? `<li>${nr} recipe${nr > 1 ? "s" : ""} unlocked</li>` : ""}${nu ? `<li>${nu} Sanguine Urn${nu > 1 ? "s" : ""} absorbed</li>` : ""}${nl ? `<li>${nl} lore scrap${nl > 1 ? "s" : ""} read</li>` : ""}${nmo ? `<li>${nmo} mount${nmo > 1 ? "s" : ""} unlocked</li>` : ""}${npl ? `<li>${npl} plants, seeds and materials found</li>` : ""}${nfa ? `<li>${nfa} enem${nfa > 1 ? "ies" : "y"} added to your journal</li>` : ""}${nfn ? `<li>${nfn} animal${nfn > 1 ? "s" : ""} and fish found</li>` : ""}${nbu ? `<li>${nbu} building piece${nbu > 1 ? "s" : ""} unlocked</li>` : ""}${nmp ? `<li>${nmp.count} of ${MAP_REGIONS} map regions uncovered</li>` : ""}${ncr ? `<li>${ncr} crafting recipe${ncr > 1 ? "s" : ""} learned</li>` : ""}${na ? `<li>${na} agility course${na > 1 ? "s" : ""} updated${ng ? `, ${ng} new gold` : ""}</li>` : ""}${nk ? `<li>${nk} kebbit burrow${nk > 1 ? "s" : ""} opened</li>` : ""}${ns2 ? `<li>${ns2} skill level${ns2 > 1 ? "s" : ""} updated</li>` : ""}</ul>
      <div class="row2"><button type="button" class="chip" id="impApply" aria-pressed="true">Add to my log</button><button type="button" class="chip" id="impCancel">Cancel</button></div>`);
    document.getElementById("impCancel").onclick = () => setImp("");
    document.getElementById("impApply").onclick = () => applyImport(res);
    if (auto) applyImport(res);
  }
}
/* drag and drop anywhere */
let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
window.addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; document.body.classList.add("dragging"); });
window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove("dragging"); });
window.addEventListener("drop", (e) => {
  if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; document.body.classList.remove("dragging");
  const f = e.dataTransfer.files[0]; if (f) readFile(f, false);
});
/* remembered file (File System Access API, Chrome/Edge) */
async function applyImport(res) {
  const now = Date.now();
  const bodyOf = (u) => u.body ? { ...u.body, at: now } : typeof u.xp === "number" ? { xp: u.xp, at: now } : { state: u.state, at: now };
  res.ups.forEach(u => { progress[u.id] = bodyOf(u); });
  paint();
  if (mode === "local") { lsSet(LS_KEY, JSON.stringify(progress)); return setImp(`<div class="who">Imported</div><p>${res.ups.length} updates added and saved in this browser.</p>`); }
  let n = 0, failed = 0;
  const bkeys = [...new Set(res.ups.map(u => BUNDLE_OF(u.id)).filter(Boolean))];
  bkeys.forEach(k => holdB.add(k));
  res.ups.forEach(u => { if (!BUNDLE_OF(u.id)) pending.add(u.id); });
  for (const k of bkeys) {
    try { await saveBundle(k); }
    catch (e) { failed += res.ups.filter(u => BUNDLE_OF(u.id) === k).length; if (e && e.code === "invalid_argument") { bkeys.forEach(x => holdB.delete(x)); res.ups.forEach(u => pending.delete(u.id)); goLocal("<b>Your log</b> · saved in this browser"); break; } }
    holdB.delete(k);
  }
  if (mode === "local") return setImp(`<div class="who">Imported</div><p>${res.ups.length} updates added and saved in this browser.</p>`);
  const singles = res.ups.filter(u => !BUNDLE_OF(u.id));
  n = res.ups.length - singles.length;
  for (const u of singles) {
    pending.add(u.id);
    try { await myCol().doc(u.id).set(bodyOf(u)); }
    catch (e) { failed++; if (e && e.code === "invalid_argument") { goLocal("<b>Your log</b> · saved in this browser"); pending.delete(u.id); break; } }
    pending.delete(u.id); n++;
    if (n % 5 === 0) setImp(`<div class="who">Importing…</div><p>Saved ${n} of ${res.ups.length}.</p>`);
  }
  singles.forEach(u => pending.delete(u.id));
  setImp(failed ? `<div class="who">Imported with gaps</div><p>${failed} updates didn't save. Import the file again to retry them.</p>`
    : `<div class="who">Imported</div><p>${res.ups.length} updates added to your log.</p>`);
}
/* backup code: base64 of {v:1, p:{id:state}} */
function makeBackup() {
  const p = {}; Object.entries(progress).forEach(([id, v]) => {
    if (!v || !BY_ID[id]) return;
    if (typeof v.xp === "number") { p[id] = { x: v.xp }; return; }
    if (typeof v.medal === "number") { p[id] = v.best ? { m: v.medal, b: v.best } : { m: v.medal }; return; }
    if (typeof v.count === "number") { p[id] = { c: v.count }; return; }
    const st = v.state || (v.done ? "done" : null); if (st) p[id] = st === "done" ? 2 : 1;
  });
  return "DWC1." + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, p }))));
}
function readBackup(code) {
  try { const t = code.trim(); if (!t.startsWith("DWC1.")) return null; const o = JSON.parse(decodeURIComponent(escape(atob(t.slice(5))))); return o && o.p ? o.p : null; } catch { return null; }
}
document.getElementById("bkMake").addEventListener("click", () => {
  const out = document.getElementById("bkOut"); out.value = makeBackup(); out.hidden = false; out.select();
  document.getElementById("bkCopy").hidden = false;
});
document.getElementById("bkCopy").addEventListener("click", () => {
  const out = document.getElementById("bkOut");
  try { navigator.clipboard.writeText(out.value).then(() => { document.getElementById("bkCopy").textContent = "Copied"; }, () => out.select()); } catch { out.select(); }
});
document.getElementById("bkApply").addEventListener("click", () => {
  const p = readBackup(document.getElementById("bkIn").value), msg = document.getElementById("bkMsg");
  if (!p) { msg.textContent = "That code isn't valid. Copy the whole code, starting with DWC1."; return; }
  const rank = { none: 0, started: 1, done: 2 };
  const ups = Object.entries(p).filter(([id]) => BY_ID[id]).map(([id, n]) => {
      if (n && typeof n === "object") {
        if (typeof n.x === "number") return { id, xp: n.x, kind: "s" };
        if (typeof n.m === "number") return (n.m > medalOf(id) || (n.b && (!(progress[id] || {}).best || n.b < progress[id].best))) ? { id, body: { medal: Math.max(n.m, medalOf(id)), ...(n.b ? { best: Math.min(n.b, (progress[id] || {}).best || Infinity) } : {}) }, kind: "a" } : null;
        if (typeof n.c === "number") return n.c > countOf(id) ? { id, body: { count: Math.min(COUNT_MAX[id] || BURROWS, n.c) }, kind: "k" } : null;
        return null;
      }
      return { id, state: n === 2 ? "done" : "started", kind: "b" };
    }).filter(u => u && (u.body ? true : typeof u.xp === "number" ? u.xp > xpOf(u.id) : rank[u.state] > rank[stateOf(u.id)]));
  if (!ups.length) { msg.textContent = "Nothing new in that code; you're already up to date."; return; }
  applyImport({ ups }).then(() => { msg.textContent = `Restored ${ups.length} ticks.`; });
});
const XP94 = XP_CURVE[94], XP99 = XP_CURVE[99];
const levelOf = (xp) => { let l = 1; for (let i = 1; i <= 99; i++) if (XP_CURVE[i] <= xp) l = i; return l; };
const xpOf = (id) => { const p = progress[id]; return p && typeof p.xp === "number" ? p.xp : 0; };
const fmt = (n) => n.toLocaleString("en-GB");
function buildSkills() {
  const host = document.getElementById("skillMain");
  host.innerHTML = SKILLS.map(sk => `<div class="skill" data-sid="${sk.id}">
    <div class="sn">${esc(sk.n)}</div>
    <input type="number" inputmode="numeric" min="1" max="99" id="lv-${sk.id}" aria-label="${esc(sk.n)} level">
    <div class="sbars" aria-hidden="true">
      <div class="sb"><em>Level</em><div class="strack lvl"><i></i><b data-l="94" style="left:${(100 * 94 / 99).toFixed(2)}%"></b></div></div>
      <div class="sb"><em>XP</em><div class="strack xpt"><i></i><b data-l="94" style="left:${(100 * XP94 / XP99).toFixed(2)}%"></b></div></div>
    </div>
    <div class="sx"></div></div>`).join("");
  host.addEventListener("change", (e) => {
    const inp = e.target.closest("input"); if (!inp) return;
    const id = inp.closest(".skill").dataset.sid;
    let l = Math.round(Number(inp.value)); if (!Number.isFinite(l)) return paint();
    l = Math.min(99, Math.max(1, l));
    if (levelOf(xpOf(id)) === l) return paint();
    setSkillXP(id, XP_CURVE[l]);
  });
}
async function setSkillXP(id, xp) {
  progress[id] = { xp, at: Date.now() };
  paint();
  if (mode === "local") { lsSet(LS_KEY, JSON.stringify(progress)); return; }
  pending.add(id);
  try { await myCol().doc(id).set({ xp, at: Date.now() }); }
  catch (e) { if (e && e.code === "invalid_argument") goLocal("<b>Your log</b> · saved in this browser"); else setSync("That change didn't save. Check your connection and try again."); }
  finally { pending.delete(id); }
}
function paintSkills() {
  let a94 = 0, a99 = 0, frac94 = 0;
  SKILLS.forEach(sk => {
    const xp = xpOf(sk.id), l = levelOf(xp), row = document.querySelector(`[data-sid="${sk.id}"]`);
    if (!row) return;
    const inp = row.querySelector("input"); if (document.activeElement !== inp) inp.value = l;
    inp.disabled = !canWrite;
    row.querySelector(".strack.lvl i").style.width = (100 * l / 99) + "%";
    row.querySelector(".strack.xpt i").style.width = (100 * Math.min(xp, XP99) / XP99) + "%";
    const toNext = l >= 99 ? "maxed" : l >= 94 ? `${fmt(XP99 - xp)} XP to 99` : `${fmt(XP94 - xp)} XP to 94`;
    row.querySelector(".sx").textContent = `${fmt(xp)} XP · ${toNext}`;
    row.classList.toggle("at94", l >= 94 && l < 99); row.classList.toggle("at99", l >= 99);
    if (l >= 94) a94++; if (l >= 99) a99++; frac94 += Math.min(xp, XP94) / XP94;
  });
  document.getElementById("sAt94").textContent = a94;
  document.getElementById("sAt99").textContent = a99;
  const f = skillFracs(), k = SKILLS.length;
  [["94l", f.l94], ["94x", f.x94], ["99l", f.l99], ["99x", f.x99]].forEach(([key, v]) => {
    document.getElementById("b" + key).style.width = (100 * v / k) + "%";
    document.getElementById("p" + key).textContent = pctText(v / k);
  });
}
function skillFracs() {
  let l94 = 0, x94 = 0, l99 = 0, x99 = 0;
  SKILLS.forEach(sk => { const xp = xpOf(sk.id), l = levelOf(xp);
    l94 += Math.min(l, 94) / 94; x94 += Math.min(xp, XP94) / XP94; l99 += Math.min(l, 99) / 99; x99 += Math.min(xp, XP99) / XP99; });
  return { l94, x94, l99, x99 };
}
const pctText = (v) => { const sh = v >= 1 ? 100 : Math.min(99.9, Math.floor(v * 1000) / 10); return (sh % 1 === 0 ? sh.toFixed(0) : sh.toFixed(1)) + "%"; };
function paintTabs() {
  const cnt = (ids) => [ids.filter(id => stateOf(id) === "done").length, ids.length];
  const f = skillFracs(), k = SKILLS.length;
  const rows = { tabQuests: cnt(ALL_IDS), tabBosses: cnt(REC_IDS), tabUrns: cnt(URN_IDS) };
  COLLS.forEach(c => { rows[c.tab] = cnt(c.ids); });
  Object.entries(rows).forEach(([t, [d, n]]) => setTabProg(t, `${d}/${n}`, d / n));
  const ag = medalSum(), oc = COURSE_IDS.length * 3, bT = BURROW_IDS.length, bc = Math.min(bT, burDone());
  setTabProg("tabAgility", `${ag}/${oc}`, ag / oc);
  setTabProg("tabBurrows", `${bc}/${bT}`, bc / bT);
  const mc = countOf(MAP_ID);
  setTabProg("tabMap", `${mc}/${MAP_REGIONS}`, mc / MAP_REGIONS);
  setTabProg("tabSkills", Math.floor(100 * f.x94 / k) + "%", f.x94 / k);
  document.getElementById("tabSkills").title = "XP progress toward level 94 in every skill";
}
function setTabProg(t, label, v) {
  document.getElementById("tc-" + t).textContent = label;
  document.getElementById("tpb-" + t).style.width = (100 * Math.min(1, v)) + "%";
  document.getElementById(t).classList.toggle("full", v >= 1);
}
function paintTiers() {
  paintTabs();
  const frac = (ids) => ids.length ? ids.filter(id => stateOf(id) === "done").length / ids.length : 1;
  const parts = [frac(ALL_IDS), frac(REC_IDS), frac(URN_IDS), ...COLLS.map(c => frac(c.ids)), medalSum() / (COURSE_IDS.length * 3), burDone() / BURROWS, countOf(MAP_ID) / MAP_REGIONS];
  const base = parts.reduce((a, b) => a + b, 0), n = parts.length, k = SKILLS.length, f = skillFracs();
  const pct = [base / n, (base + f.x94 / k) / (n + 1), (base + f.x99 / k) / (n + 1)];
  document.querySelectorAll(".tier").forEach((t, i) => {
    t.querySelector("i").style.width = (100 * pct[i]) + "%";
    t.querySelector(".tpct").textContent = pctText(pct[i]);
    t.classList.toggle("full", pct[i] >= 1);
  });
}
function buildBosses() {
  const host = document.getElementById("recMain");
  host.classList.add("foundonly"); document.getElementById("rSearch").insertAdjacentHTML("afterend", SEARCH_NOTE);
  host.innerHTML = RECIPES.map(g => `<section class="panel" id="rec-${g.key}"><div class="sec-head"><h2>${esc(g.title)}</h2><span class="count"></span></div><div class="rule"></div>
    ${g.intro ? `<p class="unlock">${esc(g.intro)}</p>` : ""}<ul class="list">${g.items.map(r => `<li class="q recipe" data-id="${r.id}" data-gate="${r.id}">
      <button class="mark" type="button" id="m-${r.id}"><span class="d">${CHECK}</span></button>
      <div>
        <div class="title-row"><span class="name">${esc(r.unl || r.n)}</span><span class="status" hidden></span><a class="wiki" href="${w(r.n.replace(/^MOUNT: /, ""))}" target="_blank" rel="noopener">Wiki</a>${HINT_BTN}</div>
        <div class="unl spoil"><span>${r.via || (r.n.startsWith("MOUNT") ? "Mount vestige" : "Vestige")}</span> ${esc(r.n.replace(/^MOUNT: /, ""))}</div>
      </div></li>`).join("")}</ul><p class="empty">Everything here is unlocked.</p></section>`).join("") + undiscHTML("recipes");
  document.getElementById("rJump").innerHTML = RECIPES.map(g => `<a class="chip" href="#rec-${g.key}" data-rjump="${g.key}">${esc(g.title.replace("Power Level ", "PL "))} <span></span></a>`).join("");
  host.addEventListener("click", (e) => {
    const b = e.target.closest(".mark"); if (b) return cycle(b.closest(".q").dataset.id);
    const lk = e.target.closest(".prev-link"); if (lk) { const d = lk.closest(".craft-body"); if (d) d.scrollIntoView({ block: "nearest" }); }
  });
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const input = document.getElementById("rSearch");
  input.addEventListener("input", () => {
    const q = norm(input.value);
    let any = false;
    RECIPES.forEach(g => {
      let hits = 0;
      g.items.forEach(r => {
        const li = host.querySelector(`[data-id="${r.id}"]`);
        const ok = searchHit(li, q, `${r.unl || ""} ${r.n}`, [r.unl || r.n, r.n.replace(/^MOUNT: /, "")]);
        li.classList.toggle("nomatch", !ok);
        if (ok) hits++;
      });
      document.getElementById("rec-" + g.key).classList.toggle("nomatch", hits === 0);
      if (hits) any = true;
    });
    document.getElementById("rNo").hidden = any;
  });
}
function paintRecipes() {
  const d = REC_IDS.filter(id => stateOf(id) === "done").length;
  document.getElementById("rDone").textContent = d;
  document.getElementById("rTotal").textContent = REC_IDS.length;
  document.getElementById("rBar").style.width = (100 * d / REC_IDS.length) + "%";
  RECIPES.forEach(g => {
    const n = g.items.filter(r => stateOf(r.id) === "done").length;
    const sec = document.getElementById("rec-" + g.key);
    sec.querySelector(".count").textContent = `${n} / ${g.items.length}`;
    sec.classList.toggle("all-done", n === g.items.length);
    const a = document.querySelector(`[data-rjump="${g.key}"]`);
    a.querySelector("span").textContent = `${n}/${g.items.length}`;
    a.classList.toggle("full", n === g.items.length);
    a.classList.toggle("nofound", !n);
  });
  undiscLine("recipes", REC_IDS.length - d, FOUND_NOUN.recipes);
}

function paint() {
  paintStory();
  document.querySelectorAll(".q").forEach(li => {
    const id = li.dataset.id, s = stateOf(id);
    li.classList.toggle("started", s === "started");
    li.classList.toggle("done", s === "done");
    const st = li.querySelector(".status");
    st.hidden = s === "none"; st.textContent = li.dataset.status || (li.classList.contains("recipe") ? "Unlocked" : li.classList.contains("burrow") ? "Opened" : LABEL[s]);
    const b = li.querySelector(".mark");
    b.disabled = !canWrite;
    b.setAttribute("aria-label", `${li.classList.contains("locked") && !li.classList.contains("peek") && !li.classList.contains("exact") && !showAll() ? li.querySelector(".name .ph").textContent : BY_ID[id].n}: ${LABEL[s]}.${canWrite ? " Change status." : ""}`);
  });
  const qv = ALL_IDS, done = qv.filter(id => stateOf(id) === "done").length;
  document.getElementById("qpDone").textContent = done;
  document.getElementById("qpTotal").textContent = qv.length;
  document.getElementById("qpStarted").textContent = qv.filter(id => stateOf(id) === "started").length;
  document.getElementById("overallBar").style.width = (100 * done / qv.length) + "%";

  (window.__groups || []).forEach(([k, , ids]) => {
    const d = ids.filter(id => stateOf(id) === "done").length;
    const sec = document.getElementById(k);
    sec.querySelector(".count").textContent = `${d} / ${ids.length}`;
    sec.classList.toggle("all-done", d === ids.length);
    const a = document.querySelector(`[data-jump="${k}"]`);
    a.querySelector("span").textContent = `${d}/${ids.length}`;
    a.classList.toggle("full", d === ids.length);
  });
  const exd = EXTRA.filter(q => stateOf(q.id) === "done").length;
  document.querySelector("#extra .count").textContent = `${exd} / ${EXTRA.length}`;
  document.getElementById("exChip").textContent = `${exd}/${EXTRA.length}`;
  document.getElementById("extra").classList.toggle("all-done", exd === EXTRA.length);
  document.getElementById("exChip").parentElement.classList.toggle("full", exd === EXTRA.length);
  paintRecipes();
  paintUrns();
  COLLS.forEach(paintColl);
  paintAgility();
  paintMap();
  paintMaps();
  paintSkills();
  paintTiers();
  const allGold = COURSE_IDS.every(id => medalOf(id) >= 3);
  document.querySelectorAll(".mapgate").forEach(g => g.classList.toggle("done", g.closest("#agCourses") ? allGold : !!g.closest(".all-done")));
  document.querySelectorAll(".course").forEach(li => li.classList.toggle("done", medalOf(li.dataset.cid) >= 3));
  paintPeeks();
}

let bannerTimer = null;
const id2kind = (id) => COLL_OF[id] ? COLL_OF[id].kind : id.startsWith("b-") ? "Burrow Opened" : id.startsWith("a-") ? "Gold Medal" : id.startsWith("l-") ? "Lore Scrap Read" : id.startsWith("u-") ? "Urn Absorbed" : id.startsWith("r-") ? "Recipe Unlocked" : "Quest Complete";
function showBanner(q, isBoss) {
  const host = document.getElementById("bannerHost");
  host.innerHTML = `<div class="banner" role="status"><div class="t">${id2kind(q.id)}</div><div class="qn">${esc(q.unl || q.n)}${q.id.startsWith("u-") ? " · +10 max health" : ""}</div>${(q.rw || []).length ? `<div class="rw">${q.rw.map(esc).join(" · ")}</div>` : ""}</div>`;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { host.innerHTML = ""; }, 3500);
}

const myCol = () => db.collection("data/users/" + uid);
/* Big journal-style collections are saved as one document each ("set-<key>": {done:[ids]}) instead of one document per entry. */
const BUNDLE_OF = (id) => { const c = COLL_OF[id]; return c && c.key !== "mounts" ? c.key : null; };
const pendingB = new Set(), holdB = new Set(), bundleRun = {}, bundleAgain = {};
async function saveBundle(key) {
  if (bundleRun[key]) { bundleAgain[key] = true; return bundleRun[key]; }
  pendingB.add(key);
  bundleRun[key] = (async () => {
    try {
      do {
        bundleAgain[key] = false;
        const c = COLLS.find(x => x.key === key);
        await myCol().doc("set-" + key).set({ done: c.ids.filter(id => stateOf(id) === "done"), at: Date.now() });
      } while (bundleAgain[key]);
    } finally { pendingB.delete(key); bundleRun[key] = null; }
  })();
  return bundleRun[key];
}
function goLocal(msg) {
  mode = "local";
  lsSet(LS_KEY, JSON.stringify(progress));
  setSync(msg);
}

async function cycle(id) {
  if (pending.has(id)) return;
  const cur = stateOf(id);
  const isBoss = !!COLL_OF[id] || id.startsWith("r-") || id.startsWith("u-") || id.startsWith("b-");
  const next = isBoss ? (cur === "done" ? "none" : "done") : (cur === "none" ? "started" : cur === "started" ? "done" : "none");
  if (next === "none") delete progress[id];
  else progress[id] = { state: next, at: Date.now() };
  paint();
  if (next === "done") showBanner(BY_ID[id], isBoss);
  if (mode === "local") { lsSet(LS_KEY, JSON.stringify(progress)); return; }
  const bk = BUNDLE_OF(id);
  if (bk) {
    try { await saveBundle(bk); }
    catch (e) { if (e && e.code === "invalid_argument") goLocal("<b>Your log</b> · saved in this browser (your access level can't save to your account)"); else setSync("That change didn't save. Check your connection and tap it again."); }
    return;
  }
  pending.add(id);
  try {
    const ref = myCol().doc(id);
    if (next === "none") await ref.delete();
    else await ref.set({ state: next, at: Date.now() });
  } catch (e) {
    if (e && e.code === "invalid_argument") goLocal("<b>Your log</b> · saved in this browser (your access level can't save to your account)");
    else setSync("That change didn't save. Check your connection and tap the quest again.");
  } finally { pending.delete(id); }
}
function setSync(html) { document.getElementById("sync").innerHTML = html; }

function setFilter(todo) {
  document.body.classList.toggle("hide-done", todo);
  document.querySelectorAll(".f-all").forEach(x => x.setAttribute("aria-pressed", String(!todo)));
  document.querySelectorAll(".f-todo").forEach(x => x.setAttribute("aria-pressed", String(todo)));
  lsSet("dw-filter", todo ? "todo" : "all");
}
document.querySelectorAll(".f-all").forEach(x => x.onclick = () => setFilter(false));
document.querySelectorAll(".f-todo").forEach(x => x.onclick = () => setFilter(true));

const TABS = { quests: ["tabQuests", "view-quests"], bosses: ["tabBosses", "view-bosses"], urns: ["tabUrns", "view-urns"], lore: ["tabLore", "view-lore"], mounts: ["tabMounts", "view-mounts"], plants: ["tabPlants", "view-plants"], factions: ["tabFactions", "view-factions"], fauna: ["tabFauna", "view-fauna"], buildings: ["tabBuildings", "view-buildings"], map: ["tabMap", "view-map"], crafting: ["tabCrafting", "view-crafting"], agility: ["tabAgility", "view-agility"], burrows: ["tabBurrows", "view-burrows"], skills: ["tabSkills", "view-skills"] };
function setTab(t) {
  if (!TABS[t]) t = "quests";
  Object.entries(TABS).forEach(([k, [tab, view]]) => {
    document.getElementById(view).hidden = k !== t;
    document.getElementById(tab).setAttribute("aria-selected", String(k === t));
  });
  lsSet("dw-tab", t);
}
Object.entries(TABS).forEach(([k, [tab]]) => { document.getElementById(tab).onclick = () => setTab(k); });

/* What's new: the changelog panel above the footer, opened from the link by the version badge.
   A dot on the link marks an entry this browser hasn't opened yet. */
function buildChangelog() {
  const fmtD = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const latest = CHANGELOG[0].date, box = document.getElementById("changelog"), link = document.getElementById("whatsNew");
  document.getElementById("clLatest").textContent = "· " + fmtD(latest);
  document.getElementById("clBody").innerHTML = CHANGELOG.map(e => `<section class="cl-entry"><h3><time datetime="${e.date}">${fmtD(e.date)}</time> · ${esc(e.title)}</h3><ul>${e.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></section>`).join("");
  const markSeen = () => { lsSet("dw-seen-changelog", latest); link.classList.remove("unseen"); };
  link.classList.toggle("unseen", (lsGet("dw-seen-changelog") || "") < latest);
  link.addEventListener("click", (e) => { e.preventDefault(); box.open = true; box.scrollIntoView({ behavior: "smooth", block: "start" }); });
  box.addEventListener("toggle", () => { if (box.open) markSeen(); });
}

const resetBox = document.getElementById("resetBox");
function drawReset() {
  resetBox.innerHTML = `<button class="chip" type="button" id="resetBtn">Reset my progress</button>`;
  document.getElementById("resetBtn").onclick = () => {
    resetBox.innerHTML = `<span>Clear all of your progress?</span><button class="chip" type="button" id="resetYes">Yes, clear it</button><button class="chip" type="button" id="resetNo">Cancel</button>`;
    document.getElementById("resetNo").onclick = drawReset;
    document.getElementById("resetYes").onclick = async () => {
      progress = {}; paint(); drawReset();
      if (mode === "local") { lsSet(LS_KEY, "{}"); return; }
      // Delete every saved document, including leftovers from older save formats.
      const ids = new Set([...savedIds, ...COLLS.filter(c => c.key !== "mounts").map(c => "set-" + c.key)]);
      resetting = true;
      try { for (const id of ids) { try { await myCol().doc(id).delete(); } catch {} } } finally { resetting = false; }
    };
  };
}

build();
buildBosses();
buildUrns();
COLLS.forEach(buildColl);
buildAgility();
buildSkills();
buildChangelog();
setTab(["#bosses", "#urns", "#lore", "#mounts", "#plants", "#factions", "#fauna", "#buildings", "#map", "#crafting", "#agility", "#burrows", "#skills"].includes(location.hash) ? location.hash.slice(1) : (lsGet("dw-tab") || "quests"));
setFilter(lsGet("dw-filter") === "todo");
paint();
drawReset();
setSync("<b>Your log</b> · saved in this browser");

(async () => {
  if (!window.claude || typeof window.claude.use !== "function") return;
  try { [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]); } catch { db = null; }
  if (!db || !user) return;
  try { uid = await user.id(); } catch { uid = null; }
  if (!uid) return;
  let cw = null;
  try { cw = typeof user.can === "function" ? await user.can("data.write") : null; } catch {}
  if (cw === false) return;
  mode = "account";
  const localSaved = { ...progress };
  let first = true, migrating = false;
  myCol().onSnapshot(async (snap) => {
    const next = {};
    savedIds = snap.docs.map(d => d.id);
    // Old saves kept journal-style entries (lore, gathering, factions...) one document per item; those are now one bundle per section.
    const legacy = snap.docs.filter(d => BUNDLE_OF(d.id)).map(d => d.id);
    if (resetting) return;
    snap.docs.forEach(d => {
      const v = d.data(); if (!v) return;
      if (d.id.startsWith("set-")) { const k = d.id.slice(4); if (!pendingB.has(k) && !holdB.has(k) && Array.isArray(v.done)) v.done.forEach(id => { if (BY_ID[id]) next[id] = { state: "done", at: v.at || 0 }; }); return; }
      if (!BY_ID[d.id]) return;
      if (v.state === "started" || v.state === "done") next[d.id] = { state: v.state, at: v.at || 0 };
      else if (d.id.startsWith("s-") && typeof v.xp === "number") next[d.id] = { xp: v.xp, at: v.at || 0 };
      else if (d.id.startsWith("a-") && typeof v.medal === "number") next[d.id] = { medal: v.medal, ...(typeof v.best === "number" ? { best: v.best } : {}), at: v.at || 0 };
      else if (COUNT_MAX[d.id] && typeof v.count === "number") next[d.id] = { count: v.count, at: v.at || 0 };
    });
    pending.forEach(id => { if (progress[id]) next[id] = progress[id]; else delete next[id]; });
    new Set([...pendingB, ...holdB]).forEach(k => { COLLS.find(c => c.key === k).ids.forEach(id => { if (progress[id]) next[id] = progress[id]; else delete next[id]; }); });
    if (first) {
      first = false;
      setSync("<b>Your log</b> · saved to your Claude account");
      // carry over anything ticked in this browser before account saving was available
      if (snap.empty && Object.keys(localSaved).length) {
        progress = localSaved; paint();
        for (const c of COLLS) { if (c.key !== "mounts" && c.ids.some(id => stateOf(id) === "done")) { try { await saveBundle(c.key); } catch (e) { if (e && e.code === "invalid_argument") { goLocal("<b>Your log</b> · saved in this browser"); return; } } } }
        for (const [id, v] of Object.entries(localSaved)) {
          if (!BY_ID[id] || !v || BUNDLE_OF(id)) continue;
          const st = v.state || (v.done ? "done" : null);
          const vb = valBody(v);
          const body = vb ? { ...vb, at: v.at || Date.now() } : (st === "started" || st === "done") ? { state: st, at: v.at || Date.now() } : null;
          if (!body) continue;
          try { await myCol().doc(id).set(body); }
          catch (e) { if (e && e.code === "invalid_argument") { goLocal("<b>Your log</b> · saved in this browser"); return; } }
        }
        return;
      }
    }
    if (mode !== "account") return;
    progress = next;
    paint();
    if (legacy.length && !migrating) {
      migrating = true;
      try {
        for (const k of new Set(legacy.map(BUNDLE_OF))) await saveBundle(k);
        for (const id of legacy) await myCol().doc(id).delete();
      } catch {} finally { migrating = false; }
    }
  }, () => { setSync("Live sync stopped. Reload the page to reconnect."); });
})();
