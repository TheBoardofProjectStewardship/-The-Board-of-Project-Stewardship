# PPG Build Here: install guide

A visitor types a street address. The tool reads public parcel and map records, applies the zoning rules it has checked, and shows what the lot may take: an addition, an ADU, a garage or shop, a new house, or a remodel. It ends with a call to action for Pacific Pro Group. The study can be printed or saved.

This guide is for Stryker Digital, the SEO agency installing it on the Pacific Pro Group WordPress site (Hello Elementor with Elementor Pro). The install takes six steps. The rest is reference: settings, caching plugins, SEO, privacy and security notes, checks to run after install, and troubleshooting.

## What you need

| Item | Requirement |
| --- | --- |
| WordPress | 5.8 or newer |
| PHP | 7.4 or newer |
| The REST API | Open to visitors for one route, `/wp-json/ppg-build-here/v1/geocode`. If a security plugin closes the REST API, the tool still works (see Troubleshooting). |
| Outgoing requests | The server must be able to reach `geocoding.geo.census.gov` over HTTPS. |
| Data files | Optional. The King County living-area index, about one file per two-digit parcel prefix. See step 4. |

## Install

1. In WordPress, go to **Plugins > Add New > Upload Plugin**. Choose `ppg-build-here-1.0.1.zip`. Press **Install Now**, then **Activate**.
2. Go to **Settings > PPG Build Here**. Set the brand color, the call-to-action link, and the contact line. Save.
3. Press **Test the connection** at the bottom of that page. It should say the server reached the US Census geocoder.
4. Upload the data files (next section). The settings page then shows a check mark with the parcel count and the date the files were built.
5. Edit the page that will hold the tool. In Elementor, drag in a **Shortcode** widget and type `[ppg_build_here]`. Publish.
6. Run the checks under "Check it after install".

## Data files

The tool fills in finished living area, year built and stories for King County addresses from an index of the King County Assessor's residential building file. The index is a folder named `kc-resbldg`: about 90 small files, about 20 MB in all. It is not inside the plugin zip because it is rebuilt from county data and is replaced on its own schedule.

**Where to get it.** Either copy the folder `assets/data/kc-resbldg/` from the Board of Project Stewardship site repository, or build it fresh from the source tree:

```
python3 scripts/build_kc_resbldg_index.py --out kc-resbldg
```

**Where to put it.** Upload the whole folder by SFTP or the host's file manager to:

```
wp-content/uploads/ppg-build-here/kc-resbldg/
```

The plugin creates `wp-content/uploads/ppg-build-here/kc-resbldg/` when it is activated. The folder is in uploads so that a plugin update does not delete it. When it is in place, this address opens in a browser:

```
https://YOUR-SITE/wp-content/uploads/ppg-build-here/kc-resbldg/_meta.json
```

**Without it.** The tool still runs. A King County study then leaves the finished living area out, and the visitor is asked to type it. The last page of the study, Data sources, says that the data file was not found. Nothing is guessed and no error is shown. The browser's console lists one "404" line for the missing file on each lookup. That line is the browser reporting the request. It is not an error in the script.

**Keeping it fresh.** Replace the folder every one to three months. Each study prints the date of the data: the date on the county file, or the download date for an index built with the older script. When that date is more than 120 days old, the study says so.

**Hosting it elsewhere.** Set **Data address** in the settings to the folder that contains `kc-resbldg/`, with `https://`. That host must send an `Access-Control-Allow-Origin` header. Check it with:

```
curl -sI https://HOST/PATH/kc-resbldg/_meta.json | grep -i access-control-allow-origin
```

## The shortcode

```
[ppg_build_here]
```

Optional attributes override the saved settings for one page.

| Attribute | Example | What it does |
| --- | --- | --- |
| `title` | `title="What can I build on my lot?"` | Prints an `<h2>` above the tool as ordinary page content. |
| `intro` | `intro="Type an address to see what the zoning allows."` | Prints a paragraph under that heading. |
| `accent` | `accent="#0f4c81"` | Brand color, six-digit hex. |
| `theme` | `theme="dark"` | `light` or `dark` cards. Match the page background. |
| `max_width` | `max_width="1000"` | Widest the tool may grow, in pixels. |
| `cta_url` | `cta_url="https://example.com/contact/"` | Link for the first call-to-action button. |
| `data_url` | `data_url="https://cdn.example.com/bh/"` | Data address for this page. |
| `brand` | `brand="Pacific Pro Group"` | Name printed on the study. |

