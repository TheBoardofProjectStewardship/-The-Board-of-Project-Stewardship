<?php
/**
 * Runs the plugin's PHP from the command line against stand-ins for WordPress (wp-stubs.php).
 *
 *     php wordpress/tests/php-smoke.php
 *
 * It checks what the plugin cleans on the way in, what it escapes on the way out, and what the
 * address relay answers. It prints one line per check and exits 1 if any check fails.
 */

require __DIR__ . '/wp-stubs.php';

$T = &$GLOBALS['ppgbh_test'];
$T['is_admin'] = true;
require dirname( __DIR__ ) . '/ppg-build-here/ppg-build-here.php';

$failed = 0;
function check( $name, $ok, $detail = '' ) {
	global $failed;
	if ( ! $ok ) {
		$failed++;
	}
	echo ( $ok ? 'ok    ' : 'FAIL  ' ) . $name . ( ! $ok && '' !== $detail ? '  [' . ( is_string( $detail ) ? $detail : json_encode( $detail ) ) . ']' : '' ) . "\n";
}

$HOSTILE = '"><img src=x onerror=alert(1)>\'</script><script>alert(2)</script>';
// Text an admin could type that already looks like HTML entities.
$ENTITIES = 'Tom &amp; Jerry say &quot;hi&quot; &#039;there&#039; &lt;b&gt; & more';

/* ---------- A. what is saved ---------- */
$clean = PPGBH_Options::sanitize(
	array(
		'brand'         => 'Pacific <script>alert(1)</script>Pro "Group"',
		'accent'        => 'red',
		'theme'         => 'purple',
		'font'          => 'comic',
		'max_width'     => '99999',
		'cta_url'       => 'javascript:alert(1)',
		'cta2_url'      => 'https://x.example/contact?a=1&b=2',
		'data_url'      => 'ftp://x.example/data',
		'permits_url'   => ' https://x.example/permits ',
		'lead_email'    => 'not-an-email',
		'esri_geocoder' => 'on',
		'custom_css'    => '</style><script>alert(1)</script>.ppgbh .bh-btn{border-radius:999px}',
		'evil_extra'    => 'x',
	)
);
check( 'saved brand has no markup', false === strpos( $clean['brand'], '<' ) && false !== strpos( $clean['brand'], 'Pacific' ), $clean['brand'] );
check( 'a color name is not a brand color', '#14532d' === $clean['accent'], $clean['accent'] );
check( 'an unknown theme falls back to light', 'light' === $clean['theme'] && 'site' === $clean['font'] );
check( 'an absurd width is dropped', '' === $clean['max_width'] );
check( 'a javascript: link is dropped', '' === $clean['cta_url'], $clean['cta_url'] );
check( 'an https link is kept', 'https://x.example/contact?a=1&b=2' === $clean['cta2_url'], $clean['cta2_url'] );
check( 'an ftp data address is dropped', '' === $clean['data_url'], $clean['data_url'] );
check( 'a padded link is trimmed', 'https://x.example/permits' === $clean['permits_url'], $clean['permits_url'] );
check( 'a bad email is dropped', '' === $clean['lead_email'] );
check( 'a ticked box is saved as 1 and a missing one as empty', '1' === $clean['esri_geocoder'] && '' === $clean['geocode_relay'] && '' === $clean['google_map'] );
check( 'custom CSS keeps the rule and loses the tags', false === strpos( $clean['custom_css'], '<' ) && false !== strpos( $clean['custom_css'], '.ppgbh .bh-btn{border-radius:999px}' ), $clean['custom_css'] );
check( 'an unknown key is not saved', ! array_key_exists( 'evil_extra', $clean ) );
$good = PPGBH_Options::sanitize( array( 'accent' => '#0F4C81', 'max_width' => '1100', 'lead_email' => 'office@x.example', 'theme' => 'dark', 'accent_short' => '#abc' ) );
check( 'a six-digit hex color, a sane width and a real email are kept', '#0F4C81' === $good['accent'] && '1100' === $good['max_width'] && 'office@x.example' === $good['lead_email'] && 'dark' === $good['theme'] );
check( 'a three-digit hex color is not accepted (the script needs six)', '#14532d' === PPGBH_Options::sanitize( array( 'accent' => '#abc' ) )['accent'] );
check( 'an empty brand falls back to the default', 'Pacific Pro Group' === PPGBH_Options::sanitize( array( 'brand' => '   ' ) )['brand'] );
// WordPress hands the callback values it has already unslashed, and can run it twice on the first save.
$escape = '.ppgbh .bh-cta h3::before{content:"\\201C"}';
$slash  = PPGBH_Options::sanitize( array( 'custom_css' => $escape, 'contact_line' => 'Suite 4\\5, call 425 555 0100' ) );
check( 'a backslash the admin typed is kept (a CSS escape, a contact line)', $escape === $slash['custom_css'] && 'Suite 4\\5, call 425 555 0100' === $slash['contact_line'], $slash['custom_css'] . ' | ' . $slash['contact_line'] );
check( 'cleaning a clean value gives the same value back', $clean === PPGBH_Options::sanitize( $clean ) && $slash === PPGBH_Options::sanitize( $slash ) && $good === PPGBH_Options::sanitize( $good ) );
$odd = PPGBH_Options::sanitize( array( 'brand' => array( 'x' ), 'cta_url' => array( 'y' ), 'accent' => array( '#fff' ), 'max_width' => array( 1 ), 'lead_email' => array( 'a@b.example' ), 'custom_css' => array( 'z' ), 'theme' => array( 'dark' ) ) );
check( 'a field sent as a list is treated as empty, not as text', 'Pacific Pro Group' === $odd['brand'] && '' === $odd['cta_url'] && '#14532d' === $odd['accent'] && '' === $odd['max_width'] && '' === $odd['lead_email'] && '' === $odd['custom_css'] && 'light' === $odd['theme'] );
check( 'a settings value that is not a list at all gives the defaults', 'Pacific Pro Group' === PPGBH_Options::sanitize( 'x' )['brand'] && '' === PPGBH_Options::sanitize( null )['data_url'] );

