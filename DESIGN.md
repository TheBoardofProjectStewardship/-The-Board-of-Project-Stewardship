# Design system — Direction A, editorial ledger

The public site is a newspaper-style standards desk: cream paper, dark ink, one deep green, and the scroll-built house as the only large motion.

Tokens live in `assets/css/editorial.css` and are appended to `assets/css/site.css`. `tailwind.config.js` records the same colors and the two radii. Shared pages pick this up from `site.css` without a full regenerate.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f6f1e6` | Page background |
| `--paper-2` | `#efe8d8` | One quiet band (the directory #1 section) |
| `--ink` | `#1a1712` | Text and primary buttons |
| `--muted` | `#4f483d` | Secondary text |
| `--line` | `#cfc5b2` | Hairline rules |
| `--line-2` | `#8a806e` | Stronger hairlines and input borders |
| `--accent` | `#14532d` | The only accent: links, rank numerals, eyebrows |
| `--focus` | `#14532d` | Focus ring |
| `--r1` | `4px` | Controls, inputs, small media |
| `--r2` | `10px` | Larger media frames |

Spacing uses a 4/8 scale: 4, 8, 12, 16, 24, 32, 48, 64, 96. Section padding is 96px on wide screens and 48px below 960px. Body copy stays near a 68ch measure.

Type: Source Serif 4 for headlines, ranks, and the masthead (self-hosted latin subset, weights 400 and 600). Inter for body, navigation, and buttons (already self-hosted). Body is 17px / 1.65. Headlines use weight 400. At most those weights plus Inter 500/600 for UI.

## Do

- Separate sections with a double rule (`3px double` ink).
- Use a 1px hairline instead of a shadow.
- Keep headings in sentence case. Small eyebrows (about 12.5px, 0.1em tracking) may be uppercase.
- Give buttons, nav links, and the menu control a 44px minimum target.
- Show a 2px accent focus ring on `:focus-visible`.
- Keep the scroll house as the one large motion. Honor `prefers-reduced-motion` with the still drawing.
- Restyle locked ranking, independence, iframe, and footer lines from CSS outside the hashed markup.

## Don't

- Don't add a second accent, a glow, or a gradient orb.
- Don't set headlines in heavy all-caps.
- Don't put the standalone word AI in public page copy. `scripts/check_public_ai.py` fails CI when it appears in visible text, alts, titles, or descriptions.
- Don't invent rankings, reviews, prices, or licenses.
- Don't edit a locked block in `locked-content.sha256`. If one must move, stop.
- Don't load fonts from a third-party host. Subsets are in `assets/fonts/`.

## Rebuild CSS

GitHub Pages serves `assets/css/site.css`. After a Tailwind rebuild, append the chrome and editorial files again:

```
npx tailwindcss -c tailwind.config.js -i assets/css/tw-input.css -o assets/css/site.css
cat assets/css/chrome.css assets/css/editorial.css >> assets/css/site.css
```
