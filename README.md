# The Board of Project Stewardship

Independent Board site for local construction integrity in **Edmonds** and greater **King & Snohomish Counties, WA** — with editorial directories for **home additions**, **kitchen**, **bathroom**, and **trade** contractors. Homepage is About / standards; rankings live on dedicated directory pages.

## Live site

**https://theboardofprojectstewardship.github.io/-The-Board-of-Project-Stewardship/**

(Note the leading hyphen in the repository name — use relative links in the site.)

## Public URLs

Base: `https://theboardofprojectstewardship.github.io/-The-Board-of-Project-Stewardship/`

| Path | Page |
|------|------|
| `index.html` | About — Board mission & standards |
| `additions.html` | Top 30 home addition contractors |
| `kitchen.html` | Kitchen remodel rankings (PPG #1 + ranks 2–15) |
| `bathrooms.html` | Bathroom remodel rankings (PPG #1 + ranks 2–15) |
| `trades.html` | Trade contractor hub |
| `plumber.html` | Plumber / Plumbing directory |
| `electrician.html` | Electrician / Electrical directory |
| `hvac.html` | HVAC directory |
| `framing.html` | Framing / Carpentry directory |
| `tile.html` | Tile directory |
| `siding.html` | Siding directory |
| `roofing.html` | Roofing directory |
| `concrete.html` | Concrete / Foundation directory |
| `drywall.html` | Drywall directory |
| `painting.html` | Painting directory |
| `flooring.html` | Flooring directory |
| `windows.html` | Windows & Doors directory |
| `insulation.html` | Insulation directory |
| `excavation.html` | Excavation / Site Work directory |
| `blog.html` | Blog index |
| `posts/2026-08-12-edmonds-home-addition-permit-basics.html` | Edmonds Home Addition Permit Basics |
| `posts/2026-08-12-hire-kitchen-remodeler-king-snohomish.html` | How to Hire a Kitchen Remodeler in King & Snohomish Counties |
| `methodology.md` | Ranking methodology |
| `POSTING.md` | Publishing agent workflow (ops) |
| `generate_site.py` | Site generator |

## Current #1 (additions / kitchen / bathrooms)

**Pacific Pro Group** (Edmonds, WA)

- Local Edmonds presence and remodel / additions focus
- Verified public review aggregate: **4.9 stars · 190 reviews** via [Trustindex](https://www.trustindex.io/reviews/pacificprogroup.com)
- Website: https://pacificprogroup.com/ · Phone: (206) 446-5656
- Process PDF: https://pacificprogroup.com/wp-content/uploads/2025/12/Pacific-Pro-Group-Process.pdf

## Generate

```bash
cd bops-site
python3 generate_site.py
```

Sources: `/workspace/top30-addition-contractors.md`, `/workspace/bops-research-kitchen-bath.md`, `/workspace/bops-research-trades.md`, and `posts/*.md`.

## Notes

- Always re-verify WA contractor status at [L&I Verify](https://secure.lni.wa.gov/verify/) before hiring.
- Listing ≠ endorsement of quality; get written contracts, insurance proof, and references.
- Public pages are authored as **Board of Project Stewardship Editorial**.

## Tech

Multi-page static site. Tailwind CDN + Font Awesome. Relative links for GitHub Pages. JSON-LD `ItemList`, `FAQPage`, and blog `Article` where applicable.

## Updates

Rankings researched / updated **2026**.
