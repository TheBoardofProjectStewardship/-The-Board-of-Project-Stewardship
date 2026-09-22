# Intake inbox

Drop one directory per submission:

```text
intake/inbox/<submission-id>/manifest.json
```

`<submission-id>` matches `^[a-z0-9][a-z0-9-]{2,80}$`.

Steward is the only publisher. Specialists do not write `posts/`, `posts.json`, `blog.html`, `sitemap.xml`, or `blog/rss.xml`.

```bash
python3 tools/board_intake.py validate intake/inbox/<submission-id>
python3 tools/board_intake.py publish intake/inbox/<submission-id> --dry-run
```

`publish --apply` writes the site only when Steward passes it. The committed example packet lives at `tests/fixtures/intake/intake-contract-fixture/` and is marked `example: true`, so `--apply` refuses it.

Contract: `docs/AGENT-INTAKE.md`.

Unpublished packets can be crawled if this tree is deployed. `robots.txt` disallows `/intake/`. Do not put secrets in any packet file.