Use one tool per page. A second shortcode on the same page prints nothing.

## Settings

**Brand.** The name is printed at the foot of every study page and at the top of the saved file. The brand color drives buttons, links and focus rings in the tool around the study. The tool picks white or dark button text for contrast, and falls back to body text color for links if the brand color is too pale to read. The study pages keep their own paper-and-green look on every site, so a saved or printed study always looks the same.

**Call to action.** Shown on the last page of the study. The button appears only when both its label and its link are set. On paper, the link is printed as text.

**Email form.** Leave the address empty and no form is shown. With an address set, a short form under the study opens the visitor's own email app with the message filled in. The site sends nothing and stores nothing.

**Outside services.** Each box turns one service on or off. When a service is off, what it feeds is marked unavailable in the study. Nothing is guessed in its place.

| Service | Default | Used for |
| --- | --- | --- |
| Address lookup through this site | On | The server asks the US Census geocoder. Off: the visitor's browser loads the Census answer as a script. |
| Esri World Geocoder | Off | A second try when the Census has no match. Read Esri's terms of use for your site first. |
| Esri World Imagery | On | The aerial photo outside King and Snohomish counties, and when a county photo fails. |
| Google satellite map | On | A map of the lot. It loads only when the visitor presses the button. |
| OpenStreetMap | On | Driveways, and building outlines where no county layer exists. Public volunteer-run servers. |
| Microsoft building footprints | On | Building outlines where no county or city outline exists. |
| Search for parcel layers nationwide | Off | Leave off for a King and Snohomish County audience. |

**Custom styles.** The tool is drawn inside a shadow root. Theme CSS, Elementor's custom CSS and the Customizer do not reach it, and its styles do not leak out. To restyle it, type rules in this box and start each selector with `.ppgbh`.

## Caching and speed plugins

| Feature | What to do |
| --- | --- |
| Page cache, CDN | Safe. The page carries no nonce and nothing per visitor. |
| Delay JavaScript until interaction (WP Rocket, Perfmatters, FlyingPress) | Exclude `ppg-build-here.js`. Otherwise the tool does not appear until the visitor moves the mouse or scrolls. |
| Defer JavaScript | Safe. The script has no dependencies and waits for the page itself. It is already loaded with `defer`. |
| Minify, combine JavaScript | Not tested. The script is plain code with no dependencies, so it should survive. If the tool stops appearing after you turn one on, exclude `ppg-build-here.js`. |
| Remove unused CSS, critical CSS | Safe. The tool's styles are inside its script, not in a stylesheet. |
| HTML minify | Safe. |
| REST API cache | Do not cache `/wp-json/ppg-build-here/`. It is a POST route and answers with `no-store`. |
| Elementor Element Cache (Elementor > Settings > Performance) | Leave the Shortcode widget's own cache option (Advanced tab) at its default, Inactive. The plugin also loads its script on any page whose content holds the shortcode, so a cached copy of the widget still works there. A cached copy inside a template or popup does not: keep those uncached. |

The script is about 340 KB, about 100 KB when the server sends it gzipped. It is loaded with `defer` in the footer, only on pages that contain the shortcode.

The shortcode reserves the tool's starting height for the width it is given: about 440 px in a wide column, about 650 to 700 px on a phone. The page below the tool therefore does not move when the script runs, which keeps the tool out of the page's layout-shift score. The reserve is up to about 75 px taller than the tool, so there is a little spare room under the first card until a study is drawn. It was measured with the default settings. A much wider font, or custom styles that add height, can leave it short.

## SEO notes

- The tool's interface and the study are built in the browser, inside a shadow root. Search engines should not be expected to index them. Put the page's heading, introduction and any FAQ on the page as normal Elementor content, or use the `title` and `intro` attributes, which print normal HTML.
- A study depends on the address typed, so there is one page to rank, not one per address.
- An address can be passed in the page link as `?bh_address=...`. The tool reads it, runs the lookup, and takes it out of the address bar at once, so it is not kept in a copied link or a bookmark. An analytics tag that fires before the tool's script can still record the page's first address once. Do not publish links or run ads with a street address in them.
- The tool sets no cookies and adds no tracking.

## Privacy

Use this as the basis for the privacy policy entry. The notice under the address box ("Where the address goes") is written from the settings, so it always matches what is switched on.

