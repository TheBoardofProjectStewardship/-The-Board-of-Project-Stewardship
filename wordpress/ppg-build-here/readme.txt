=== PPG Build Here ===
Tags: zoning, feasibility, real estate, construction, shortcode
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.1

Address-based lot feasibility study for Pacific Pro Group. Shortcode: [ppg_build_here].

== Description ==

A visitor types a street address. The tool reads public parcel and map records, applies the zoning rules it
has checked, and shows what the lot may take: an addition, an ADU, a garage or shop, a new house, or a remodel.
The study can be printed or saved, and ends with a call to action.

The tool is drawn inside a shadow root, so the theme's styles and the tool's styles cannot reach each other.
It adds one name to window (PPGBuildHere), sets no cookies and stores nothing in the browser.

"Tested up to" is the newest WordPress version whose functions this plugin was written against. The plugin has
not yet been run inside a WordPress install. See README.md, "How this version was tested".

== Installation ==

1. Plugins > Add New > Upload Plugin. Choose the zip, install, activate.
2. Settings > PPG Build Here. Set the brand color, the call-to-action link and the contact line.
3. Press "Test the connection" on that page.
4. Upload the King County data folder to wp-content/uploads/ppg-build-here/kc-resbldg/ (see README.md).
5. Add the shortcode [ppg_build_here] to a page. In Elementor, use the Shortcode widget.

README.md in this folder is the full install guide, written for Stryker Digital: settings, caching plugins,
privacy and security notes, checks to run after install, and troubleshooting.

== Changelog ==

= 1.0.1 =
* When a King County data file is missing, cannot be read or cannot be loaded, the study leaves the finished
  living area out and says why in plain words. Before, the list of sources showed a status code or the
  browser's parser message.
* A data file that takes longer than 20 seconds is dropped, like a map layer. Before, a host that never
  answered could hold the study.
* No change when the data files are in place.

= 1.0.0 =
First version, built from the Build Here source after the review of pull request 208.
