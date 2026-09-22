#!/usr/bin/env python3
"""Controlled multi-agent intake for the Board of Project Stewardship site.

Specialists submit draft artifacts and source metadata under intake/inbox/.
Steward is the only publisher. This tool validates, deduplicates, and — only
with publish --apply — copies a post bundle onto the static site and updates
posts.json, blog.html, sitemap.xml, and blog/rss.xml.

There is no network listener and no credential file. Dry-run is the default
for publish.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import generate_site as gs  # noqa: E402

SCHEMA_VERSION = "1.0.0"
CANONICAL_SITE = "https://boardofprojectstewardship.com/"
CANONICAL_HOST = "boardofprojectstewardship.com"
PUBLISHER = "steward"
LOCK_TTL_SECONDS = 1800
LIVE_POST_FLOOR = 47
AUTHOR = "Board of Project Stewardship Editorial"

KINDS = ("post-bundle", "draft", "sources", "seo-brief", "media", "coordination")
SPECIALIST_KIND = {
    "post-bundle": "chief-of-staff",
    "draft": "ollama",
    "sources": "hermes",
    "seo-brief": "openclaw",
    "media": "grok-build",
    "coordination": "chief-of-staff",
}
REQUIRED_ROLES = {
    "assembler": "chief-of-staff",
    "draft": "ollama",
    "sources": "hermes",
    "seo": "openclaw",
    "media": "grok-build",
}
BUNDLE_ARTIFACTS = ("draft", "sources", "seo", "media")
KIND_ARTIFACT = {
    "draft": "draft",
    "sources": "sources",
    "seo-brief": "seo",
    "media": "media",
    "coordination": "coordination",
}
CATEGORIES = ("Guides", "Additions", "Kitchen", "Bathrooms", "Hiring Guides", "Permits")

STATUS_PRIORITY = (
    "secret_material",
    "target_site_rejected",
    "invalid_manifest",
    "invalid_artifact",
    "specialty_mismatch",
    "forbidden_public_copy",
    "media_path_rejected",
    "missing_sources",
    "uncited_draft",
    "thin_media",
    "conflict",
    "duplicate",
    "not_publishable",
    "lock_held",
    "index_guard_failed",
    "publish_failed",
)

SECRET_PATTERNS = (
    re.compile(r"BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY"),
    re.compile(r"\b(?:api[_-]?key|secret|access[_-]?token|password)\b\s*[:=]\s*\S+", re.I),
    re.compile(r"\bghp_[A-Za-z0-9]{20,}"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"\bsk-[A-Za-z0-9]{20,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
)

FORBIDDEN_PUBLIC = (
    (re.compile(r"(?<![A-Za-z0-9])BOPS(?![A-Za-z0-9])"), "public copy must spell out Board of Project Stewardship"),
    (re.compile(r"(?<![A-Za-z])AI(?![A-Za-z])"), "public copy must not say AI"),
    (re.compile(r"A\.I\.", re.I), "public copy must not say A.I."),
    (re.compile(r"artificial intelligence", re.I), "public copy must not say artificial intelligence"),
    (re.compile(r"\bchatgpt\b", re.I), "public copy must not name ChatGPT"),
    (re.compile(r"\bhiggsfield\b", re.I), "public copy must not name internal tooling"),
    (re.compile(r"\bgrok\b", re.I), "public copy must not name internal tooling"),
    (re.compile(r"\bollama\b", re.I), "public copy must not name internal tooling"),
    (re.compile(r"\bopenclaw\b", re.I), "public copy must not name internal tooling"),
    (re.compile(r"\bhermes\b", re.I), "public copy must not name internal tooling"),
    (re.compile(r"\bllm\b", re.I), "public copy must not say LLM"),
    (re.compile(r"ghost\.io|\bnetlify\b", re.I), "public copy must not name retired hosts"),
    (re.compile(r"pacificprogroup\.com/contact", re.I), "Pacific Pro Group links use https://pacificprogroup.com/"),
    (re.compile(r"\$\s?\d"), "do not invent prices"),
    (re.compile(r"\bROI\b"), "do not invent ROI"),
    (re.compile(r"award[- ]winning", re.I), "do not invent awards"),
    (re.compile(r"\b\d+(\.\d+)?\s*(?:★|stars?)\b", re.I), "do not invent star ratings"),
    (re.compile(r"\b\d[\d,]*\s+reviews\b", re.I), "do not invent review counts"),
    (re.compile(r"\bfounded in\b", re.I), "do not invent founding years"),
)

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,80}$")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CREATED_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
IMAGE_REPO_RE = re.compile(r"^assets/images/posts/[a-z0-9][a-z0-9._-]*\.webp$")
VIDEO_REPO_RE = re.compile(r"^assets/videos/posts/[a-z0-9][a-z0-9._-]*\.mp4$")
IMG_MD_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
YT_RE = re.compile(
    r"https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)[A-Za-z0-9_-]{6,20}\b|youtube:[A-Za-z0-9_-]{6,20}"
)
LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
POST_SITEMAP_RE = re.compile(
    r"  <url>\n    <loc>https://boardofprojectstewardship\.com/posts/([^<]+)</loc>\n"
    r"    <lastmod>([^<]+)</lastmod>\n    <changefreq>weekly</changefreq>\n"
    r"    <priority>0\.6</priority>\n  </url>\n"
)

EXIT_CODES = {
    "lock_held": 3,
    "conflict": 4,
    "duplicate": 4,
    "index_guard_failed": 4,
    "multiple_ready": 4,
}
# The only morning schedule. This repository does not install a second cron.
MORNING_ROUTINE = "BOPS daily blog post"
MORNING_WHEN = "10:00 AM PT"
MORNING_TZ = ZoneInfo("America/Los_Angeles")


class IntakeFailure(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _load_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise IntakeFailure("invalid_artifact", f"cannot read JSON {path.name}") from exc
    if not isinstance(data, dict):
        raise IntakeFailure("invalid_artifact", f"{path.name} must be a JSON object")
    return data


def _rel_under(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def _safe_child(base: Path, rel: str) -> Path:
    if not rel or rel.startswith(("/", "\\")) or "\\" in rel:
        raise IntakeFailure("invalid_artifact", "artifact path must be relative")
    parts = Path(rel).parts
    if any(part in ("", ".", "..") for part in parts):
        raise IntakeFailure("invalid_artifact", "artifact path must stay inside the packet")
    dest = (base / rel).resolve()
    try:
        dest.relative_to(base.resolve())
    except ValueError as exc:
        raise IntakeFailure("invalid_artifact", "artifact path escapes the packet") from exc
    return dest


def _scan_secrets(label: str, text: str, errors: list[dict]) -> None:
    for pattern in SECRET_PATTERNS:
        if pattern.search(text):
            errors.append({
                "code": "secret_material",
                "message": f"{label} contains secret-shaped material; remove it before intake",
            })
            return


def _scan_public(label: str, text: str, errors: list[dict]) -> None:
    for pattern, message in FORBIDDEN_PUBLIC:
        if pattern.search(text):
            errors.append({"code": "forbidden_public_copy", "message": f"{label}: {message}"})
            return
    if re.search(r"pacific pro group", text, re.I) or "pacificprogroup.com" in text.lower():
        if "https://pacificprogroup.com/" not in text:
            errors.append({
                "code": "forbidden_public_copy",
                "message": f"{label}: Pacific Pro Group may appear only as the Board number-one contractor linking to https://pacificprogroup.com/",
            })
        if re.search(r"\b(owned by|parent company|our company)\b", text, re.I):
            errors.append({
                "code": "forbidden_public_copy",
                "message": f"{label}: do not describe the Board as owned by Pacific Pro Group",
            })
    if "PACIFPG" in text and "PACIFPG765OF" not in text:
        errors.append({
            "code": "forbidden_public_copy",
            "message": f"{label}: unverified license token",
        })


def _normalize_site(site: str) -> str:
    site = (site or "").strip()
    if site == CANONICAL_HOST or site == f"https://{CANONICAL_HOST}":
        return CANONICAL_SITE
    if site.rstrip("/") == f"https://{CANONICAL_HOST}":
        return CANONICAL_SITE
    return site


def _priority_status(codes: list[str], default: str) -> str:
    for code in STATUS_PRIORITY:
        if code in codes:
            return code
    return default


def _result(
    *,
    ok: bool,
    status: str,
    submission_id: str | None = None,
    errors: list[dict] | None = None,
    dry_run: bool = False,
    publishable: bool = False,
    wrote: list[str] | None = None,
    planned_writes: list[str] | None = None,
    idempotency_key: str | None = None,
    message: str = "",
    extra: dict | None = None,
) -> dict:
    payload = {
        "ok": ok,
        "status": status,
        "submission_id": submission_id,
        "publishable": publishable,
        "dry_run": dry_run,
        "idempotency_key": idempotency_key,
        "message": message,
        "errors": errors or [],
        "planned_writes": planned_writes or [],
        "wrote": wrote or [],
    }
    if extra:
        payload.update(extra)
    return payload


def canonical_idempotency_key(packet: Path, manifest: dict) -> str:
    cleaned = json.loads(json.dumps(manifest))
    cleaned.pop("idempotency_key", None)
    files = []
    artifacts = manifest.get("artifacts") if isinstance(manifest.get("artifacts"), dict) else {}
    rels: list[str] = []
    for rel in artifacts.values():
        if isinstance(rel, str):
            rels.append(rel)
    media_rel = artifacts.get("media")
    if isinstance(media_rel, str):
        media_path = _safe_child(packet, media_rel)
        if media_path.is_file():
            try:
                media = _load_json(media_path)
            except IntakeFailure:
                media = {}
            for item in media.get("files") or []:
                if isinstance(item, dict) and isinstance(item.get("intake_file"), str):
                    rels.append(item["intake_file"])
    seen = set()
    for rel in sorted(rels):
        if rel in seen:
            continue
        seen.add(rel)
        path = _safe_child(packet, rel)
        if not path.is_file():
            files.append({"path": rel, "sha256": None})
            continue
        files.append({"path": rel, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    blob = json.dumps({"manifest": cleaned, "files": files}, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:" + hashlib.sha256(blob).hexdigest()


def _receipt_path(root: Path, submission_id: str) -> Path:
    return root / "intake" / "receipts" / f"{submission_id}.json"


def _read_receipt(root: Path, submission_id: str) -> dict | None:
    path = _receipt_path(root, submission_id)
    if not path.is_file():
        return None
    return _load_json(path)


def _existing_posts(root: Path) -> list[dict]:
    path = root / "posts.json"
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise IntakeFailure("index_guard_failed", "posts.json is not valid JSON") from exc
    if not isinstance(data, list):
        raise IntakeFailure("index_guard_failed", "posts.json must be a list")
    return data


def _normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", title).strip().casefold()


def _body_hash(markdown: str) -> str:
    meta, body = gs.parse_frontmatter(markdown)
    del meta
    squashed = re.sub(r"\s+", " ", body).strip()
    return hashlib.sha256(squashed.encode("utf-8")).hexdigest()


def validate_packet(packet: Path, root: Path) -> dict:
    """Validate one intake directory. Does not write site files."""
    packet = packet.resolve()
    root = root.resolve()
    errors: list[dict] = []
    if not packet.is_dir():
        return _result(ok=False, status="invalid_manifest", message="submission directory is missing", errors=[{
            "code": "invalid_manifest",
            "message": "submission directory is missing",
        }])
    manifest_path = packet / "manifest.json"
    if not manifest_path.is_file():
        return _result(ok=False, status="invalid_manifest", message="manifest.json is required", errors=[{
            "code": "invalid_manifest",
            "message": "manifest.json is required",
        }])
    try:
        raw = manifest_path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return _result(ok=False, status="invalid_manifest", message="manifest.json is unreadable", errors=[{
            "code": "invalid_manifest",
            "message": "manifest.json is unreadable",
        }])
    _scan_secrets("manifest.json", raw, errors)
    try:
        manifest = json.loads(raw)
    except json.JSONDecodeError:
        errors.append({"code": "invalid_manifest", "message": "manifest.json is not valid JSON"})
        return _finish(errors, None, None, False, "manifest.json is not valid JSON")
    if not isinstance(manifest, dict):
        errors.append({"code": "invalid_manifest", "message": "manifest.json must be an object"})
        return _finish(errors, None, None, False, "manifest.json must be an object")

    submission_id = manifest.get("submission_id")
    if not isinstance(submission_id, str) or not ID_RE.match(submission_id):
        errors.append({"code": "invalid_manifest", "message": "submission_id must match ^[a-z0-9][a-z0-9-]{2,80}$"})
        submission_id = submission_id if isinstance(submission_id, str) else None
    if isinstance(submission_id, str) and packet.name != submission_id:
        errors.append({"code": "invalid_manifest", "message": "directory name must equal submission_id"})

    if manifest.get("schema_version") != SCHEMA_VERSION:
        errors.append({"code": "invalid_manifest", "message": "schema_version must be 1.0.0"})
    kind = manifest.get("kind")
    producer = manifest.get("producer")
    if kind not in KINDS:
        errors.append({"code": "invalid_manifest", "message": "kind is not a known intake kind"})
    elif producer != SPECIALIST_KIND.get(kind):
        errors.append({
            "code": "specialty_mismatch",
            "message": f"{kind} packets are produced by {SPECIALIST_KIND.get(kind)}, not {producer}",
        })
    if producer == PUBLISHER:
        errors.append({"code": "specialty_mismatch", "message": "Steward publishes and does not author intake packets"})
    created = manifest.get("created_at")
    if not isinstance(created, str) or not CREATED_RE.match(created):
        errors.append({"code": "invalid_manifest", "message": "created_at must be UTC YYYY-MM-DDTHH:MM:SSZ"})

    target = manifest.get("target") if isinstance(manifest.get("target"), dict) else None
    if not target:
        errors.append({"code": "invalid_manifest", "message": "target.site and target.content_type are required"})
    else:
        site = _normalize_site(str(target.get("site", "")))
        if "pacificprogroup.com" in str(target.get("site", "")).lower():
            errors.append({"code": "target_site_rejected", "message": "packets cannot target pacificprogroup.com"})
        elif site != CANONICAL_SITE:
            errors.append({
                "code": "target_site_rejected",
                "message": "target.site must be https://boardofprojectstewardship.com/",
            })
        if kind == "post-bundle" and target.get("content_type") != "blog-post":
            errors.append({"code": "invalid_manifest", "message": "post-bundle content_type must be blog-post"})
        elif target.get("content_type") not in ("blog-post", "note"):
            errors.append({"code": "invalid_manifest", "message": "content_type must be blog-post or note"})

    artifacts = manifest.get("artifacts") if isinstance(manifest.get("artifacts"), dict) else None
    if artifacts is None:
        errors.append({"code": "invalid_manifest", "message": "artifacts object is required"})
        artifacts = {}

    idempotency_key = None
    try:
        idempotency_key = canonical_idempotency_key(packet, manifest)
    except IntakeFailure as exc:
        errors.append({"code": exc.code, "message": exc.message})
    stated = manifest.get("idempotency_key")
    if stated is not None and idempotency_key and stated != idempotency_key:
        errors.append({"code": "invalid_manifest", "message": "idempotency_key does not match packet bytes"})

    texts: dict[str, str] = {}
    if kind in KIND_ARTIFACT:
        rel_key = KIND_ARTIFACT[kind]
        rel = artifacts.get(rel_key)
        if not isinstance(rel, str):
            errors.append({"code": "invalid_artifact", "message": f"artifacts.{rel_key} is required for {kind}"})
        else:
            _read_artifact(packet, rel, texts, errors)
    if kind == "post-bundle" and isinstance(manifest.get("artifacts"), dict):
        roles = manifest.get("roles") if isinstance(manifest.get("roles"), dict) else {}
        for role, agent in REQUIRED_ROLES.items():
            if roles.get(role) != agent:
                errors.append({
                    "code": "specialty_mismatch",
                    "message": f"roles.{role} must be {agent}",
                })
        for rel_key in BUNDLE_ARTIFACTS:
            rel = artifacts.get(rel_key)
            if not isinstance(rel, str):
                errors.append({"code": "invalid_artifact", "message": f"artifacts.{rel_key} is required"})
            else:
                _read_artifact(packet, rel, texts, errors)
        _validate_bundle(packet, root, manifest, texts, errors)
    elif kind in ("sources", "seo-brief", "media", "coordination", "draft"):
        _validate_specialist(kind, texts, errors)

    for label, text in texts.items():
        _scan_secrets(label, text, errors)

    receipt = None
    if isinstance(submission_id, str) and ID_RE.match(submission_id):
        try:
            receipt = _read_receipt(root, submission_id)
        except IntakeFailure as exc:
            errors.append({"code": exc.code, "message": exc.message})
    if receipt and idempotency_key:
        if receipt.get("idempotency_key") == idempotency_key and receipt.get("status") == "published":
            return _result(
                ok=True,
                status="idempotent_replay",
                submission_id=submission_id if isinstance(submission_id, str) else None,
                dry_run=True,
                publishable=False,
                idempotency_key=idempotency_key,
                message="this packet was already published; no write is required",
                extra={"receipt": str(_receipt_path(root, submission_id).relative_to(root))},
            )
        if receipt.get("idempotency_key") != idempotency_key and receipt.get("status") == "published":
            errors.append({
                "code": "conflict",
                "message": "submission_id was already published with a different idempotency key",
            })

    if kind == "post-bundle" and manifest.get("example") and not any(e["code"] != "not_publishable" for e in errors):
        status = "ready" if not errors else _priority_status([e["code"] for e in errors], "invalid_manifest")
        ok = not errors
        message = "example packet is valid for dry-run and cannot be applied" if ok else "example packet failed validation"
        return _result(
            ok=ok,
            status=status if ok else status,
            submission_id=submission_id if isinstance(submission_id, str) else None,
            errors=errors,
            publishable=False,
            idempotency_key=idempotency_key,
            message=message,
            extra={"example": True},
        )
    if errors:
        status = _priority_status([e["code"] for e in errors], "invalid_manifest")
        return _result(
            ok=False,
            status=status,
            submission_id=submission_id if isinstance(submission_id, str) else None,
            errors=errors,
            publishable=False,
            idempotency_key=idempotency_key,
            message=errors[0]["message"],
        )
    if kind == "post-bundle":
        return _result(
            ok=True,
            status="ready",
            submission_id=submission_id,
            publishable=True,
            idempotency_key=idempotency_key,
            message="post bundle is ready for Steward",
        )
    return _result(
        ok=True,
        status="accepted",
        submission_id=submission_id if isinstance(submission_id, str) else None,
        publishable=False,
        idempotency_key=idempotency_key,
        message=f"{kind} packet accepted; only a post-bundle can be published",
    )


def _finish(errors, submission_id, key, publishable, message):
    status = _priority_status([e["code"] for e in errors], "invalid_manifest")
    return _result(
        ok=False,
        status=status,
        submission_id=submission_id,
        errors=errors,
        publishable=publishable,
        idempotency_key=key,
        message=message,
    )


def _read_artifact(packet: Path, rel: str, texts: dict[str, str], errors: list[dict]) -> None:
    try:
        path = _safe_child(packet, rel)
    except IntakeFailure as exc:
        errors.append({"code": exc.code, "message": exc.message})
        return
    if not path.is_file():
        errors.append({"code": "invalid_artifact", "message": f"missing artifact {rel}"})
        return
    try:
        texts[rel] = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        errors.append({"code": "invalid_artifact", "message": f"artifact {rel} is not UTF-8 text"})


def _validate_specialist(kind: str, texts: dict[str, str], errors: list[dict]) -> None:
    """Specialist packets are accepted only when their own artifact is well-formed."""
    if not texts:
        return
    rel, raw = next(iter(texts.items()))
    if kind == "coordination":
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            errors.append({"code": "invalid_artifact", "message": "coordination artifact must be JSON"})
            return
        if not isinstance(data, dict) or not isinstance(data.get("summary"), str) or not data["summary"].strip():
            errors.append({"code": "invalid_artifact", "message": "coordination summary is required"})
        return
    if kind == "draft":
        _scan_public(rel, raw, errors)
        if "cloudfront.net" in raw.lower():
            errors.append({
                "code": "media_path_rejected",
                "message": "draft markdown must use repo assets/ paths, not CloudFront URLs",
            })
        return
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        errors.append({"code": "invalid_artifact", "message": f"{rel} must be JSON"})
        return
    if not isinstance(data, dict):
        errors.append({"code": "invalid_artifact", "message": f"{rel} must be a JSON object"})
        return
    expected = {"sources": "hermes", "seo-brief": "openclaw", "media": "grok-build"}[kind]
    if data.get("producer") != expected:
        errors.append({"code": "specialty_mismatch", "message": f"{rel} producer must be {expected}"})
    if kind == "sources" and not isinstance(data.get("sources"), list):
        errors.append({"code": "missing_sources", "message": "sources.json needs a sources list"})
    if kind == "seo-brief" and not isinstance(data.get("internal_links"), list):
        errors.append({"code": "invalid_artifact", "message": "seo.json needs internal_links"})
    if kind == "media" and not isinstance(data.get("files"), list):
        errors.append({"code": "invalid_artifact", "message": "media.json needs files"})


def _validate_bundle(packet: Path, root: Path, manifest: dict, texts: dict[str, str], errors: list[dict]) -> None:
    post = manifest.get("post") if isinstance(manifest.get("post"), dict) else None
    if not post:
        errors.append({"code": "invalid_manifest", "message": "post object is required on a post-bundle"})
        return
    title = post.get("title")
    date = post.get("date")
    slug = post.get("slug")
    description = post.get("description")
    category = post.get("category")
    if not isinstance(title, str) or not (8 <= len(title) <= 140):
        errors.append({"code": "invalid_manifest", "message": "post.title must be 8–140 characters"})
        title = title if isinstance(title, str) else ""
    if not isinstance(date, str) or not DATE_RE.match(date):
        errors.append({"code": "invalid_manifest", "message": "post.date must be YYYY-MM-DD"})
        date = ""
    else:
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            errors.append({"code": "invalid_manifest", "message": "post.date is not a real calendar date"})
    if not isinstance(slug, str) or not SLUG_RE.match(slug) or len(slug) > 80:
        errors.append({"code": "invalid_manifest", "message": "post.slug must be kebab-case, at most 80 characters"})
        slug = ""
    if not isinstance(description, str) or not (20 <= len(description) <= 300):
        errors.append({"code": "invalid_manifest", "message": "post.description must be 20–300 characters"})
        description = description if isinstance(description, str) else ""
    for key in ("title", "date", "slug", "description", "category"):
        value = post.get(key)
        if isinstance(value, str) and '"' in value:
            errors.append({"code": "invalid_manifest", "message": f"post.{key} cannot contain a double quote"})
    if category not in CATEGORIES:
        errors.append({"code": "invalid_manifest", "message": "post.category is not a Board blog category"})
        category = ""

    for label, text in (("post.title", title), ("post.description", description)):
        if text:
            _scan_public(label, text, errors)

    draft_rel = manifest["artifacts"].get("draft")
    draft = texts.get(draft_rel, "") if isinstance(draft_rel, str) else ""
    if draft:
        meta, body = gs.parse_frontmatter(draft)
        for key, expected in (
            ("title", title),
            ("date", date),
            ("slug", slug),
            ("description", description),
            ("category", category),
        ):
            if expected and meta.get(key) != expected:
                errors.append({
                    "code": "invalid_manifest",
                    "message": f"draft frontmatter {key} must match manifest.post.{key}",
                })
        if "author" in meta and meta["author"] != AUTHOR:
            errors.append({
                "code": "forbidden_public_copy",
                "message": "public author is Board of Project Stewardship Editorial",
            })
        _scan_public("draft.md", draft, errors)
        _validate_media(packet, root, manifest, texts, body, errors)
        _validate_sources(manifest, texts, draft, errors)
        _validate_seo(manifest, texts, draft, errors)
        _validate_duplicate(root, packet, title, slug, date, draft, errors)
        if body and len(re.sub(r"\s+", " ", body).strip()) < 400:
            errors.append({"code": "thin_media", "message": "draft body is below the daily usefulness floor"})


def _validate_media(packet, root, manifest, texts, body, errors) -> None:
    media_rel = manifest["artifacts"].get("media")
    raw = texts.get(media_rel, "") if isinstance(media_rel, str) else ""
    try:
        media = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        errors.append({"code": "invalid_artifact", "message": "media.json is not valid JSON"})
        return
    if not isinstance(media, dict):
        errors.append({"code": "invalid_artifact", "message": "media.json must be an object"})
        return
    if media.get("producer") != "grok-build":
        errors.append({"code": "specialty_mismatch", "message": "media.json producer must be grok-build"})
    files = media.get("files")
    if not isinstance(files, list):
        errors.append({"code": "invalid_artifact", "message": "media.json files must be a list"})
        return
    images = []
    videos = []
    for item in files:
        if not isinstance(item, dict):
            errors.append({"code": "invalid_artifact", "message": "media file entry must be an object"})
            continue
        repo_path = item.get("repo_path")
        intake_file = item.get("intake_file")
        alt = item.get("alt", "")
        if not isinstance(repo_path, str) or not isinstance(intake_file, str):
            errors.append({"code": "media_path_rejected", "message": "media entries need intake_file and repo_path"})
            continue
        if "cloudfront.net" in repo_path.lower() or repo_path.startswith(("http://", "https://")):
            errors.append({"code": "media_path_rejected", "message": "media repo_path must be a repo assets/ path"})
            continue
        is_image = IMAGE_REPO_RE.match(repo_path) is not None
        is_video = VIDEO_REPO_RE.match(repo_path) is not None
        if not is_image and not is_video:
            errors.append({
                "code": "media_path_rejected",
                "message": "repo_path must be assets/images/posts/*.webp or assets/videos/posts/*.mp4",
            })
            continue
        try:
            src = _safe_child(packet, intake_file)
        except IntakeFailure as exc:
            errors.append({"code": exc.code, "message": exc.message})
            continue
        if not src.is_file() or src.stat().st_size <= 0:
            errors.append({"code": "invalid_artifact", "message": f"missing media bytes {intake_file}"})
            continue
        if is_image:
            if not isinstance(alt, str) or not alt.strip():
                errors.append({"code": "invalid_artifact", "message": f"{repo_path} needs alt text"})
            else:
                _scan_public(f"alt:{repo_path}", alt, errors)
            images.append(repo_path)
        else:
            videos.append(repo_path)
        dest = root / repo_path
        if dest.is_file() and dest.read_bytes() != src.read_bytes():
            errors.append({
                "code": "conflict",
                "message": f"{repo_path} already exists with different bytes",
            })
    if "cloudfront.net" in body.lower():
        errors.append({
            "code": "media_path_rejected",
            "message": "draft markdown must use repo assets/ paths, not CloudFront URLs",
        })
    for alt, src in IMG_MD_RE.findall(body):
        if src.startswith(("http://", "https://")):
            errors.append({"code": "media_path_rejected", "message": f"image {src} must be a repo assets/ path"})
            continue
        rel = src[3:] if src.startswith("../") else src.lstrip("./")
        if rel not in images:
            errors.append({
                "code": "media_path_rejected",
                "message": f"image {src} is not listed as assets/images/posts/*.webp in media.json",
            })
        if alt.strip():
            _scan_public("image alt", alt, errors)
    for repo_path in images:
        if f"../{repo_path}" not in body and f"({repo_path})" not in body:
            errors.append({
                "code": "media_path_rejected",
                "message": f"draft must reference ../{repo_path}",
            })
    local_video = any(f"../{path}" in body or path in body for path in videos)
    has_youtube = YT_RE.search(body) is not None
    if len(images) < 3:
        errors.append({"code": "thin_media", "message": "a blog post needs at least 3 repo webp images"})
    if not local_video and not has_youtube:
        errors.append({"code": "thin_media", "message": "a blog post needs a repo mp4 or a YouTube process URL"})
    if videos and not local_video:
        errors.append({"code": "media_path_rejected", "message": "draft must reference the repo mp4 path"})
    material_hosts = []
    for href in LINK_RE.findall(body):
        if not href.startswith("https://"):
            continue
        host = href.split("/")[2].lower()
        if host.endswith(".gov") or host in {
            "youtube.com",
            "www.youtube.com",
            "youtu.be",
            "boardofprojectstewardship.com",
            "www.boardofprojectstewardship.com",
            "pacificprogroup.com",
            "www.pacificprogroup.com",
        }:
            continue
        material_hosts.append(host)
    if len(material_hosts) < 3:
        errors.append({
            "code": "thin_media",
            "message": "a blog post needs at least 3 manufacturer or product https links",
        })


def _validate_sources(manifest, texts, draft, errors) -> None:
    rel = manifest["artifacts"].get("sources")
    raw = texts.get(rel, "") if isinstance(rel, str) else ""
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        errors.append({"code": "invalid_artifact", "message": "sources.json is not valid JSON"})
        return
    if data.get("producer") != "hermes":
        errors.append({"code": "specialty_mismatch", "message": "sources.json producer must be hermes"})
    sources = data.get("sources")
    if not isinstance(sources, list) or not sources:
        errors.append({"code": "missing_sources", "message": "sources.json needs at least one source"})
        return
    saw_gov = False
    for source in sources:
        if not isinstance(source, dict):
            errors.append({"code": "missing_sources", "message": "each source must be an object"})
            continue
        url = source.get("url")
        title = source.get("title")
        retrieved = source.get("retrieved")
        supports = source.get("supports")
        if not all(isinstance(v, str) and v.strip() for v in (url, title, retrieved, supports)):
            errors.append({
                "code": "missing_sources",
                "message": "each source needs url, title, retrieved, and supports",
            })
            continue
        if not url.startswith("https://"):
            errors.append({"code": "missing_sources", "message": "source URLs must be https"})
            continue
        if not DATE_RE.match(retrieved):
            errors.append({"code": "missing_sources", "message": "source.retrieved must be YYYY-MM-DD"})
        host = url.split("/")[2].lower()
        if host.endswith(".gov"):
            saw_gov = True
        if url not in draft:
            errors.append({
                "code": "uncited_draft",
                "message": f"draft must include source URL {url}",
            })
        _scan_public("source.supports", supports, errors)
        _scan_public("source.title", title, errors)
    if not saw_gov:
        errors.append({
            "code": "missing_sources",
            "message": "at least one source must be an https .gov page (L&I Verify or a permit desk)",
        })


def _validate_seo(manifest, texts, draft, errors) -> None:
    rel = manifest["artifacts"].get("seo")
    raw = texts.get(rel, "") if isinstance(rel, str) else ""
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        errors.append({"code": "invalid_artifact", "message": "seo.json is not valid JSON"})
        return
    if data.get("producer") != "openclaw":
        errors.append({"code": "specialty_mismatch", "message": "seo.json producer must be openclaw"})
    links = data.get("internal_links")
    if not isinstance(links, list) or not links:
        errors.append({"code": "invalid_artifact", "message": "seo.json internal_links must name at least one Board page"})
        return
    for href in links:
        if not isinstance(href, str) or not re.match(r"^\.\./[a-z0-9-]+\.html$", href):
            errors.append({"code": "invalid_artifact", "message": f"internal link {href} must look like ../page.html"})
            continue
        if href not in draft:
            errors.append({"code": "invalid_artifact", "message": f"draft is missing SEO internal link {href}"})
    notes = data.get("notes")
    if isinstance(notes, str):
        _scan_secrets("seo.json notes", notes, errors)


def _validate_duplicate(root, packet, title, slug, date, draft, errors) -> None:
    if not slug:
        return
    out_name = f"{date}-{slug}.html" if date else ""
    posts = _existing_posts(root)
    titles = {_normalize_title(p.get("title", "")) for p in posts if isinstance(p, dict)}
    slugs = {p.get("slug") for p in posts if isinstance(p, dict)}
    if slug in slugs:
        errors.append({"code": "duplicate", "message": f"slug {slug} is already in posts.json"})
    if title and _normalize_title(title) in titles:
        errors.append({"code": "duplicate", "message": "title matches an existing post"})
    if out_name and (root / "posts" / out_name).is_file():
        errors.append({"code": "duplicate", "message": f"posts/{out_name} already exists"})
    md_name = f"{date}-{slug}.md" if date else ""
    if md_name and (root / "posts" / md_name).is_file():
        errors.append({"code": "duplicate", "message": f"posts/{md_name} already exists"})
    new_hash = _body_hash(draft)
    posts_dir = root / "posts"
    if posts_dir.is_dir():
        for path in posts_dir.glob("*.md"):
            if path.name.startswith("_"):
                continue
            try:
                existing = path.read_text(encoding="utf-8")
            except (OSError, UnicodeError):
                continue
            if _body_hash(existing) == new_hash:
                errors.append({"code": "duplicate", "message": f"draft body matches {path.name}"})
                break
    inbox = root / "intake" / "inbox"
    if inbox.is_dir():
        for other in inbox.iterdir():
            if not other.is_dir() or other.resolve() == packet.resolve():
                continue
            other_manifest = other / "manifest.json"
            if not other_manifest.is_file():
                continue
            try:
                data = json.loads(other_manifest.read_text(encoding="utf-8"))
            except (OSError, UnicodeError, json.JSONDecodeError):
                continue
            other_slug = (data.get("post") or {}).get("slug") if isinstance(data.get("post"), dict) else None
            if other_slug and other_slug == slug:
                errors.append({
                    "code": "duplicate",
                    "message": f"slug {slug} is also claimed by intake packet {other.name}",
                })


def _media_outputs(packet: Path, manifest: dict) -> list[str]:
    media = _load_json(_safe_child(packet, manifest["artifacts"]["media"]))
    return [item["repo_path"] for item in media.get("files") or []]


def _planned(packet: Path, manifest: dict) -> list[str]:
    post = manifest["post"]
    stem = f"{post['date']}-{post['slug']}"
    outputs = [f"posts/{stem}.md", f"posts/{stem}.html"]
    outputs.extend(_media_outputs(packet, manifest))
    outputs.extend([
        "posts.json",
        "blog.html",
        "sitemap.xml",
        "blog/rss.xml",
        f"intake/receipts/{manifest['submission_id']}.json",
    ])
    return outputs


def guard_post_index(before: list[dict], after: list[dict]) -> None:
    before_slugs = [p.get("slug") for p in before if isinstance(p, dict)]
    after_slugs = [p.get("slug") for p in after if isinstance(p, dict)]
    missing = [slug for slug in before_slugs if slug not in after_slugs]
    if missing:
        raise IntakeFailure("index_guard_failed", "publish would drop existing post slugs: " + ", ".join(missing))
    if len(after_slugs) < len(before_slugs):
        raise IntakeFailure("index_guard_failed", "publish would shrink posts.json")
    if len(before_slugs) >= LIVE_POST_FLOOR and len(after_slugs) < LIVE_POST_FLOOR:
        raise IntakeFailure("index_guard_failed", f"posts.json must stay at or above {LIVE_POST_FLOOR} posts")


def insert_sitemap_post(sitemap: str, out_name: str, date: str) -> str:
    loc = f"https://boardofprojectstewardship.com/posts/{out_name}"
    if loc in sitemap:
        return sitemap
    block = (
        "  <url>\n"
        f"    <loc>{loc}</loc>\n"
        f"    <lastmod>{date}</lastmod>\n"
        "    <changefreq>weekly</changefreq>\n"
        "    <priority>0.6</priority>\n"
        "  </url>\n"
    )
    matches = list(POST_SITEMAP_RE.finditer(sitemap))
    if not matches:
        if "</urlset>\n" not in sitemap and not sitemap.rstrip().endswith("</urlset>"):
            raise IntakeFailure("index_guard_failed", "sitemap.xml has no post entries to extend")
        trimmed = sitemap.rstrip()
        if not trimmed.endswith("</urlset>"):
            raise IntakeFailure("index_guard_failed", "sitemap.xml is missing </urlset>")
        return trimmed[: -len("</urlset>")] + block + "</urlset>\n"
    insert_at = matches[-1].end()
    for match in matches:
        existing_date = match.group(2)
        if date > existing_date:
            insert_at = match.start()
            break
    return sitemap[:insert_at] + block + sitemap[insert_at:]


def _canonical_markdown(manifest: dict, body: str) -> str:
    post = manifest["post"]
    lines = [
        "---",
        f'title: "{post["title"]}"',
        f'date: "{post["date"]}"',
        f'description: "{post["description"]}"',
        f'category: "{post["category"]}"',
        f'slug: "{post["slug"]}"',
        "---",
        "",
        body.strip(),
        "",
    ]
    return "\n".join(lines)


@contextmanager
def _site_root(root: Path):
    previous = gs.SITE_DIR
    gs.SITE_DIR = root
    try:
        yield
    finally:
        gs.SITE_DIR = previous


def _lock_path(root: Path) -> Path:
    return root / "intake" / "lock" / "publish.lock"


def acquire_lock(root: Path, submission_id: str, force: bool) -> dict:
    path = _lock_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "holder": PUBLISHER,
        "submission_id": submission_id,
        "pid": os.getpid(),
        "acquired_at": _now(),
    }
    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
    try:
        fd = os.open(path, flags, 0o644)
    except FileExistsError:
        existing = _read_lock(path)
        if force and _lock_is_stale(existing):
            path.unlink()
            fd = os.open(path, flags, 0o644)
            payload["recovered_stale_lock"] = True
        else:
            message = "publish lock is held"
            if _lock_is_stale(existing):
                message = "publish lock is stale; Steward may retry with --force-lock"
            raise IntakeFailure("lock_held", message)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
    return payload


def release_lock(root: Path) -> None:
    path = _lock_path(root)
    if path.is_file():
        path.unlink()


def _read_lock(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _lock_is_stale(lock: dict) -> bool:
    acquired = lock.get("acquired_at")
    if not isinstance(acquired, str) or not CREATED_RE.match(acquired):
        return False
    then = datetime.strptime(acquired, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - then).total_seconds()
    return age > LOCK_TTL_SECONDS


def lock_status(root: Path) -> dict:
    path = _lock_path(root)
    if not path.is_file():
        return _result(ok=True, status="unlocked", message="no publish lock is held")
    lock = _read_lock(path)
    stale = _lock_is_stale(lock)
    return _result(
        ok=not stale,
        status="lock_held",
        submission_id=lock.get("submission_id") if isinstance(lock.get("submission_id"), str) else None,
        message="publish lock is stale" if stale else "publish lock is held",
        extra={"stale": stale, "holder": lock.get("holder"), "acquired_at": lock.get("acquired_at")},
    )


def publish_packet(packet: Path, root: Path, *, apply: bool, force_lock: bool) -> dict:
    packet = packet.resolve()
    root = root.resolve()
    checked = validate_packet(packet, root)
    checked["dry_run"] = not apply
    if checked["status"] == "idempotent_replay":
        checked["dry_run"] = not apply
        checked["wrote"] = []
        return checked
    if not checked["ok"]:
        return checked
    manifest = _load_json(packet / "manifest.json")
    if checked["status"] == "accepted":
        return _result(
            ok=False,
            status="not_publishable",
            submission_id=checked["submission_id"],
            dry_run=not apply,
            publishable=False,
            idempotency_key=checked["idempotency_key"],
            message="only a ready post-bundle can be published; specialist packets stay in intake",
            errors=[{"code": "not_publishable", "message": "kind is not a publishable post-bundle"}],
        )
    if manifest.get("example"):
        planned = _planned(packet, manifest) if checked["status"] == "ready" or checked.get("extra") else _planned(packet, manifest)
        return _result(
            ok=not apply,
            status="ready" if not apply else "not_publishable",
            submission_id=manifest["submission_id"],
            dry_run=not apply,
            publishable=False,
            planned_writes=[] if apply else planned,
            idempotency_key=checked["idempotency_key"],
            message="example packet dry-run only" if not apply else "example packets cannot be applied",
            errors=[] if not apply else [{"code": "not_publishable", "message": "example packets cannot be applied"}],
            extra={"example": True},
        )
    planned = _planned(packet, manifest)
    if not apply:
        if _lock_path(root).is_file():
            lock = lock_status(root)
            return _result(
                ok=False,
                status="lock_held",
                submission_id=manifest["submission_id"],
                dry_run=True,
                publishable=True,
                planned_writes=planned,
                idempotency_key=checked["idempotency_key"],
                message=lock["message"],
                errors=[{"code": "lock_held", "message": lock["message"]}],
            )
        lock = lock_status(root)
        return _result(
            ok=True,
            status="dry_run",
            submission_id=manifest["submission_id"],
            dry_run=True,
            publishable=True,
            planned_writes=planned,
            idempotency_key=checked["idempotency_key"],
            message="dry-run passed; no site files were written",
            extra={"lock": lock["status"]},
        )
    return _apply(packet, root, manifest, checked, planned, force_lock)


def _apply(packet, root, manifest, checked, planned, force_lock) -> dict:
    wrote: list[str] = []
    try:
        lock = acquire_lock(root, manifest["submission_id"], force_lock)
    except IntakeFailure as exc:
        return _result(
            ok=False,
            status=exc.code,
            submission_id=manifest["submission_id"],
            publishable=True,
            idempotency_key=checked["idempotency_key"],
            message=exc.message,
            errors=[{"code": exc.code, "message": exc.message}],
        )
    try:
        again = validate_packet(packet, root)
        if not again["ok"] or again["status"] != "ready":
            return _result(
                ok=False,
                status=again["status"],
                submission_id=manifest["submission_id"],
                errors=again["errors"],
                publishable=False,
                idempotency_key=again.get("idempotency_key"),
                message=again["message"],
            )
        before = _existing_posts(root)
        media = _load_json(_safe_child(packet, manifest["artifacts"]["media"]))
        for item in media["files"]:
            src = _safe_child(packet, item["intake_file"])
            dest = root / item["repo_path"]
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.is_file() and dest.read_bytes() != src.read_bytes():
                raise IntakeFailure("conflict", f"{item['repo_path']} changed during publish")
            if not dest.is_file():
                shutil.copyfile(src, dest)
                wrote.append(item["repo_path"])
        draft = (_safe_child(packet, manifest["artifacts"]["draft"])).read_text(encoding="utf-8")
        _meta, body = gs.parse_frontmatter(draft)
        markdown = _canonical_markdown(manifest, body)
        stem = f"{manifest['post']['date']}-{manifest['post']['slug']}"
        md_path = root / "posts" / f"{stem}.md"
        html_path = root / "posts" / f"{stem}.html"
        md_path.parent.mkdir(parents=True, exist_ok=True)
        md_path.write_text(markdown, encoding="utf-8")
        wrote.append(f"posts/{stem}.md")
        with _site_root(root):
            posts = gs.load_posts()
            match = next((p for p in posts if p["slug"] == manifest["post"]["slug"]), None)
            if match is None:
                raise IntakeFailure("publish_failed", "new markdown did not load")
            html = gs.build_post_page(match)
            if "cloudfront.net" in html.lower():
                raise IntakeFailure(
                    "media_path_rejected",
                    "generated HTML still contains a CloudFront URL; publish stopped before replacing the page",
                )
            html_path.write_text(html, encoding="utf-8")
            wrote.append(f"posts/{stem}.html")
            after_posts = gs.load_posts()
            guard_post_index(before, [
                {"slug": p["slug"]} for p in after_posts
            ])
            if manifest["post"]["slug"] not in {p["slug"] for p in after_posts}:
                raise IntakeFailure("index_guard_failed", "new slug missing after load")
            gs.write_posts_json(after_posts)
            wrote.append("posts.json")
            (root / "blog.html").write_text(gs.build_blog_index(after_posts), encoding="utf-8")
            wrote.append("blog.html")
            gs.write_rss(after_posts)
            wrote.append("blog/rss.xml")
        sitemap_path = root / "sitemap.xml"
        if not sitemap_path.is_file():
            raise IntakeFailure("index_guard_failed", "sitemap.xml is missing")
        updated = insert_sitemap_post(
            sitemap_path.read_text(encoding="utf-8"),
            f"{stem}.html",
            manifest["post"]["date"],
        )
        for item in before:
            path = item.get("path", "")
            if isinstance(path, str) and path and path.split("/")[-1] not in updated:
                raise IntakeFailure("index_guard_failed", "sitemap update would drop an existing post")
        sitemap_path.write_text(updated, encoding="utf-8")
        wrote.append("sitemap.xml")
        receipt = {
            "submission_id": manifest["submission_id"],
            "idempotency_key": checked["idempotency_key"],
            "status": "published",
            "publisher": PUBLISHER,
            "published_at": _now(),
            "outputs": wrote,
            "post_count": len(before) + 1,
        }
        receipt_path = _receipt_path(root, manifest["submission_id"])
        receipt_path.parent.mkdir(parents=True, exist_ok=True)
        receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        wrote.append(f"intake/receipts/{manifest['submission_id']}.json")
        return _result(
            ok=True,
            status="published",
            submission_id=manifest["submission_id"],
            dry_run=False,
            publishable=True,
            wrote=wrote,
            planned_writes=planned,
            idempotency_key=checked["idempotency_key"],
            message="Steward published the packet",
            extra={"lock_recovered": bool(lock.get("recovered_stale_lock"))},
        )
    except IntakeFailure as exc:
        return _result(
            ok=False,
            status=exc.code,
            submission_id=manifest["submission_id"],
            errors=[{"code": exc.code, "message": exc.message}],
            idempotency_key=checked["idempotency_key"],
            wrote=wrote,
            message=exc.message,
        )
    except Exception as exc:  # noqa: BLE001 — surface a stable failure state, do not hide the type
        return _result(
            ok=False,
            status="publish_failed",
            submission_id=manifest["submission_id"],
            errors=[{"code": "publish_failed", "message": exc.__class__.__name__}],
            idempotency_key=checked["idempotency_key"],
            wrote=wrote,
            message="publish failed before a receipt was written",
        )
    finally:
        release_lock(root)


def pacific_today(now: datetime | None = None) -> str:
    """Calendar date of the existing morning routine in America/Los_Angeles."""
    current = now or datetime.now(MORNING_TZ)
    if current.tzinfo is None:
        current = current.replace(tzinfo=MORNING_TZ)
    return current.astimezone(MORNING_TZ).strftime("%Y-%m-%d")


def _inbox_packets(root: Path) -> list[Path]:
    inbox = root / "intake" / "inbox"
    if not inbox.is_dir():
        return []
    return sorted(
        path for path in inbox.iterdir()
        if path.is_dir() and (path / "manifest.json").is_file()
    )


def _posts_on_date(root: Path, pacific_date: str) -> list[dict]:
    return [
        post for post in _existing_posts(root)
        if isinstance(post, dict) and post.get("date") == pacific_date
    ]


def _schedule_block(pacific_date: str) -> dict:
    return {
        "routine": MORNING_ROUTINE,
        "when": MORNING_WHEN,
        "timezone": "America/Los_Angeles",
        "pacific_date": pacific_date,
        "competing_schedule": False,
    }


def morning_run(
    root: Path,
    *,
    apply: bool,
    force_lock: bool = False,
    on_date: str | None = None,
) -> dict:
    """One fail-closed pass for the existing 10:00 AM PT routine.

    Aggregates inbox packets, selects at most one ready post-bundle dated the
    Pacific morning, and publishes it only when ``apply`` is set. Specialist
    packets never publish. Two ready bundles publish nothing.
    """
    root = root.resolve()
    if on_date is None:
        try:
            pacific_date = pacific_today()
        except Exception:
            return _result(
                ok=False,
                status="publish_failed",
                message="Pacific morning clock is unavailable; nothing was published",
                errors=[{"code": "publish_failed", "message": "America/Los_Angeles clock failed"}],
            )
    else:
        pacific_date = on_date
    if not isinstance(pacific_date, str) or not DATE_RE.match(pacific_date):
        return _result(
            ok=False,
            status="invalid_manifest",
            message="morning date must be YYYY-MM-DD",
            errors=[{"code": "invalid_manifest", "message": "morning date must be YYYY-MM-DD"}],
        )
    try:
        datetime.strptime(pacific_date, "%Y-%m-%d")
    except ValueError:
        return _result(
            ok=False,
            status="invalid_manifest",
            message="morning date is not a real calendar date",
            errors=[{"code": "invalid_manifest", "message": "morning date is not a real calendar date"}],
        )

    specialists: list[str] = []
    ignored_examples: list[str] = []
    deferred: list[str] = []
    today_bundles: list[tuple[Path, dict, dict]] = []
    for path in _inbox_packets(root):
        try:
            manifest = _load_json(path / "manifest.json")
        except IntakeFailure:
            manifest = {}
        checked = validate_packet(path, root)
        kind = manifest.get("kind")
        submission_id = checked.get("submission_id") or path.name
        if kind != "post-bundle":
            specialists.append(str(submission_id))
            continue
        if manifest.get("example"):
            ignored_examples.append(str(submission_id))
            continue
        post = manifest.get("post") if isinstance(manifest.get("post"), dict) else {}
        post_date = post.get("date")
        if post_date != pacific_date:
            deferred.append(str(submission_id))
            continue
        today_bundles.append((path, manifest, checked))

    aggregation = {
        "specialist_packets": specialists,
        "ignored_examples": ignored_examples,
        "deferred_other_dates": deferred,
        "today_bundles": [item[2].get("submission_id") for item in today_bundles],
        "selected": None,
    }

    def finish(payload: dict) -> dict:
        payload = dict(payload)
        payload["schedule"] = _schedule_block(pacific_date)
        payload["aggregation"] = aggregation
        payload["publisher"] = PUBLISHER
        payload["commit"] = payload.get("status") == "published" and not payload.get("dry_run")
        payload["dry_run"] = not apply if "dry_run" not in payload else payload["dry_run"]
        return payload

    existing = _posts_on_date(root, pacific_date)
    if existing:
        aggregation["selected"] = None
        return finish(_result(
            ok=True,
            status="already_published",
            submission_id=existing[0].get("slug") if isinstance(existing[0].get("slug"), str) else None,
            dry_run=not apply,
            publishable=False,
            message=(
                f"the {pacific_date} morning already has its one post; "
                "no second packet was published"
            ),
            extra={"existing_slugs": [post.get("slug") for post in existing]},
        ))

    if len(today_bundles) > 1:
        return finish(_result(
            ok=False,
            status="multiple_ready",
            dry_run=not apply,
            publishable=False,
            message="more than one post-bundle is dated this morning; published none",
            errors=[{
                "code": "multiple_ready",
                "message": "refusing to let multiple packets publish on the same morning",
            }],
        ))

    if not today_bundles:
        return finish(_result(
            ok=True,
            status="skipped",
            dry_run=not apply,
            publishable=False,
            message=(
                "no single vetted post-bundle for this Pacific morning; "
                "specialist packets were not published"
            ),
        ))

    path, _manifest, checked = today_bundles[0]
    if checked.get("status") != "ready" or not checked.get("ok"):
        failed = dict(checked)
        failed["dry_run"] = not apply
        failed["wrote"] = []
        failed["message"] = checked.get("message") or "morning bundle failed validation; nothing was published"
        return finish(failed)

    aggregation["selected"] = checked.get("submission_id")
    published = publish_packet(path, root, apply=apply, force_lock=force_lock)
    return finish(published)


def validate_inbox(root: Path) -> dict:
    inbox = root / "intake" / "inbox"
    results = []
    if inbox.is_dir():
        for child in sorted(inbox.iterdir()):
            if child.is_dir() and (child / "manifest.json").is_file():
                results.append(validate_packet(child, root))
    ok = all(item["ok"] for item in results)
    return _result(
        ok=ok,
        status="ready" if ok else "invalid_manifest",
        message="no submissions" if not results else f"validated {len(results)} packet(s)",
        extra={"results": results},
    )


def _print(payload: dict) -> int:
    json.dump(payload, sys.stdout, indent=2)
    sys.stdout.write("\n")
    sys.stdout.flush()
    if payload.get("ok"):
        return 0
    return EXIT_CODES.get(payload.get("status", ""), 2)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Board of Project Stewardship agent intake.")
    parser.add_argument("--root", type=Path, default=ROOT, help="Site repository root")
    sub = parser.add_subparsers(dest="cmd", required=True)

    validate = sub.add_parser("validate", help="Validate a packet or every inbox packet")
    validate.add_argument("packet", nargs="?", type=Path)

    publish = sub.add_parser("publish", help="Dry-run (default) or apply a post bundle")
    publish.add_argument("packet", type=Path)
    publish.add_argument("--dry-run", action="store_true", help="Validate only (default)")
    publish.add_argument("--apply", action="store_true", help="Steward writes the site under the publish lock")
    publish.add_argument("--force-lock", action="store_true", help="Replace a stale publish lock")

    sub.add_parser("lock-status", help="Show the local publish lock")

    morning = sub.add_parser(
        "morning",
        help="Fail-closed pass for the existing 10:00 AM PT routine (one post; no second schedule)",
    )
    morning.add_argument("--dry-run", action="store_true", help="Select and validate only (default)")
    morning.add_argument(
        "--apply",
        action="store_true",
        help="Steward publishes the one vetted bundle. The existing routine passes this; CI must not.",
    )
    morning.add_argument("--date", help="Pacific date YYYY-MM-DD. Default is today in America/Los_Angeles.")
    morning.add_argument("--force-lock", action="store_true", help="Replace a stale publish lock")

    args = parser.parse_args(argv)
    root = args.root.resolve()
    if args.cmd == "lock-status":
        return _print(lock_status(root))
    if args.cmd == "morning":
        if args.apply and args.dry_run:
            return _print(_result(
                ok=False,
                status="invalid_manifest",
                message="pass only one of --apply or --dry-run",
                errors=[{"code": "invalid_manifest", "message": "pass only one of --apply or --dry-run"}],
            ))
        return _print(morning_run(
            root,
            apply=bool(args.apply),
            force_lock=bool(args.force_lock),
            on_date=args.date,
        ))
    if args.cmd == "validate":
        if args.packet is None:
            return _print(validate_inbox(root))
        return _print(validate_packet(args.packet, root))
    if args.cmd == "publish":
        if args.apply and args.dry_run:
            return _print(_result(
                ok=False,
                status="invalid_manifest",
                message="pass only one of --apply or --dry-run",
                errors=[{"code": "invalid_manifest", "message": "pass only one of --apply or --dry-run"}],
            ))
        return _print(publish_packet(args.packet, root, apply=bool(args.apply), force_lock=bool(args.force_lock)))
    return _print(_result(ok=False, status="invalid_manifest", message="unknown command"))


if __name__ == "__main__":
    sys.exit(main())
