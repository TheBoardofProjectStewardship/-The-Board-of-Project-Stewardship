"""Public Board contact and lead mail stays on one inbox.

editorial@boardofprojectstewardship.com is the only address the Board site
may use for its own contact and lead mail. Two kinds of other addresses are
not Board inboxes and are allowed:

- Pacific Pro Group's own listed details (the PPG record, or an address on
  pacificprogroup.com) when PPG is shown as a listed company.
- Citations that are not the Board's desk: authority-having-jurisdiction
  permit emails, and DK Production's published emergency address on the
  restoration listing.
"""
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BOARD_EMAIL = "editorial@boardofprojectstewardship.com"

# Alternate inboxes that have shown up as the Board's contact. They are never
# a listed-company exception.
FORBIDDEN_BOARD_INBOXES = (
    "pnw@mail.grokbot.com",
    "admin@pacificprogroup.com",
)

# DK Production's emergency address on the restoration directory. It is that
# firm's listing, the same way a PPG address is PPG's listing.
LISTED_FIRM_EMAILS = {
    "dkproconnect@gmail.com",
}

PLACEHOLDER_EMAILS = {
    "client@email.com",
}

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

# The marker has to sit immediately in front of the address. A later PPG
# paragraph or a permit citation must not be treated as the Board footer.
BOARD_SURFACE_RE = re.compile(
    r"(?:"
    r"public contact:\s*(?:<[^>]+>\s*)*"
    r"|editorial_email\s*=\s*"
    r"|var inbox\s*=\s*"
    r"|lead_notify_email\s*=\s*"
    r"|email_from\s*=\s*"
    r"|notify mail goes to\s*(?:<[^>]+>\s*)*"
    r"|opens your mail app to\s*"
    r"|board of project stewardship\s*·\s*"
    r"|\"email\"\s*:\s*"
    r")$",
    re.I,
)

LEAD_FORM_HOSTS = (
    "formspree.io",
    "formsubmit.co",
    "web3forms.com",
    "getform.io",
    "formspark.io",
    "usebasin.com",
    "netlify.com",
    "netlify.app",
    "api.netlify.com",
)

FORM_ACTION_RE = re.compile(r"""<(?:form|button)\b[^>]*\baction=(["'])(.*?)\1""", re.I | re.S)


def _public_html() -> list[Path]:
    skip = {".git", "node_modules", "__pycache__"}
    files = []
    for path in ROOT.rglob("*.html"):
        if any(part in skip for part in path.parts):
            continue
        files.append(path)
    return files


def _templates() -> list[Path]:
    names = (
        ROOT / "generate_site.py",
        ROOT / "tools" / "build_learn.py",
        ROOT / "posts" / "_template.md",
    )
    return [path for path in names if path.is_file()]


def _ppg_listed_emails() -> set[str]:
    """Addresses stored on the Pacific Pro Group listing, not the Board desk."""
    import generate_site as gs

    found: set[str] = set()
    for value in gs.PPG.values():
        if isinstance(value, str):
            found.update(email.lower() for email in EMAIL_RE.findall(value))
    return found


