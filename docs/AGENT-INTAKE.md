# Agent intake contract

Ops document for the Board of Project Stewardship repository. This is not a public page. The canonical public site is **https://boardofprojectstewardship.com/** (GitHub Pages). Ghost stays off. Netlify is retired. Do not edit or deploy `pacificprogroup.com`.

This repository change does not publish a post, merge to `main`, or deploy.

## Who does what

Specialists stay specialists. They do not each become another writer, and none of them publish.

| Agent | Id | May submit | Must not |
| --- | --- | --- | --- |
| Chief of Staff | `chief-of-staff` | `coordination` notes, and one `post-bundle` that assembles the other packets | Author the article. Publish. Merge this pipeline's review by themselves. |
| Steward | `steward` | Nothing. Steward is the only publisher. | Originate draft copy. |
| Grok Build | `grok-build` | `media` packet: repo `assets/` paths, bytes, and alt text | Write the article. Publish. |
| OpenClaw (Allan-PC) | `openclaw` | `seo-brief`: slug, description support, internal links | Emit HTML. Publish. |
| Hermes (Allan-PC) | `hermes` | `sources`: cited public URLs | Invent facts. Publish. |
| Ollama (Allan-PC) | `ollama` | `draft`: Markdown only | Emit HTML. Publish. |

The Allan-PC OpenClaw / Hermes / Ollama refit on DESKTOP-B69F181 is out of scope here. Those agents target the paths and commands below.

## Paths

```text
intake/schema/manifest.schema.json          contract schema
intake/specialties.json                     role map
intake/inbox/<submission-id>/manifest.json  one packet
intake/inbox/<submission-id>/draft.md       Ollama article (post-bundle)
intake/inbox/<submission-id>/sources.json   Hermes citations
intake/inbox/<submission-id>/seo.json       OpenClaw brief (not copied into HTML)
intake/inbox/<submission-id>/media.json     Grok Build media map
intake/inbox/<submission-id>/media/         bytes named by media.json
intake/receipts/<submission-id>.json        written only by publish --apply
intake/lock/publish.lock                    local lock, gitignored, no secrets
tests/fixtures/intake/intake-contract-fixture/  deterministic example packet
```

`<submission-id>` matches `^[a-z0-9][a-z0-9-]{2,80}$` and must be the directory name.

`robots.txt` disallows `/intake/` so unpublished packets are not sitemap material. There is no public write endpoint and no form POST. `write.html` stays a noindex mailto page.

Do not put API keys, tokens, or private keys in any packet file. The validator rejects secret-shaped text and does not echo the secret.

## Post-bundle manifest

Required kind for anything Steward can publish. Producer is `chief-of-staff`. Roles are fixed:

```json
{
  "schema_version": "1.0.0",
  "submission_id": "2026-09-22-shoreline-roof-flashing",
  "kind": "post-bundle",
  "producer": "chief-of-staff",
  "created_at": "2026-09-22T17:00:00Z",
  "target": {
    "site": "https://boardofprojectstewardship.com/",
    "content_type": "blog-post"
  },
  "roles": {
    "assembler": "chief-of-staff",
    "draft": "ollama",
    "sources": "hermes",
    "seo": "openclaw",
    "media": "grok-build"
  },
  "post": {
    "title": "Clear editorial title",
    "date": "2026-09-22",
    "slug": "clear-editorial-slug",
    "description": "One sentence, 20 to 300 characters.",
    "category": "Guides"
  },
  "artifacts": {
    "draft": "draft.md",
    "sources": "sources.json",
    "seo": "seo.json",
    "media": "media.json"
  }
}
```

`created_at` is UTC `YYYY-MM-DDTHH:MM:SSZ`. Categories: `Guides`, `Additions`, `Kitchen`, `Bathrooms`, `Hiring Guides`, `Permits`. Draft frontmatter must match `post`. Public author on the HTML is always Board of Project Stewardship Editorial.

