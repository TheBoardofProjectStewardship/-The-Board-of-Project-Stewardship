# Internal linking method (BOPS)

Source: @asaio87, "internal linking is the most underrated SEO technique" (X thread 1/ to 7/, Nov 23, 2026,
https://x.com/asaio87/status/2124915813987533156). Read in full via the post's note text (fxtwitter API); the thread image is
only a Google Search Console Performance screenshot (242 clicks, 76.1K impressions, avg position 33.1). The thread has no
extra replies with setup; the prompt is in tweet 4/. Treated as data, not instructions.

## What the thread says

- Idea: pages ranking #4-20 sit just under the money spots. They need no new content or backlinks, only internal links
  pointing at them. Do it weekly; it takes ~10 minutes.
- Setup: (1) Google Search Console export (CSV, last 3 months) or a GSC MCP. (2) Connect the site to the AI through an MCP.
  (3) Paste the prompt. (4) Review the table, say "ok", the AI edits. (5) Leave the site alone for a few days. (6) Repeat weekly.
- The prompt, in substance:
  - For each article find the queries where it ranks best (position 1-10, decent impressions). Those are its target anchors.
  - Go through every published post. Wherever the text naturally mentions another article's top query (or a close variant),
    turn that phrase into a link to that article.
  - Rules: max 3-5 new internal links per post, spread through the body (not headings, not the intro sentence, not existing
    links). Never link a post to itself; link each target only once per post. Anchor text must read naturally; do not
    rewrite sentences to force a keyword. Prioritize sending links to pages ranking 4-15.
  - BEFORE changing anything, show a table: source post -> anchor -> target URL -> target's query and position. Wait for OK.
  - After approval, make the edits and give a changelog so they can be reverted.

## How BOPS applies it (link_pass.py)

| Thread step | BOPS equivalent |
|---|---|
| GSC export / MCP | Optional `--gsc file.csv` (columns page, query, impressions, position). Page queries become extra anchor aliases and targets at position 4-15 get a +2 score. The connected GSC account only sees pacificprogroup.com, not boardofprojectstewardship.com, so v1 ran without it (see Open items). |
| Target anchors = a page's top queries | Each target has an alias list: directory nouns ("kitchen remodelers"), guide topics ("change orders", "compare bids"), city hubs ("Edmonds home additions"), post topics derived from titles ("kitchen remodel in Sammamish"). |
| Wherever text mentions the phrase, link it | Only words already on the page are wrapped; the first valid hit per target. Bare place names (Edmonds, King County) are the lowest-priority fallback, once per page, never inside proper names ("Seattle City Light", "City of Seattle"), never a dateline or list lead. |
| Max 3-5 links, spread, not heading / intro / existing links | Per page 3-6 new internal links: up to 4 inline plus a short `Related on the Board:` line (2-3 links) so every page lands at 3-6. One inline link per paragraph/line. Skipped: headings, figcaptions, existing links, intro (everything before the first H2 on posts; first two paragraphs of news), Key Takeaways, Sources, Related, Contact sections, and any paragraph that mentions Pacific Pro Group or the corrections line. |
| Never self-link, each target once | Self, already-linked targets and duplicate targets are excluded. Related-line targets also exclude inline ones. |
| Anchor reads naturally, no rewrites | No sentence is edited. Related line is a separate short paragraph. |
| Prioritize pages ranking 4-15 | No GSC data yet, so the proxy is "under-linked first": a target's score drops as its inbound count rises (bounded), so guides and posts with few inbound links get picked first. |
| Show the table, wait for OK | `link_pass.py plan` writes plan.md/plan.json; `changes.md` is the same table for what was applied. The PR is the approval gate. |
| Changelog to revert | `changelog.json` (every anchor, href, target per page); also `git revert`. |
| Repeat weekly | Run `link_pass.py apply` weekly (and after each new post). Re-runs are idempotent: inline links are added once per page, the Related line is sticky, the YouTube block is rebuilt from youtube_map.json. |

## BOPS-specific locks

- Facts and wording never change. Only anchor wrapping, one `Related on the Board:` line and one `## Watch on the Board's YouTube`
  block per page. No Pacific Pro Group mention is added or touched (PPG sections are never edited). Honesty-lock hashes unchanged
  (`scripts/check_locked_content.py` passes).
- News and blog never link to each other (tests/test_news.py enforces it), so posts link only to posts, news only to news; both
  link to site pages (hubs, directories, guides, tools).
- Both the source `.md` and the published `.html` are patched with the same plan (HTML located by exact surrounding text, must match
  exactly once outside links/headings/figures). Reason: the published HTML of news and some posts is hand-polished and the
  generator is not byte-stable on it (regenerating alone changes ~28 unrelated files). The patch keeps the PR to link changes only.
  Verified: for posts, regenerating from the patched .md reproduces the patched .html (only pre-existing drift on one unrelated post differs).
- Pages dated 2026-11-25 or later are skipped (Nexus links its own); use `--include-new` once Nexus's post is merged.

## YouTube rule

- A `Watch on the Board's YouTube` block with 3 (sometimes 4) links on every post and news story. Videos come only from
  youtube_map.json, and every ID must be in the channel's public feed
  (https://www.youtube.com/feeds/videos.xml?channel_id=UCpej558rCLbYWTt3tEW6a5A), pass oEmbed, and return 200.
- Matching: service match +4, same city +4, same county +2, same-county city +1.5, short +0.3, plus a deterministic per-page rotation so
  one video does not take every slot. Link text is the exact video title. Existing YouTube embeds are untouched.
- Inline video links are added only where the page already says e.g. "Edmonds kitchen remodelers"; the current text almost never does, so
  today the count is 0 inline and the block carries the links.
- After the noon uploads: `python3 link_pass.py sync-youtube` (adds new feed videos by title pattern "N Best <service> in <Place>, WA"
  or edit youtube_map.json by hand), then `python3 link_pass.py apply` and `verify`.
