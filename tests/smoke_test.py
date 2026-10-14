#!/usr/bin/env python3
"""Smoke test: load the site, import a sample save, tick things, back up and restore.

    pip install playwright && python -m playwright install chromium
    python3 tests/smoke_test.py

Exits non-zero on the first failure. Uses tests/fixtures/sample-character.json,
a small made-up save (not a real player's).
"""
import asyncio
import subprocess, functools, http.server, os, socketserver, sys, threading

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FIXTURE = os.path.join(ROOT, "tests", "fixtures", "sample-character.json")

# What the sample save should produce in each section's progress row.
EXPECT_TABS = {
    "Quests": "3/47", "Recipes": "2/125", "Crafting": "5/869", "Building": "6/776", "Mounts": "1/19", "Urns": "2/21",
    "Burrows": "4/19", "Map": "10/32", "Lore": "3/117", "Gathering": "3/87", "Factions": "2/60", "Fauna": "2/69",
    "Agility Courses": "5/18",
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd.server_address[1]


failures = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


async def tabs(pg):
    rows = await pg.eval_on_selector_all(".tab", "e => e.map(x => [x.querySelector('.tl').textContent, x.querySelector('.tc').textContent])")
    return dict(rows)


async def main():
    from playwright.async_api import async_playwright
    port = serve()
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        pg = await browser.new_page(viewport={"width": 390, "height": 900})
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        await pg.route("**/fonts.gstatic.com/**", lambda r: r.abort())
        await pg.goto(f"http://127.0.0.1:{port}/index.html")
        await pg.wait_for_timeout(300)

        print("page loads")
        check(not errors, "no script errors on load " + (str(errors) if errors else ""))
        check(await pg.locator(".tab").count() == 14, "14 section rows")

        print("no spoilers")
        shown = "[...document.querySelectorAll('.spoil')].filter(e => getComputedStyle(e).display !== 'none' && e.closest('[data-gate]')).length"
        total = await pg.evaluate("document.querySelectorAll('[data-gate] .spoil').length")
        named = "id => getComputedStyle(document.querySelector(`[data-id='${id}'] .name .real`)).display !== 'none'"
        check(await pg.evaluate(shown) == total and await pg.evaluate(named, "getting-started"), "everything shows by default")
        await pg.click("label.switch")
        check(await pg.evaluate("document.getElementById('spoilToggle').checked"), "the No spoilers switch turns on")
        check(await pg.evaluate(shown) == 0, "no hints or maps showing with No spoilers on")
        await pg.click("[data-id='dragon-slayer'] .hint-btn")
        boss = await pg.evaluate("getComputedStyle(document.querySelector(\"[data-id='dragon-slayer'] .boss\")).display")
        check(boss != "none", "Show hint reveals that quest's hint")
        check(await pg.evaluate(shown) == 3, "and only that quest's (boss, start, rewards)")
        await pg.click("[data-id='dragon-slayer'] .hint-btn")
        check(await pg.evaluate(shown) == 0, "Hide hint hides it again")
        check(await pg.evaluate(named, "first-steps") and not await pg.evaluate(named, "getting-started"), "only the first main quest is named")
        hidden = "sel => getComputedStyle(document.querySelector(sel)).display === 'none'"
        check(await pg.evaluate(hidden, "#fellhollow") and await pg.evaluate(hidden, "[data-jump='fellhollow']"), "regions the story hasn't opened are left out, names and all")
        undisc = "k => document.querySelector(`[data-undisc='${k}']`).textContent"
        check((await tabs(pg))["Urns"] == "0/21" and (await pg.evaluate(undisc, "urns")).startswith("15 more urns"), "totals stay true, with a nameless line for what's ahead")
        await pg.evaluate("progress['dragon-slayer'] = { state: 'done' }; paint()")
        check(not await pg.evaluate(hidden, "#fellhollow") and (await pg.evaluate(undisc, "urns")).startswith("9 more urns"), "finishing Dragon Slayer opens Ghornfell and Fellhollow")
        await pg.evaluate("delete progress['dragon-slayer']; paint()")
        tert = "getComputedStyle(document.querySelector('li.tertiary')).display"
        check(await pg.evaluate(tert) == "none", "clan quests are left out until Icthlarin's Little Helper starts")
        await pg.evaluate("progress['icthlarins-little-helper'] = { state: 'started' }; paint()")
        check(await pg.evaluate(tert) != "none", "starting Icthlarin's Little Helper shows the clan quests")
        await pg.evaluate("delete progress['icthlarins-little-helper']; paint()")
        await pg.evaluate("progress['first-steps'] = { state: 'done' }; paint()")
        check(await pg.evaluate(named, "getting-started"), "finishing a main quest names the next one")
        ph = await pg.evaluate("document.querySelector(\"[data-id='fight-caves-full'] .name .ph\").textContent")
        check(ph == "Undiscovered activity", f"locked activities say activity, not quest ({ph})")
        await pg.evaluate("delete progress['first-steps']; paint()")
        listed = "[...document.querySelectorAll('#craftingMain .q')].filter(e => getComputedStyle(e).display !== 'none').length"
        await pg.click("#tabCrafting")
        check(await pg.evaluate(listed) == 0, "item tabs list nothing you haven't found")
        await pg.evaluate("progress['c-tools-bucket-compost'] = { state: 'done' }; paint()")
        check(await pg.evaluate(listed) == 1, "a found item is listed")
        await pg.evaluate("delete progress['c-tools-bucket-compost']; paint()")
        await pg.fill("#crSearch", "rune")
        check(await pg.evaluate(listed) == 0, "a partial search doesn't list unfound items")
        await pg.fill("#crSearch", "rune platebody")
        check(await pg.evaluate(listed) == 1, "a full-name search finds one")
        await pg.fill("#crSearch", "")
        secs = "[...document.querySelectorAll('#recMain section')].filter(e => getComputedStyle(e).display !== 'none').length"
        check(await pg.evaluate(secs) == 0 and (await pg.evaluate(undisc, "recipes")).startswith("125 more recipes"), "unfound sections are left out, with one count for the rest")
        await pg.evaluate("progress['r-a-simple-broken-bow'] = { state: 'done' }; paint()")
        check(await pg.evaluate(secs) == 1 and (await pg.evaluate(undisc, "recipes")).startswith("124 more recipes"), "finding something shows just its section")
        await pg.evaluate("delete progress['r-a-simple-broken-bow']; paint()")
        fac = "[...document.querySelectorAll('#factionsMain .q')].filter(e => getComputedStyle(e).display !== 'none').length"
        check(await pg.evaluate(fac) == 0 and (await pg.evaluate(undisc, "factions")).startswith("60 more enemies"), "Factions lists only defeated enemies (no boss names up front)")
        scrap = "sel => { const li = document.querySelector(\"[data-id='l-lorescrap-a1']\"); const v = e => getComputedStyle(li.querySelector(e)).display !== 'none'; return [v('.name .real'), v('.name .ph'), v('.wiki')]; }"
        check(await pg.evaluate(scrap, "") == [False, True, True], "unread lore scraps hide their title but keep the Wiki link")
        await pg.click("#tabLore")
        await pg.click("[data-id='l-lorescrap-a1'] .hint-btn")
        check((await pg.evaluate(scrap, ""))[0], "Show hint reveals a scrap's title")
        await pg.click("[data-id='l-lorescrap-a1'] .hint-btn")
        series = "getComputedStyle(document.querySelector(\"[data-lg='lore-brynmoor-ghornfell-dragon-attack'] .lser .real\")).display"
        check(await pg.evaluate(series) == "none", "lore series names stay hidden until something in them is read")
        await pg.click("#tabFauna")
        await pg.evaluate("progress['j-fauna-chicken'] = { state: 'done' }; paint()")
        await pg.evaluate("setFilter(true)")
        fn = "[...document.querySelectorAll('#faunaMain .q')].filter(e => getComputedStyle(e).display !== 'none').length"
        chips = "getComputedStyle(document.querySelector('#view-fauna .f-todo')).display"
        check(await pg.evaluate(fn) == 1 and await pg.evaluate(chips) == "none", "Hide found steps aside on found-only tabs (no empty sections)")
        await pg.click("#tabQuests")
        check(await pg.evaluate("document.body.classList.contains('hide-done')"), "Hide found still applies on other tabs")
        await pg.evaluate("setFilter(false); delete progress['j-fauna-chicken']; paint()")
        await pg.reload()
        await pg.wait_for_timeout(300)
        check(await pg.evaluate(shown) == 0, "No spoilers is remembered after a reload")
        await pg.click("label.switch")
        check(await pg.evaluate(shown) == total and await pg.evaluate(listed) > 0, "turning it off shows everything again")

        print("save import")
        await pg.click("#importer > summary")
        await pg.set_input_files("#saveFile", FIXTURE)
        await pg.wait_for_timeout(200)
        summary = await pg.inner_text("#impResult")
        check("Test Adventurer" in summary, "import summary names the character")
        await pg.click("#impApply")
        await pg.wait_for_timeout(300)
        got = await tabs(pg)
        for name, want in EXPECT_TABS.items():
            check(got.get(name) == want, f"{name} shows {want} (got {got.get(name)})")
        check(got.get("Skills", "").endswith("%"), "Skills shows a percentage")

        print("ticking")
        await pg.evaluate("document.getElementById('importer').open = false")
        await pg.click("#tabUrns")
        first = await pg.evaluate("[...document.querySelectorAll('.umark:not(.on)')][0].id")
        await pg.click("#" + first)
        await pg.wait_for_timeout(100)
        check((await tabs(pg))["Urns"] == "3/21", "ticking an urn updates the count")
        await pg.click("#tabAgility")
        await pg.click("[data-cid='a-grave-run'] .medal[data-m='1']")
        await pg.wait_for_timeout(100)
        check((await tabs(pg))["Agility Courses"] == "6/18", "setting a bronze medal adds one")
        await pg.click("#tabCrafting")
        await pg.fill("#crSearch", "rune platebody")
        await pg.wait_for_timeout(100)
        hits = await pg.evaluate("[...document.querySelectorAll('#craftingMain .q:not(.nomatch)')].length")
        check(hits >= 1, f"crafting search finds Rune Platebody ({hits} hits)")

        print("persistence and backup")
        before = await tabs(pg)
        await pg.reload()
        await pg.wait_for_timeout(300)
        check(await tabs(pg) == before, "progress survives a reload")
        code = await pg.evaluate("makeBackup()")
        await pg.evaluate("progress = {}; paint()")
        check((await tabs(pg))["Urns"] == "0/21", "progress can be cleared")
        await pg.evaluate("c => { document.getElementById('bkIn').value = c; document.getElementById('bkApply').click(); }", code)
        await pg.wait_for_timeout(300)
        check(await tabs(pg) == before, "backup code restores everything")

        print("changelog")
        await pg.evaluate("localStorage.removeItem('dw-seen-changelog')")
        await pg.reload()
        await pg.wait_for_timeout(300)
        check(await pg.evaluate("document.querySelectorAll('#clBody .cl-entry').length") >= 2, "What's new lists the changelog")
        check(await pg.evaluate("document.getElementById('whatsNew').classList.contains('unseen')"), "an unseen entry marks the What's new link")
        await pg.click("#whatsNew")
        await pg.wait_for_timeout(200)
        check(await pg.evaluate("document.getElementById('changelog').open"), "the What's new link opens the changelog")
        check(not await pg.evaluate("document.getElementById('whatsNew').classList.contains('unseen')"), "opening it clears the mark")
        md = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "build_changelog.py"), "--check"], capture_output=True, text=True)
        check(md.returncode == 0, "CHANGELOG.md matches data/changelog.js")

        print("layout")
        width = await pg.evaluate("document.documentElement.scrollWidth")
        check(width <= 390, f"no sideways scroll on a phone ({width}px)")
        check(not errors, "no script errors " + (str(errors) if errors else ""))
        await browser.close()
    if failures:
        print(f"\n{len(failures)} check(s) failed")
        sys.exit(1)
    print("\nall checks passed")


if __name__ == "__main__":
    asyncio.run(main())