- The address the visitor types is sent to this site's server, which passes it to the US Census Bureau geocoder. The plugin does not store it, write it to a log or cache the answer.
- The matched address and the location of the lot then go from the visitor's browser to county, city and state map servers. The county parcel lookup is a search by street address. The location also goes to the USGS elevation service and to the outside services that are switched on.
- To limit abuse, the site keeps a one-minute counter per network (IP) address. The network address is kept only as a salted hash, for one minute. The street address is not kept at all.
- Nothing is kept in the browser. The study lives in the page and is gone when the page is closed.
- The study never shows owner names. Parcel records that come back with owner fields are read for the parcel number, finished area and year built only, and the rest is discarded.

## Security notes

Where each control is, for a code review.

| Concern | What the plugin does |
| --- | --- |
| Output escaping | Every value is escaped where it is printed, with `esc_html()`, `esc_attr()`, `esc_url()` or `esc_textarea()`. The settings reach the script as JSON in one HTML attribute, written so that it holds no character HTML reads. The script puts them on the page as text, never as markup. |
| Input cleaning | Settings are cleaned when they are saved (`includes/class-ppgbh-options.php`): text fields lose markup, links must be `http` or `https`, the color must be a six-digit hex, and unknown keys are dropped. Shortcode attributes go through the same checks. |
| Nonces | The settings form carries the WordPress settings nonce (`settings_fields()`), and WordPress checks it before it saves. The **Test the connection** link carries a nonce of its own, checked with `check_admin_referer()`. |
| Capabilities | The settings page and the connection test need `manage_options`. |
| The public lookup route | `/wp-json/ppg-build-here/v1/geocode` has no nonce, on purpose. Visitors are not signed in, so a nonce would protect nothing, and a nonce printed into a cached page expires and would break the tool. The route is protected by what it accepts: a browser on another site is refused, text that is not a street address is refused, one network address gets at most 30 lookups a minute, and the only place it calls is the US Census geocoder. It changes nothing on the site and stores nothing. |
| Direct file access | Every PHP file exits when it is opened outside WordPress. |
| Removal | Deleting the plugin deletes its settings (`uninstall.php`). The data files stay. |

## Check it after install

1. Open the page. The tool shows "1. Find the lot" in the site's font, with buttons in the brand color.
2. Type a King County street address with city and ZIP. Within about 15 seconds the study appears, starting with an aerial photo and five option cards.
3. The foot of each study page says PACIFIC PRO GROUP.
4. "Existing finished area" names the King County Assessor and a file date. If it says "Not entered", the last page of the study (Data sources) says why. "The data file for this parcel was not found" means the data files are not in place.
5. Press **Print**. The print preview shows only the study, about a dozen pages, with no site header or footer.
6. Press **Download study**. An HTML file is saved. Open it. It shows the brand, the address, the date, sources and limitations.
7. Narrow the browser to phone width, or open the page on a phone. Nothing scrolls sideways. Tables turn into labeled rows.
8. Tab through the page with the keyboard. Every control shows a focus ring.
9. Type a nonsense address. The tool says it could not match the address.
10. Open the browser console. There are no errors from `ppg-build-here.js`.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The page shows "The lot feasibility tool is loading" and nothing else | The script did not run or was not loaded. View the page source and search for `ppg-build-here.js`. If it is there, check the console and exclude it from any "delay JavaScript" feature. If it is missing, a cache is serving a saved copy of the shortcode: see Elementor Element Cache above. |
| The tool appears only after the mouse moves | A "delay JavaScript" feature. Exclude the script. |
| "The address lookup did not finish" | The server could not reach the Census, and so could not the browser. Press **Test the connection** in the settings. Ask the host to allow outgoing HTTPS to `geocoding.geo.census.gov`. |
| The lookup works but the Network tab shows a 401 or 403 on `/wp-json/ppg-build-here/v1/geocode` | A security plugin closes the REST API to visitors. The tool then asks the Census from the browser instead. To use the relay, allow that one route. |
| "Too many lookups from this connection" | More than 30 lookups in a minute from one network address. If ordinary visitors see it, the host is behind a proxy or CDN that passes its own address as the visitor's, so all visitors share one count. Ask the host to restore visitor addresses, or raise the limit: `add_filter( 'ppg_build_here_rate_limit', function () { return 300; } );` A value of 0 turns the limit off. |
| In the Elementor editor the widget shows only "The lot feasibility tool is loading" | The editor added the shortcode after the page had loaded, so the script is not on the page yet. Save, then reload the editor or view the page. |
| "Existing finished area" says "Not entered", and Data sources says the data file "was not found" | The `kc-resbldg` folder is not in place, or the Data address setting points at the wrong folder. Open the `_meta.json` address from the Data files section. Until it is fixed, the study leaves the living area out and the visitor can type it. |
| Data sources says the data file "could not be read" | The address answers with a web page in place of the data file: a login page, a redirect, or a "not found" page sent with status 200. Open the `_meta.json` address in a private browser window. It must show a few lines of data, not a page. A file cut off during upload gives the same message: upload the folder again. |
| Data sources says the data file "could not be loaded" | The request failed. With a Data address on another host, that host does not send `Access-Control-Allow-Origin` (see Data files). Otherwise the host answered with an error, shown in parentheses, or the file took longer than 20 seconds. |
| Data sources says "PIN ... is not in the residential building extract" | The data files are in place. The county file has no residential building for that parcel: the lot is vacant or commercial, or the house is newer than the file. |
| The tool looks unstyled or the wrong color | It cannot be reached by theme CSS. Use the brand color setting or the Custom styles box. |
| The tool is as narrow as a phone on a wide screen | Its widget is only as wide as its content: it sits in a row-direction container, or in a column with centered items. In Elementor, set the Shortcode widget's Width to Full Width (100%), or move it to a container of its own. |
| Two shortcodes on one page, and only one tool | By design. One tool per page. The second shortcode prints nothing. |
| A strict Content-Security-Policy blocks it | Allow the site's own scripts, `style-src 'unsafe-inline'` (the tool's styles are injected by its script), and `connect-src` and `img-src` for the map servers. With the relay on, no script from another origin is loaded. |