/* ---------- B. what the shortcode prints ---------- */
// Values put straight into the database, as if another plugin or an old version had written them.
$T['options'][ PPGBH_OPTION ] = array_merge(
	PPGBH_Options::defaults(),
	array(
		'brand'        => $HOSTILE,
		'contact_line' => $HOSTILE,
		'cta_heading'  => $HOSTILE,
		'cta_text'     => $ENTITIES,
		'cta_label'    => 'Call',
		'cta_url'      => 'https://x.example/contact',
		'custom_css'   => '</style><script>alert(3)</script>',
	)
);
PPGBH_Shortcode::register();
check( 'the shortcode is registered', isset( $T['shortcodes']['ppg_build_here'] ) );
// A block theme renders the content before wp_enqueue_scripts runs, so nothing has registered the script yet.
check( 'before the shortcode runs, no script is registered', empty( $T['registered'] ) && empty( $T['enqueued'] ) );

$html = call_user_func( $T['shortcodes']['ppg_build_here'], array( 'title' => 'Lots <b>&</b> "homes"', 'intro' => '<script>alert(4)</script>', 'accent' => 'javascript:1', 'data_url' => 'javascript:alert(5)', 'cta_url' => 'javascript:alert(6)', 'max_width' => '900' ) );
check( 'the script is enqueued when the shortcode runs', array( 'ppg-build-here' ) === $T['enqueued'] );
check( 'the shortcode registers the script itself when the theme has not', isset( $T['registered']['ppg-build-here'] ) );
check( 'one script is registered, for the footer, deferred', isset( $T['registered']['ppg-build-here'] ) && true === $T['registered']['ppg-build-here']['args']['in_footer'] && 'defer' === $T['registered']['ppg-build-here']['args']['strategy'] && PPGBH_VERSION === $T['registered']['ppg-build-here']['ver'] );
// Parse the output the way a browser would, then look for any element or attribute that could run code.
$dom = new DOMDocument();
libxml_use_internal_errors( true );
$dom->loadHTML( '<?xml encoding="utf-8"?><body>' . $html . '</body>' );
$danger = array();
foreach ( $dom->getElementsByTagName( '*' ) as $el ) {
	if ( in_array( strtolower( $el->tagName ), array( 'script', 'img', 'iframe', 'object', 'embed', 'style', 'link' ), true ) ) {
		$danger[] = $el->tagName;
	}
	foreach ( $el->attributes as $attr ) {
		if ( 0 === stripos( $attr->name, 'on' ) || preg_match( '/^\s*javascript:/i', $attr->value ) ) {
			$danger[] = $el->tagName . '@' . $attr->name;
		}
	}
}
// Three divs (the block, the frame, the host), one heading, two paragraphs (the intro and the loading line).
check( 'parsed as HTML, the output has no script, no image and no event handler', array() === $danger && 3 === $dom->getElementsByTagName( 'div' )->length && 1 === $dom->getElementsByTagName( 'h2' )->length && 2 === $dom->getElementsByTagName( 'p' )->length, $danger );
$xp    = new DOMXPath( $dom );
$frame = $xp->query( '//div[@class="ppgbh-frame"]' )->item( 0 );
$host  = $xp->query( '//div[@class="ppgbh-frame"]/div[@class="ppgbh-host"]' )->item( 0 );
check( 'the host sits in a frame that is a size container with a width of its own to claim', $frame && $host && PPGBH_Shortcode::FRAME_STYLE === $frame->getAttribute( 'style' ) && false !== strpos( PPGBH_Shortcode::FRAME_STYLE, 'container-type:inline-size' ) && false !== strpos( PPGBH_Shortcode::FRAME_STYLE, 'contain-intrinsic-inline-size:288px' ) );
check( 'the host reserves its starting height by width, with a plain height first for older browsers', $host && PPGBH_Shortcode::HOST_STYLE === $host->getAttribute( 'style' ) && 1 === preg_match( '/^display:flow-root;min-height:440px;min-height:max\(440px,calc\([^;]*cqw\),calc\([^;]*cqw\)\)$/', PPGBH_Shortcode::HOST_STYLE ), $host ? $host->getAttribute( 'style' ) : '' );
$loading = $xp->query( '//p[@class="ppgbh-fallback"]' )->item( 0 );
check( 'the loading line carries no margin of its own', $loading && 'margin:0' === $loading->getAttribute( 'style' ) );
check( 'the title and intro are escaped text', false !== strpos( $html, '<h2 class="ppgbh-title">Lots &lt;b&gt;&amp;&lt;/b&gt; &quot;homes&quot;</h2>' ) && false !== strpos( $html, '&lt;script&gt;alert(4)&lt;/script&gt;' ), $html );
preg_match( '/data-ppgbh="([^"]*)"/', $html, $m );
check( 'the settings attribute is one quoted attribute', ! empty( $m[1] ) && 1 === substr_count( $html, 'data-ppgbh="' ) );
$cfg = json_decode( html_entity_decode( $m[1], ENT_QUOTES, 'UTF-8' ), true );
check( 'the attribute decodes back to JSON', is_array( $cfg ), $m[1] );
check( 'hostile text arrives as the same text, as data', $HOSTILE === $cfg['brand'] && $HOSTILE === $cfg['contactLine'] && $HOSTILE === $cfg['cta']['heading'] );
// esc_attr() leaves text that already looks like an entity alone, so the browser would turn a typed &quot; into a
// real quote inside the JSON. The JSON therefore carries no & < > or ' at all.
check( 'text that looks like an HTML entity arrives unchanged', $ENTITIES === $cfg['cta']['text'], isset( $cfg['cta']['text'] ) ? $cfg['cta']['text'] : $m[1] );
check( 'the JSON in the attribute holds no character that HTML reads', false === strpbrk( html_entity_decode( $m[1], ENT_QUOTES, 'UTF-8' ), "&<>'" ) );
check( 'a bad accent attribute is ignored', '#14532d' === $cfg['accent'], $cfg['accent'] );
check( 'a javascript: data address attribute is ignored', 'https://www.pacificprogroup.example/wp-content/uploads/ppg-build-here/' === $cfg['dataBase'], $cfg['dataBase'] );
check( 'a javascript: button link attribute is ignored', 'https://x.example/contact' === $cfg['cta']['buttons'][0]['url'] );
check( 'the width attribute is applied', '900px' === $cfg['maxWidth'] );
check( 'the relay address is this site\'s own route', 'https://www.pacificprogroup.example/wp-json/ppg-build-here/v1/geocode' === $cfg['geocodeUrl'], $cfg['geocodeUrl'] );
check( 'service defaults: Esri geocoder and nationwide search off, the rest on', false === $cfg['services']['esriGeocoder'] && false === $cfg['services']['parcelDiscovery'] && true === $cfg['services']['worldImagery'] && true === $cfg['services']['googleMap'] && true === $cfg['services']['openStreetMap'] && true === $cfg['services']['msFootprints'] );
check( 'no email form unless an address is set', '' === $cfg['leadEmail'] );
check( 'the page still says something without JavaScript', false !== strpos( $html, 'class="ppgbh-fallback"' ) );
// A saved copy of the shortcode's HTML can be served without the shortcode running. The page still gets its script.
$T['enqueued'] = array();
$T['singular'] = true;
$T['post']     = (object) array( 'post_content' => '<p>Intro</p>[ppg_build_here title="Lots"]' );
PPGBH_Shortcode::enqueue_for_page();
check( 'a page with the shortcode in its content gets the script even if the shortcode does not run', array( 'ppg-build-here' ) === $T['enqueued'] );
$T['enqueued'] = array();
$T['post']     = (object) array( 'post_content' => '<p>We wrote about ppg_build_here and [another_shortcode] and [ppg_build_here_not].</p>' );
PPGBH_Shortcode::enqueue_for_page();
$T['singular'] = false;
$T['post']     = (object) array( 'post_content' => '[ppg_build_here]' );
PPGBH_Shortcode::enqueue_for_page();
$T['singular'] = true;
$T['post']     = null;
PPGBH_Shortcode::enqueue_for_page();
check( 'a page without the shortcode, an archive, and a request with no post do not get the script', array() === $T['enqueued'], $T['enqueued'] );
$T['singular'] = false;
$second = call_user_func( $T['shortcodes']['ppg_build_here'], array() );
check( 'a second shortcode on the page prints a comment and nothing else', 0 === strpos( $second, '<!--' ) && false === strpos( $second, 'data-ppgbh' ), $second );