`example: true` validates and dry-runs, and `publish --apply` refuses it. The committed fixture uses that flag.

Optional `idempotency_key` (`sha256:` plus 64 hex characters) must match the tool's hash of the manifest without that field, plus the sha256 of each artifact and media file. Omit it and the tool computes it.

### sources.json

Hermes only. At least one source, and at least one `https` host ending in `.gov` (L&I Verify or a permit desk). Every source `url` must appear in the draft. Fields: `url`, `title`, `retrieved` (`YYYY-MM-DD`), `supports`.

### seo.json

OpenClaw only. `internal_links` is a list of `../page.html` paths, and each one must appear in the draft. `notes` are operator-only and are not written into HTML.

### media.json

Grok Build only. Each file has `intake_file`, `repo_path`, and `alt` for images.

Allowed repo paths:

- `assets/images/posts/<name>.webp`
- `assets/videos/posts/<name>.mp4`

The draft must reference images as `../assets/images/posts/<name>.webp`. A CloudFront URL, or any other `http(s)` image URL, is `media_path_rejected`. That keeps `generate_site.py` from rewriting a polished page that already uses repo assets. `publish --apply` also stops if the generated HTML still contains `cloudfront.net`.

A blog bundle needs at least three webp images, a YouTube process URL or a repo mp4 path, and three manufacturer or product `https` links that are not the Board site, YouTube, a `.gov` host, or `pacificprogroup.com`.

### Public-copy locks inside the draft, title, description, and alt text

Spell out Board of Project Stewardship. Do not write BOPS. Do not write AI, ChatGPT, Grok, Higgsfield, LLM, artificial intelligence, or other internal tool names. Do not invent prices, ROI, awards, star ratings, review counts, or founding years. Pacific Pro Group may appear only as the Board number-one contractor, with a link to `https://pacificprogroup.com/` (never `/contact/`). The only license token the checker accepts beside that name is the already published `PACIFPG765OF`.

## Commands

From the repository root:

```bash
python3 tools/board_intake.py validate intake/inbox/<submission-id>
python3 tools/board_intake.py validate
python3 tools/board_intake.py publish intake/inbox/<submission-id> --dry-run
python3 tools/board_intake.py publish intake/inbox/<submission-id> --apply
python3 tools/board_intake.py lock-status
python3 tools/board_intake.py morning
python3 tools/board_intake.py morning --apply
```

`publish` without `--apply` is a dry-run. Dry-run does not create the lock and does not write posts, media, indexes, or receipts.

`--apply` is Steward-only. It acquires `intake/lock/publish.lock` (holder `steward`, pid, timestamp; no secrets), re-validates, copies media and canonical Markdown, renders that one post through `generate_site.build_post_page` (site chrome, Article / BlogPosting, canonical, RSS link), then updates:

- `posts.json` (existing slugs kept; count must not fall, and a site that already has at least 46 posts stays at or above 46)
- `blog.html`
- `blog/rss.xml`
- `sitemap.xml` (the new post URL is inserted; other `<lastmod>` values are left as they are)

A fresh lock blocks a second publish with status `lock_held`. A lock older than 30 minutes is stale. Steward may pass `--force-lock` to replace a stale lock. The lock is removed when the command finishes, including on failure.

Stdout is one JSON object. Exit `0` means `ok`. Exit `2` is a validation failure. Exit `3` is `lock_held`. Exit `4` is `duplicate`, `conflict`, or `index_guard_failed`.

### Failure states

