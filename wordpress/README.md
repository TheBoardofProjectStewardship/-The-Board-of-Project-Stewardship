# WordPress embed

This folder turns the Build Here tool into a WordPress plugin for Pacific Pro Group.

| Path | What it is |
| --- | --- |
| `ppg-build-here/` | The plugin. Zip this folder to install it. `ppg-build-here/README.md` is the install guide for the agency, Stryker Digital. |
| `ppg-build-here/assets/js/ppg-build-here.js` | The whole tool as one script. **Built, not written.** Do not edit it. |
| `build.py` | Builds that script from `assets/js/build-here*.js`, `assets/css/build-here.css` and `src/`. |
| `src/widget.html` | The tool's markup as the plugin mounts it. Ids match what `build-here.js` looks up. |
| `src/widget.css` | Styles that exist only in the embed: a base inside the shadow root, and the brand-colored cards and buttons. |
| `src/loader.js` | Mounts the tool in a shadow root, works out colors, and passes settings to the modules. |
| `tests/theme-page.html` | A page with a theme written to break an embedded widget. Used by the browser test. |
| `tests/php-smoke.php`, `tests/wp-stubs.php` | Runs the plugin's PHP against stand-ins for WordPress. |

## Build

```
python3 wordpress/build.py              # rebuild the script
python3 wordpress/build.py --zip dist   # and write dist/ppg-build-here-<version>.zip
```

The version comes from the `Version:` header in `ppg-build-here/ppg-build-here.php`. Change it there and in `PPGBH_VERSION` on the line below it.

## Test

```
php wordpress/tests/php-smoke.php                          # PHP: cleaning, escaping, the address route
python3 tests/e2e/scn_wp.py . /tmp/wp-out                   # browser: the script on the hostile theme page
```

The browser test needs Python with Playwright and a Chrome or Chromium it can start. It answers every outside service itself, so it runs offline.

## One source of truth

The plugin has no copy of the tool's logic. A fix made in `assets/js/` reaches the plugin by running `build.py` again. The build makes four mechanical changes, listed at the top of `build.py`: module globals become properties of a private object, `rem` lengths become multiples of a variable the loader sets, width media queries become container queries, and the homepage include's rules are dropped.

## If this repository is published with GitHub Pages

Add `wordpress/` to the `exclude:` list in `_config.yml`, next to `data/`. Otherwise the plugin's files are published as static files on the site. They hold no secrets, but they do not belong there.