// With the email form on, the tool starts taller, and the reserve follows.
$T['options'][ PPGBH_OPTION ] = array_merge( PPGBH_Options::defaults(), array( 'lead_email' => 'office@x.example' ) );
$count = new ReflectionProperty( 'PPGBH_Shortcode', 'count' );
$count->setAccessible( true );
$count->setValue( null, 0 );
$form = call_user_func( $T['shortcodes']['ppg_build_here'], array() );
$count->setValue( null, 1 );
check( 'with the email form on, the reserve is the taller one', false !== strpos( $form, 'style="' . PPGBH_Shortcode::HOST_STYLE_FORM . '"' ) && false === strpos( $form, 'min-height:440px' ) && false !== strpos( PPGBH_Shortcode::HOST_STYLE_FORM, 'min-height:860px' ), substr( $form, 0, 300 ) );

$T['options'][ PPGBH_OPTION ] = array_merge( PPGBH_Options::defaults(), array( 'geocode_relay' => '', 'data_url' => 'https://cdn.x.example/bh', 'cta_heading' => '' ) );
$off = PPGBH_Shortcode::config( PPGBH_Options::get(), shortcode_atts( array( 'brand' => '', 'accent' => '', 'theme' => '', 'max_width' => '', 'data_url' => '', 'cta_url' => '', 'title' => '', 'intro' => '' ), array( 'data_url' => 'https://other.example/d' ) ) );
check( 'relay off: no relay address', '' === $off['geocodeUrl'] );
check( 'a data address on the shortcode wins over the saved one, with a trailing slash', 'https://other.example/d/' === $off['dataBase'], $off['dataBase'] );
check( 'no heading, no call to action', null === $off['cta'] );
check( 'the saved data address gets a trailing slash', 'https://cdn.x.example/bh/' === PPGBH_Options::data_url( PPGBH_Options::get() ) );