## What is not in this version

- **The 3D massing sketch.** It needs the three.js library from a CDN, so it is not self-contained. The study leaves out the link to it. It can be added later as a second shortcode.
- **Zoning rules outside the coded places.** Zoning math is coded for Seattle Neighborhood Residential, Edmonds, Kenmore, unincorporated King and Snohomish counties, and listed zones in other King and Snohomish County cities. Elsewhere the study shows the lot facts and says to verify the zoning with the jurisdiction.
- **Translations.** The interface is in English.

## How this version was tested

- The script was run in headless Chrome on a test page whose theme uses a 10 px root font, `!important` rules on every form element, and rules that reuse the tool's own class names and ids. No theme rule reached the tool, and the tool changed no theme element. It adds one name to `window`: `PPGBuildHere`.
- Lookups, print, download, the email form and phone layouts were run against recorded stand-ins for the public map services, not the live services.
- The page below the tool was measured with the script off and on, from a 320 px phone to a desktop, in a narrow column and with the email form. It did not move. In a layout that is only as wide as its content, the tool kept a phone's width.
- A data folder that was never uploaded, a web page answered in place of a data file, and a data address whose request fails were each run in the browser with the plugin's script. Each time the study appeared whole, with the living area left out, a plain note, one request for the file, and no script error.
- A data host that does not send `Access-Control-Allow-Origin` was run against a real second server, with the same reader on the source page. The browser kept the answer from the page, and the study left the living area out. With the header sent, the figure was read.
- The PHP was checked with `php -l` on PHP 8.3 and run against stand-ins for the WordPress functions (`wordpress/tests/php-smoke.php` in the source tree): 87 checks on what is cleaned on the way in, what is escaped on the way out, what the nonces and capability checks let through, and what the address route answers.
- It has **not** been run inside a real WordPress install, with Elementor, or in Firefox or Safari. The checks in "Check it after install" are the first real-site test. Do them on staging first.

## Version history

- **1.0.1** (2026-11-13). When a King County data file is missing, cannot be read or cannot be loaded, the study leaves the finished living area out and says why in plain words. Before, the list of sources showed a status code or the browser's parser message, and a data host that never answered could hold the study. Nothing changes when the data files are in place. The settings and the shortcode are the same.
- **1.0.0.** First version.

## Updating and removing

- **Update:** upload the new zip over the old one. Settings and data files stay.
- **Remove:** deactivate and delete the plugin. Its settings are deleted. The data files in `wp-content/uploads/ppg-build-here/` are left for you to delete.

## Changing the tool

`assets/js/ppg-build-here.js` is built from the Build Here source files and should not be edited by hand. To change the tool's logic or wording, change the source and rebuild:

```
python3 wordpress/build.py --zip dist
```

For developers, the script exposes `window.PPGBuildHere.mount(element, settings)` and `window.PPGBuildHere.scan()`, and the PHP has one filter, `ppg_build_here_config`, that receives the settings array before it is printed.
