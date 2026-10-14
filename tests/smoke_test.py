#!/usr/bin/env python3
"""Smoke test: load the site, import a sample save, tick things, back up and restore.

    pip install playwright && python -m playwright install chromium
    python3 tests/smoke_test.py

Exits non-zero on the first failure. Uses tests/fixtures/sample-character.json,
a small made-up save (not a real player's).
"""
import asyncio, functools, http.server, os, socketserver, sys, threading

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FIXTURE = os.path.join(ROOT, "tests", "fixtures", "sample-character.json")

# What the sample save should produce in each section's progress row.
EXPECT_TABS = {
    "Quests": "3/47", "Recipes": "2/125", "Crafting": "5/869", "Building": "6/776", "Mounts": "1/17", "Urns": "2/21",
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