/* ---------- C. the address relay ---------- */
PPGBH_Rest::register();
$route = isset( $T['routes']['ppg-build-here/v1/geocode'] ) ? $T['routes']['ppg-build-here/v1/geocode'] : null;
check( 'the route takes POST only and is declared public on purpose', $route && 'POST' === $route['methods'] && '__return_true' === $route['permission_callback'] );

$census = array(
	'result' => array(
		'input'          => array( 'address' => array( 'address' => 'echoed back by the Census' ) ),
		'addressMatches' => array(
			array(
				'matchedAddress'    => '100 FIRST ST, SEATTLE, WA, 98103',
				'coordinates'       => array( 'x' => -122.34, 'y' => 47.69 ),
				'tigerLine'         => array( 'side' => 'L', 'tigerLineId' => '1' ),
				'addressComponents' => array( 'zip' => '98103' ),
				'geographies'       => array(
					'States'              => array( array( 'NAME' => 'Washington', 'STUSAB' => 'WA', 'GEOID' => '53' ) ),
					'Counties'            => array( array( 'NAME' => 'King County', 'GEOID' => '53033' ) ),
					'Incorporated Places' => array( array( 'NAME' => 'Seattle city', 'GEOID' => '5363000' ) ),
				),
			),
			array( 'matchedAddress' => 'A SECOND MATCH', 'coordinates' => array( 'x' => 1, 'y' => 2 ) ),
		),
	),
);
$T['remote'] = function ( $url, $args ) use ( $census ) {
	return array( 'response' => array( 'code' => 200 ), 'body' => json_encode( $census ) );
};
$_SERVER['REMOTE_ADDR'] = '203.0.113.7';