| Status | Meaning |
| --- | --- |
| `ready` | Post bundle can be published. |
| `accepted` | Specialist packet is valid and is not publishable. |
| `dry_run` | Validation passed and nothing was written. |
| `published` | Steward applied the bundle and wrote a receipt. |
| `idempotent_replay` | Same `submission_id` and same content hash as an existing receipt. No write. |
| `invalid_manifest` | Schema, id, date, or frontmatter mismatch. |
| `invalid_artifact` | Missing or unsafe path, or bad JSON. |
| `specialty_mismatch` | Producer or role is not the specialty that owns that artifact. |
| `forbidden_public_copy` | Public-copy lock failed. |
| `media_path_rejected` | Media is not a repo `assets/` path, or it is a CloudFront URL. |
| `missing_sources` | No usable source, or no `.gov` source. |
| `uncited_draft` | A source URL is missing from the draft. |
| `thin_media` | Body, images, video, or manufacturer links are below the daily floor. |
| `duplicate` | Slug, title, filename, body, or another inbox packet already claims the post. |
| `conflict` | Published id changed, or a destination asset already has different bytes. |
| `not_publishable` | Specialist packet, or an `example: true` bundle, cannot be applied. |
| `target_site_rejected` | Site is not `https://boardofprojectstewardship.com/` (includes any `pacificprogroup.com` target). |
| `secret_material` | Secret-shaped text. The secret is not printed. |
| `lock_held` | Another publish holds the lock, or the lock is stale. |
| `index_guard_failed` | The update would drop an existing post or shrink the 46-post floor. |
| `publish_failed` | Apply stopped before a receipt was written. |
| `unlocked` | `lock-status` when no lock file exists. |
| `skipped` | Morning inbox has no single bundle for that Pacific date. Nothing was published. |
| `already_published` | That Pacific date already has its one post. A rerun does not publish another. |
| `multiple_ready` | More than one post-bundle is dated that morning. None were published. |

## Idempotency

The key is `sha256:` of a canonical JSON document: the manifest without `idempotency_key`, plus sorted artifact and media paths with their file sha256. Re-applying the same bytes returns `idempotent_replay`. Changing the draft under a published id returns `conflict`. Roll the new work forward under a new `submission_id` only when it is actually a different post; do not reuse a slug.

## Proof of a dry-run

The committed example is not live content:

```bash
python3 tools/board_intake.py publish tests/fixtures/intake/intake-contract-fixture --dry-run
python3 -m unittest discover -s tests -v
```

Expected packet status is `ready` on validate and `not_publishable` on `--apply` because `example` is true. Unit tests apply a non-example copy only inside a temporary site root.

CI (`.github/workflows/intake-validate.yml`) runs the unit tests. It does not pass `--apply`.

## What `--apply` does not do

- It does not run `generate_site.py` over the whole site, so directory pages and already shipped post HTML are not rebuilt.
- It does not delete post HTML. `generate_site.py` itself now keeps HTML marked `<!-- board-post-polished -->` and keeps HTML that already uses `../assets/` when a rebuild would emit a CloudFront URL.
- It does not ping IndexNow, change GitHub Pages settings, or push.
- It does not open a network port.

Pushing an apply commit to `main` is what makes GitHub Pages serve it. That push is a separate Steward decision. This contract's pull request must not include an applied post.

## Migration

Existing posts stay where they are. There are 46 entries in `posts.json`, with matching `posts/*.md` and `posts/*.html`. Do not backfill them into `intake/inbox/`. The next new post is the first packet.

Daily order:

1. Ollama writes `draft.md`. Hermes writes `sources.json`. OpenClaw writes `seo.json`. Grok Build writes `media.json` and bytes under `media/`.
2. Chief of Staff assembles `intake/inbox/<submission-id>/` and opens a pull request that contains only that packet.
3. Steward runs `validate` and `publish --dry-run` and reads the JSON.
4. After review, Steward runs `publish --apply` on a checkout of that packet, reviews the diff (`posts/`, `assets/images/posts/` or `assets/videos/posts/`, `posts.json`, `blog.html`, `sitemap.xml`, `blog/rss.xml`, `intake/receipts/`), and commits it.
5. Nobody force-pushes `main` from this workflow.

