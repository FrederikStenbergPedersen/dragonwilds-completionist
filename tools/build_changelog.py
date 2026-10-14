"""Write CHANGELOG.md from data/changelog.js (the one source for the changelog).

    python3 tools/build_changelog.py           # rewrite CHANGELOG.md
    python3 tools/build_changelog.py --check   # exit 1 if CHANGELOG.md is out of date
"""
import datetime, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def entries():
    src = open(os.path.join(ROOT, "data", "changelog.js"), encoding="utf-8").read()
    body = re.search(r"const CHANGELOG = (\[.*\]);", src, re.S).group(1)
    body = re.sub(r"//[^\n]*", "", body)
    body = re.sub(r"(\{|,)\s*(\w+):", r'\1"\2":', body)      # bare keys -> JSON keys
    body = re.sub(r",(\s*[\]}])", r"\1", body)                # trailing commas
    return json.loads(body)


def render():
    out = ["# Changelog", "", "What's changed on the site, newest first. The same list is under **What's new** on the page.", ""]
    for e in entries():
        d = datetime.date.fromisoformat(e["date"])
        out += [f"## {d.day} {d:%B %Y} · {e['title']}", ""] + [f"- {i}" for i in e["items"]] + [""]
    return "\n".join(out)


if __name__ == "__main__":
    path = os.path.join(ROOT, "CHANGELOG.md")
    text = render()
    if "--check" in sys.argv:
        cur = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        if cur != text:
            sys.exit("CHANGELOG.md is out of date: run python3 tools/build_changelog.py")
        print("CHANGELOG.md is up to date")
    else:
        open(path, "w", encoding="utf-8").write(text)
        print("wrote CHANGELOG.md")