$r = PPGBH_Rest::geocode( new WP_REST_Request( array( 'address' => '100 First St, Seattle, WA 98103' ), array( 'Origin' => 'https://evil.example' ) ) );
check( 'a browser on another site is refused', $r instanceof WP_Error && 403 === $r->data['status'] && 0 === count( $T['remote_log'] ) );
foreach ( array( 'hi', '12345', 'Main Street', '<script>alert(1)</script>', str_repeat( '1 Main St ', 40 ) ) as $bad ) {
	$r = PPGBH_Rest::geocode( new WP_REST_Request( array( 'address' => $bad ) ) );
	check( 'not an address, not forwarded: ' . substr( $bad, 0, 24 ), $r instanceof WP_Error && 400 === $r->data['status'] && 0 === count( $T['remote_log'] ) );
}
$r = PPGBH_Rest::geocode( new WP_REST_Request( array( 'address' => "100 First St #2 & Co, Seattle, WA 98103" ), array( 'Origin' => 'https://www.pacificprogroup.example' ) ) );
check( 'a real address is answered', $r instanceof WP_REST_Response && 200 === $r->status );
$call = $T['remote_log'][0];
check( 'the request goes to the Census host and nowhere else', 0 === strpos( $call['url'], 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?' ) );
check( 'the address is encoded in the request', false !== strpos( $call['url'], 'address=100%20First%20St%20%232%20%26%20Co%2C%20Seattle%2C%20WA%2098103' ) && false !== strpos( $call['url'], 'format=json' ), $call['url'] );
check( 'redirects are not followed and the wait is bounded', 0 === $call['args']['redirection'] && $call['args']['timeout'] <= 15 );
$match = $r->data['result']['addressMatches'][0];
check( 'only the first match is passed on', 1 === count( $r->data['result']['addressMatches'] ) );
check( 'only the fields the tool reads are passed on', array( 'matchedAddress', 'coordinates', 'geographies' ) === array_keys( $match ) && array( 'NAME', 'STUSAB' ) === array_keys( $match['geographies']['States'][0] ) && array( 'NAME' ) === array_keys( $match['geographies']['Counties'][0] ), $match );
check( 'the point and the names are intact', -122.34 === $match['coordinates']['x'] && 47.69 === $match['coordinates']['y'] && 'King County' === $match['geographies']['Counties'][0]['NAME'] && 'Seattle city' === $match['geographies']['Incorporated Places'][0]['NAME'] );
check( 'the answer is marked not to be cached', isset( $r->headers['Cache-Control'] ) && false !== strpos( $r->headers['Cache-Control'], 'no-store' ) );
$stored = json_encode( array( $T['transients'], $T['options'] ) );
check( 'the address is not written to the database', false === stripos( $stored, 'First St' ) && false === strpos( $stored, '203.0.113.7' ) );

$T['remote'] = function () {
	return new WP_Error( 'http_request_failed', 'cURL error 28' );
};
$r = PPGBH_Rest::geocode( new WP_REST_Request( array( 'address' => '100 First St, Seattle, WA 98103' ) ) );
check( 'Census unreachable: 502', $r instanceof WP_Error && 502 === $r->data['status'] );
$T['remote'] = function () {
	return array( 'response' => array( 'code' => 500 ), 'body' => 'oops' );
};
$r = PPGBH_Rest::geocode( new WP_REST_Request( array( 'address' => '100 First St, Seattle, WA 98103' ) ) );
check( 'Census error page: 502', $r instanceof WP_Error && 502 === $r->data['status'] );
$T['remote'] = function () {
	return array( 'response' => array( 'code' => 200 ), 'body' => '<html>not json</html>' );
};
$r = PPGBH_Rest::geocode( new WP_REST_Request( array( 'address' => '100 First St, Seattle, WA 98103' ) ) );
check( 'Census answer that is not JSON: 502', $r instanceof WP_Error && 502 === $r->data['status'] );
$T['remote'] = function () {
	return array( 'response' => array( 'code' => 200 ), 'body' => json_encode( array( 'result' => array( 'addressMatches' => array() ) ) ) );
};
$r = PPGBH_Rest::geocode( new WP_REST_Request( array( 'address' => '1 Nowhere Rd, Atlantis, WA 98000' ) ) );
check( 'no match is an empty list, not an error', $r instanceof WP_REST_Response && array() === $r->data['result']['addressMatches'] );

$T['transients'] = array();
$last            = null;
for ( $i = 0; $i < 31; $i++ ) {
	$last = PPGBH_Rest::geocode( new WP_REST_Request( array( 'address' => '1 Nowhere Rd, Atlantis, WA 98000' ) ) );
}
check( 'the 31st lookup in a minute from one connection is refused', $last instanceof WP_Error && 429 === $last->data['status'] );
$_SERVER['REMOTE_ADDR'] = '203.0.113.8';
$r                      = PPGBH_Rest::geocode( new WP_REST_Request( array( 'address' => '1 Nowhere Rd, Atlantis, WA 98000' ) ) );
check( 'another connection is not affected', $r instanceof WP_REST_Response );

/* ---------- D. the settings page ---------- */
$T['options'][ PPGBH_OPTION ] = array_merge( PPGBH_Options::defaults(), array( 'brand' => $HOSTILE, 'custom_css' => '</textarea><script>alert(7)</script>', 'cta_url' => 'https://x.example/?a="b"' ) );
ob_start();
PPGBH_Settings::page();
$page = ob_get_clean();
check( 'the settings page escapes saved values', false === strpos( $page, '<img src=x' ) && false === strpos( $page, '<script>alert' ) && false !== strpos( $page, '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;' ), substr( $page, 0, 200 ) );
check( 'the settings form posts to options.php with its nonce fields', false !== strpos( $page, 'action="options.php"' ) && false !== strpos( $page, 'name="_wpnonce" value="' . wp_create_nonce( 'ppgbh-options' ) . '"' ) && false !== strpos( $page, 'name="ppgbh_options[data_url]"' ) );
// "Test the connection" makes this server call the Census. It is a link an admin presses, so it carries a nonce of its own.
preg_match( '/href="([^"]*ppgbh_test=1[^"]*)"/', $page, $lm );
$query = array();
parse_str( (string) parse_url( html_entity_decode( isset( $lm[1] ) ? $lm[1] : '', ENT_QUOTES, 'UTF-8' ), PHP_URL_QUERY ), $query );
$nonce = isset( $query['_wpnonce'] ) ? $query['_wpnonce'] : '';
check( 'the connection test link carries a nonce made for that action', '' !== $nonce && wp_create_nonce( 'ppgbh_test' ) === $nonce && wp_create_nonce( 'ppgbh-options' ) !== $nonce, $query );
$T['remote'] = function () {
	return array( 'response' => array( 'code' => 200 ), 'body' => json_encode( array( 'result' => array( 'addressMatches' => array() ) ) ) );
};
$press = function ( $nonce_value ) use ( &$T ) {
	$T['remote_log'] = array();
	$_GET            = array( 'page' => 'ppg-build-here', 'ppgbh_test' => '1' );
	if ( null !== $nonce_value ) {
		$_GET['_wpnonce'] = $nonce_value;
	}
	$_REQUEST = $_GET;
	$stopped  = false;
	ob_start();
	try {
		PPGBH_Settings::page();
	} catch ( PPGBH_Test_Stopped $e ) {
		$stopped = true;
	}
	$html     = ob_get_clean();
	$_GET     = array();
	$_REQUEST = array();
	return array( 'stopped' => $stopped, 'requests' => count( $T['remote_log'] ), 'html' => $html );
};
$r = $press( $nonce );
check( 'with its nonce, the connection test makes one request and reports the result', false === $r['stopped'] && 1 === $r['requests'] && false !== strpos( $r['html'], 'notice-success' ) );
foreach ( array( 'no nonce' => null, 'the nonce of the settings form' => wp_create_nonce( 'ppgbh-options' ), 'a made-up nonce' => 'abcdef1234' ) as $label => $bad ) {
	$r = $press( $bad );
	check( 'the connection test does not run with ' . $label, true === $r['stopped'] && 0 === $r['requests'] );
}
$T['can'] = false;
$r        = $press( $nonce );
check( 'a user who may not manage options cannot run the connection test, even with the nonce', 0 === $r['requests'] && '' === $r['html'] );
$T['can'] = true;
check( 'every input on the settings page has a label', substr_count( $page, '<input class="regular-text"' ) === substr_count( $page, '<th scope="row"><label for="ppgbh-' ) - 3 ); // three labels belong to the two selects and the textarea.
$T['can'] = false;
ob_start();
PPGBH_Settings::page();
check( 'the settings page prints nothing for a user who may not manage options', '' === ob_get_clean() );
$T['can'] = true;

/* ---------- E. the data folder ---------- */
$folder = PPGBH_Options::data_folder();
check( 'the data folder is under uploads', false !== strpos( $folder['dir'], 'ppgbh-uploads/ppg-build-here/' ) && 'https://www.pacificprogroup.example/wp-content/uploads/ppg-build-here/' === $folder['url'] );
$status = PPGBH_Options::data_status();
check( 'no data files: reported as not found', false === $status['found'] );
PPGBH_Options::activate();
check( 'activation makes the folder', is_dir( $folder['dir'] . 'kc-resbldg' ) );
file_put_contents( $folder['dir'] . 'kc-resbldg/_meta.json', json_encode( array( 'built' => '2026-11-01', 'sourceDate' => '2026-10-28', 'parcels' => 512345, 'shards' => array( '00', '01', '02' ) ) ) );
$status = PPGBH_Options::data_status();
check( 'data files: date and counts are read', true === $status['found'] && '2026-11-01' === $status['built'] && '2026-10-28' === $status['source_date'] && 512345 === $status['parcels'] && 3 === $status['shards'] );
unlink( $folder['dir'] . 'kc-resbldg/_meta.json' );
rmdir( $folder['dir'] . 'kc-resbldg' );
rmdir( $folder['dir'] );
@rmdir( $T['uploads'] );

/* ---------- F. removal ---------- */
define( 'WP_UNINSTALL_PLUGIN', true );
require dirname( __DIR__ ) . '/ppg-build-here/uninstall.php';
check( 'deleting the plugin removes its settings', false === get_option( PPGBH_OPTION, false ) );

echo "\n" . ( $failed ? $failed . ' check(s) failed' : 'all checks passed' ) . "\n";
exit( $failed ? 1 : 0 );
