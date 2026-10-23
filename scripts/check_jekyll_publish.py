#!/usr/bin/env python3
"""Fail when a same-origin file the site fetches would be omitted by Jekyll.

GitHub Pages builds this repo with Jekyll 3.9 (legacy Pages). EntryFilter
excludes a path when it starts with an `exclude` entry, not only when it is
inside that directory. `exclude: pages` therefore drops pages-build-stamp.txt,
and `exclude: data` drops data/house-size/.
"""
from __future__ import annotations

import fnmatch
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {
    ".git",
    "node_modules",
    "worker",
    "tests",
    "vendor",
    "state",
    "intake",
    "__pycache__",
}
STATIC_EXT = {
    ".json",
    ".js",
    ".css",
    ".txt",
    ".html",
    ".svg",
    ".xml",
    ".webp",
    ".png",
    ".jpg",
    ".jpeg",
    ".ico",
    ".woff2",
}
FETCH_LIT = re.compile(r"""fetch\(\s*(['"`])([^'"`]+)\1""")
FETCH_IDENT = re.compile(r"""fetch\(\s*([A-Za-z_$][\w$]*)""")


def load_jekyll_lists(text: str) -> tuple[list[str], list[str]]:
    excludes: list[str] = []
    includes: list[str] = []
    mode: str | None = None
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        stripped = line.strip()
        if stripped.startswith("exclude:"):
            mode = "exclude"
            continue
        if stripped.startswith("include:"):
            mode = "include"
            continue
        if stripped.endswith(":") and not stripped.startswith("-"):
            mode = None
            continue
        if mode and stripped.startswith("- "):
            item = stripped[2:].strip().strip("'\"")
            (excludes if mode == "exclude" else includes).append(item)
    return excludes, includes


def _glob_hit(rel: str, patterns: list[str]) -> bool:
    for exp in patterns:
        if any(ch in exp for ch in "*?[]"):
            if fnmatch.fnmatch(rel, exp):
                return True
            continue
        prefix = exp.strip("/")
        if rel == prefix or rel.startswith(prefix):
            return True
    return False


def published(rel: str, excludes: list[str], includes: list[str]) -> bool:
    """True when Jekyll 3.9 would copy this source path into the site."""
    rel = rel.strip("/")
    if not rel or rel == ".":
        return True
    parts = rel.split("/")
    for i, name in enumerate(parts):
        here = "/".join(parts[: i + 1])
        if _glob_hit(here, includes) or _glob_hit(name, includes):
            continue
        if name[:1] in "._#~":
            return False
        if _glob_hit(here, excludes):
            return False
    return True


def runtime_paths() -> list[tuple[str, str]]:
    """(source file, repo-relative path) for same-origin fetch targets."""
    found: list[tuple[str, str]] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in filenames:
            if not name.endswith((".js", ".html", ".mjs")):
                continue
            path = Path(dirpath) / name
            rel_file = path.relative_to(ROOT).as_posix()
            text = path.read_text(encoding="utf-8", errors="replace")
            if "fetch(" not in text:
                continue
            raws = [m.group(2) for m in FETCH_LIT.finditer(text)]
            for ident in FETCH_IDENT.findall(text):
                assigned = re.search(
                    rf"{re.escape(ident)}\s*=\s*(?:{re.escape(ident)}\s*\|\|\s*)?(['\"`])(\.?\.?/[^'\"`]+)\1",
                    text,
                )
                if assigned:
                    raws.append(assigned.group(2))
            for raw in raws:
                resolved = resolve_fetch(rel_file, raw)
                if resolved:
                    found.append((rel_file, resolved))
    return found


def resolve_fetch(source_file: str, raw: str) -> str | None:
    target = raw.split("?", 1)[0].split("#", 1)[0].strip()
    if not target or target.startswith(("http://", "https://", "//", "data:")):
        return None
    if target.startswith("/"):
        rel = target.lstrip("/")
    else:
        parent = Path(source_file).parent.as_posix()
        base = "" if parent == "." else parent
        rel = os.path.normpath(os.path.join(base, target)).replace("\\", "/")
        if rel.startswith("../") or rel == "..":
            return None
    return rel.strip("/") or None


def check(root: Path | None = None) -> list[str]:
    root = root or ROOT
    excludes, includes = load_jekyll_lists((root / "_config.yml").read_text(encoding="utf-8"))
    problems: list[str] = []
    seen: set[str] = set()
    for source, rel in runtime_paths() if root == ROOT else []:
        if rel in seen:
            continue
        seen.add(rel)
        dest = root / rel
        if dest.is_dir():
            if not published(rel, excludes, includes):
                problems.append(f"{source} fetches /{rel}/ but Jekyll excludes that directory")
                continue
            published_file = next(
                (
                    p.relative_to(root).as_posix()
                    for p in dest.rglob("*")
                    if p.is_file() and published(p.relative_to(root).as_posix(), excludes, includes)
                ),
                None,
            )
            if published_file is None:
                problems.append(f"{source} fetches /{rel}/ but no file inside it is published")
            continue
        if dest.is_file():
            if not published(rel, excludes, includes):
                problems.append(f"{source} fetches /{rel} but Jekyll excludes it")
            continue
        ext = Path(rel).suffix.lower()
        if ext in STATIC_EXT:
            problems.append(f"{source} fetches /{rel} but that file is not in the repo")
    stamp = "pages-build-stamp.txt"
    if not (root / stamp).is_file() or not published(stamp, excludes, includes):
        problems.append(
            "pages-build-stamp.txt is missing from the Jekyll output "
            "(exclude: pages prefix-matches the filename unless it is included)"
        )
    return problems


def main() -> None:
    problems = check()
    if problems:
        print("FAIL: Jekyll would not publish a runtime file:")
        for item in problems:
            print(f"  - {item}")
        sys.exit(1)
    print("OK: runtime fetches and pages-build-stamp.txt are published by Jekyll")


if __name__ == "__main__":
    main()
