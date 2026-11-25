# Cloud agent brief: internal links + Board YouTube links on every post and news story

Repo: TheBoardofProjectStewardship/-The-Board-of-Project-Stewardship (default branch main, base commit dd4ac1fb "Add four photos to the Sep 24 Bothell kitchen remodel post. (#262)").
Authorization: Alex, Nov 25: "Add links to YouTube. A bunch of links in every article and post" (plus the internal-linking standing rule from the @asaio87 thread).
Owner approves the merge; nothing is published until the PR is merged.

## What to do

1. `git checkout -b internal-links-youtube-2026-11-25 origin/main`
2. Apply the patch (2 commits, 317 files: 156 md + 156 html + 5 tool files):
   `git am /workspace/state/steward/internal-linking/internal-links-youtube.patch`   (on the box; upload it to the cloud agent as a file)
   If `git am` conflicts because main moved (Nexus's Nov 25 post, other photo top-ups), instead run the tool on current main:
   `mkdir -p tools/internal-linking && cp link_pass.py youtube_map.json METHOD.md tools/internal-linking/ && python3 tools/internal-linking/link_pass.py apply`
   (the script is idempotent and skips pages dated 2026-11-25 or later unless `--include-new`).
3. Verify (all must pass):
   - `python3 tools/internal-linking/link_pass.py verify` → 0 non-200 internal URLs on https://boardofprojectstewardship.com/, every YouTube ID in the channel feed (UCpej558rCLbYWTt3tEW6a5A) + oEmbed + HTTP 200.
   - `python3 scripts/check_locked_content.py` → "locked content ok (11 blocks)".
   - `python3 -m pytest -q tests/*.py` → only `tests/test_build_here_interact.py` errors (needs a local server on port 8765; unrelated).
   - Do NOT run `generate_site.py` and commit its output: on this base it rewrites ~28 unrelated pages (nav card, news captions). The tool patches both `.md` and the published `.html` directly. If you do run it for a check, run it in a scratch copy.
4. Open the PR against main, title: "Internal links and Board YouTube links on every post and news story". Body = the summary below. Run the standing PR flow (checks green → squash merge with head SHA → wait ~2.5 min → curl spot-check → IndexNow for the changed URLs → CoS FYI).
   Suggested IndexNow list: every URL in `git diff --name-only origin/main | grep '\.html$'` mapped to https://boardofprojectstewardship.com/<path>. (156 URLs; `news/` and `posts/` only.)

## Summary for the PR body

- 156 pages touched: 112 blog posts + 44 news stories (md and published html). No page dated 2026-11-25 or later.
- 514 new internal links: 172 inline anchors on words already in the text + 342 in one `Related on the Board:` line per page. 3-5 new internal links per page (min 3, max 5), no duplicates, no self links, none in headings, intro, Key Takeaways, PPG sections or existing links.
- 496 YouTube links (3 or 4 per page; 128 pages with 3, 28 with 4) in a `## Watch on the Board's YouTube` block, matched by service and place from the 10 live Board videos. Existing embeds untouched.
- No Pacific Pro Group text added or edited; honesty lock passes; news and blog do not link to each other (repo contract).
- Method: tools/internal-linking/METHOD.md. Changelog (revert map): tools/internal-linking/changelog.json. Review table: tools/internal-linking/changes.md.

## Standing follow-ups after merge

- Noon upload run: add each new video (`python3 tools/internal-linking/link_pass.py sync-youtube` then `apply` then `verify`). Only public videos on the channel are accepted. Commit changed posts/news md+html in one PR.
- Nexus's Nov 25 post (and every new post/story): run `link_pass.py apply --include-new` after it merges, or have the writer include the links themselves (see SKILL_ADDENDUM_bops-rich-blog-post.md).
- Weekly (Sundays, with the scorecard prep): `link_pass.py apply` to add links to new pages and refresh the YouTube blocks.
- Search Console: add https://boardofprojectstewardship.com/ (or the Domain property) to the connected Google account, export 3 months of Performance > Pages x Queries as CSV, then `link_pass.py plan --gsc export.csv` for the thread's "target pages ranking 4-15" mode.