def _host(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower()


def _is_ahj(email: str) -> bool:
    host = _host(email)
    return host.endswith((".gov", ".us")) or host == "cityofmilton.net"


def _is_ppg_listed(email: str, ppg_emails: set[str]) -> bool:
    if email in ppg_emails:
        return True
    # admin@pacificprogroup.com is rejected earlier as a forbidden Board inbox.
    return _host(email) == "pacificprogroup.com"


def _line_number(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def contact_problems(text: str, label: str, ppg_emails: set[str]) -> list[str]:
    """Return human-readable problems for one public file or template."""
    problems: list[str] = []
    lowered = text.lower()
    for forbidden in FORBIDDEN_BOARD_INBOXES:
        if forbidden in lowered:
            problems.append(f"{label}: contains forbidden Board inbox {forbidden}")

    for match in EMAIL_RE.finditer(text):
        email = match.group(0)
        normalized = email.lower()
        prefix = text[max(0, match.start() - 160) : match.start()]
        line = _line_number(text, match.start())
        where = f"{label}:{line}"
        board_surface = BOARD_SURFACE_RE.search(prefix) is not None
        is_mailto = prefix.lower().rstrip().endswith("mailto:")

        if normalized == BOARD_EMAIL:
            continue
        if normalized in FORBIDDEN_BOARD_INBOXES or _host(normalized).endswith(
            "mail.grokbot.com"
        ):
            problems.append(f"{where}: Board contact {email}")
            continue
        if _host(normalized) == "boardofprojectstewardship.com":
            problems.append(f"{where}: Board domain inbox {email}")
            continue
        if board_surface:
            problems.append(f"{where}: Board contact surface uses {email}")
            continue
        if is_mailto:
            if _is_ahj(normalized) or normalized in LISTED_FIRM_EMAILS or _is_ppg_listed(normalized, ppg_emails):
                continue
            problems.append(f"{where}: mailto lead uses {email}")
            continue
        if (
            _is_ahj(normalized)
            or normalized in LISTED_FIRM_EMAILS
            or normalized in PLACEHOLDER_EMAILS
            or _host(normalized) == "example.com"
            or _is_ppg_listed(normalized, ppg_emails)
        ):
            continue
        problems.append(f"{where}: unexpected address {email}")

    for match in FORM_ACTION_RE.finditer(text):
        action = match.group(2).strip().lower()
        if action.startswith(("mailto:", "#", "/", "?", ".")):
            if action.startswith("mailto:"):
                continue
            continue
        for host in LEAD_FORM_HOSTS:
            if host in action:
                line = _line_number(text, match.start())
                problems.append(
                    f"{label}:{line}: lead form posts to {host} ({match.group(2).strip()})"
                )
                break
    return problems


class BoardContactEmailTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ppg_emails = _ppg_listed_emails()

    def test_public_html_and_templates_use_editorial_inbox(self):
        problems: list[str] = []
        files = _public_html() + _templates()
        self.assertGreater(len(files), 10)
        for path in files:
            text = path.read_text(encoding="utf-8")
            label = str(path.relative_to(ROOT))
            problems.extend(contact_problems(text, label, self.ppg_emails))
        self.assertEqual(problems, [], "\n".join(problems))

    def test_home_and_contact_pages_publish_the_editorial_inbox(self):
        for name in ("index.html", "contact.html", "about.html"):
            text = (ROOT / name).read_text(encoding="utf-8")
            self.assertIn(f"mailto:{BOARD_EMAIL}", text, name)
            self.assertIn(BOARD_EMAIL, text.split("<footer", 1)[1], name)

    def test_detector_flags_a_foreign_board_inbox(self):
        samples = {
            "footer": (
                '<p>Public contact: <a href="mailto:pnw@mail.grokbot.com">'
                "pnw@mail.grokbot.com</a></p>"
            ),
            "jsonld": '"email": "admin@pacificprogroup.com"',
            "gmail": (
                '<p>Public contact: <a href="mailto:desk@gmail.com">desk@gmail.com</a></p>'
            ),
            "form": '<form action="https://formspree.io/f/xyzabc">',
        }
        for label, sample in samples.items():
            found = contact_problems(sample, label, set())
            self.assertTrue(found, label)

    def test_detector_allows_ppg_listing_and_permit_desks(self):
        ppg = {"hello@pacificprogroup.com"}
        samples = [
            '<p>Pacific Pro Group · <a href="mailto:hello@pacificprogroup.com">hello@pacificprogroup.com</a></p>',
            '<p>Email <a href="mailto:permittech@kenmorewa.gov">permittech@kenmorewa.gov</a>.</p>',
            '<p>Secondary email <a href="mailto:Dkproconnect@gmail.com">Dkproconnect@gmail.com</a>.</p>',
            f'<p>Public contact: <a href="mailto:{BOARD_EMAIL}">{BOARD_EMAIL}</a></p>',
        ]
        for sample in samples:
            self.assertEqual(contact_problems(sample, "sample", ppg), [], sample)


if __name__ == "__main__":
    unittest.main()
