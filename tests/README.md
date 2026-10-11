# Tests

`smoke_test.py` opens the site in a headless browser, imports `fixtures/sample-character.json`
(a small made-up save), ticks a few things, reloads, and checks a backup code restores everything.
It runs on every push through GitHub Actions (`.github/workflows/test.yml`).

Run it locally:

```sh
pip install playwright
python -m playwright install chromium
python3 tests/smoke_test.py
```

If you change what a section contains (for example after a data rebuild), update the expected
totals in `EXPECT_TABS` at the top of the test.