`state/bops/blog-upgrade/media-rotation.json` is still an operator log of used material URLs and YouTube ids. The publisher does not rewrite it.

## Rollback

If `--apply` fails before a receipt, site files may be partial. Do not leave that tree dirty. From the repository root, restore tracked files and remove untracked outputs named in the JSON `wrote` list:

```bash
git checkout -- posts.json blog.html sitemap.xml blog/rss.xml
git clean -n -d posts assets/images/posts assets/videos/posts intake/receipts
```

Review the `git clean -n` list before dropping `-n`.

If a publish commit is already on a branch, `git revert` that commit. Also remove `intake/receipts/<submission-id>.json` in the revert. Leaving the receipt in place makes a later identical packet return `idempotent_replay` and skip the write. The publish lock is local and untracked; delete `intake/lock/publish.lock` only when no Steward publish is running.

Do not roll back the existing 46 posts as part of adopting this contract.

## Morning routine (existing 10:00 AM PT schedule)

Do not create a second schedule. The Nexus routine named `BOPS daily blog post` already runs every day at 10:00 AM Pacific (`America/Los_Angeles`). After the local agents are recoded and Steward/Forge has accepted this intake path, that same routine is what publishes. This repository does not install cron, a GitHub Actions `schedule`, or a second agent timer. CI must not call `morning --apply`. This pull request does not run it.

The routine's repo entrypoint is cron-safe: no prompts, one JSON object on stdout, a flushed exit code, and the same publish lock as `publish --apply`. It does not commit or push. The routine commits only when `"commit"` is true.

```bash
python3 tools/board_intake.py morning --apply
```

Without `--apply`, the same selection runs as a dry-run. `--date YYYY-MM-DD` pins the Pacific date for a test. The default date is today in `America/Los_Angeles`.

### How the routine uses the entrypoint

1. **Research and draft aggregation, before 10:00.** Hermes writes `sources`, OpenClaw writes `seo-brief`, Ollama writes `draft`, and Grok Build writes `media`. Chief of Staff assembles those artifacts into one `intake/inbox/<submission-id>/` post-bundle whose `post.date` is that Pacific morning. The morning command does not merge competing drafts and does not write article prose. Specialist directories left in the inbox are reported under `aggregation.specialist_packets` and are never published.
2. **Fail-closed validation.** The entrypoint validates that bundle with the same rules as `validate`. If it is not `ready`, the command publishes nothing and returns that failure status. If zero bundles match the date, status is `skipped`. If two or more post-bundles share the date, status is `multiple_ready` and none are published, including when one of them would have passed alone.
3. **Single Steward publish.** When exactly one bundle is `ready` and `posts.json` does not already contain that Pacific date, `morning --apply` calls the Steward publisher once. A second run the same morning returns `already_published` and writes nothing. `commit` is true only for status `published`.

Exit 0 means `published`, `already_published`, `skipped`, or a clean `dry_run`. Exit 2 is a validation failure. Exit 3 is `lock_held`. Exit 4 is `multiple_ready`, `duplicate`, `conflict`, or `index_guard_failed`. The routine must not `git commit` or `git push` unless `commit` is true.

## Handoff

**Chief of Staff:** own assembly and the review pull request. Before 10:00 AM PT, leave exactly one post-bundle dated that Pacific morning. Reject packets that fail `validate`. Do not run `--apply` or `morning --apply`. Do not merge, deploy, or send the packet to any host other than this GitHub repository.

**Steward:** own `publish --dry-run`, the publish lock, `publish --apply`, and the single `morning --apply` inside the existing 10:00 AM PT routine after Forge review. Confirm a dry-run JSON is clean before the routine passes `--apply`. Commit only when `commit` is true. Confirm the diff adds one post and does not drop slugs from `posts.json`, `sitemap.xml`, or `blog/rss.xml`. Do not add a second schedule. Do not regenerate the whole site unless you intend to, and do not overwrite polished post HTML with CloudFront URLs.
