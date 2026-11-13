<?php
/**
 * The [ppg_build_here] shortcode.
 *
 * It prints one element that carries the settings as JSON in an attribute, and loads one script.
 * The script builds the tool inside a shadow root on that element, so the theme's styles and the
 * tool's styles cannot reach each other.
 *
 * @package PPG_Build_Here
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class PPGBH_Shortcode {

	/**
	 * Inline styles of the two elements around the tool. tests/e2e/scn_wp.py reads these three strings, so
	 * the browser test runs on the markup this file prints.
	 *
	 * FRAME_STYLE  The frame is a size container, so the host can size its reserve by the width it is given
	 *              (cqw units). A size container has no width of its own; contain-intrinsic-inline-size
	 *              gives it one to claim inside a parent that is only as wide as its content.
	 * HOST_STYLE   The height the tool starts at, so the page below it does not move when the script
	 *              runs. That height depends on the width: about 400px in a wide column, about 630px on a
	 *              390px phone, about 730px at 280px. The second min-height follows it from just above
	 *              (measured in Chrome with default settings, 280px to 1280px wide: 15 to 62px over). A
	 *              browser without container units keeps the first min-height.
	 *              display:flow-root keeps the margins of the "loading" paragraph inside the host. With
	 *              display:block a theme's top margin on paragraphs moved the host down until the script
	 *              ran, and the page then moved up by that margin.
	 * HOST_STYLE_FORM  The same with the email form under the tool, which adds at least 420px.
	 */
	const FRAME_STYLE     = 'container-type:inline-size;contain-intrinsic-inline-size:288px';
	const HOST_STYLE      = 'display:flow-root;min-height:440px;min-height:max(440px,calc(1133px - 133.33cqw),calc(787px - 41.67cqw))';
	const HOST_STYLE_FORM = 'display:flow-root;min-height:860px;min-height:max(860px,calc(1553px - 133.33cqw),calc(1207px - 41.67cqw))';

	/**
	 * Only the first shortcode on a page becomes the tool.
	 *
	 * @var int
	 */
	private static $count = 0;

	public static function register() {
		add_shortcode( 'ppg_build_here', array( __CLASS__, 'render' ) );
	}

	public static function register_script() {
		$src = plugins_url( 'assets/js/ppg-build-here.js', PPGBH_FILE );
		// WordPress 6.3 and later read the array. Older versions treat it as "in the footer".
		wp_register_script( 'ppg-build-here', $src, array(), PPGBH_VERSION, array( 'in_footer' => true, 'strategy' => 'defer' ) );
	}

	/**
	 * Runs on wp_enqueue_scripts.
	 *
	 * The script is normally asked for by the shortcode itself, when it prints. A page builder or a
	 * fragment cache can serve a saved copy of the shortcode's HTML without running the shortcode, and the
	 * page would then have the element and no script. So when the page being shown has the shortcode in its
	 * content, the script is asked for here as well. Asking twice loads it once.
	 */
	public static function enqueue_for_page() {
		self::register_script();
		if ( ! is_singular() ) {
			return;
		}
		$post = get_post();
		if ( $post && isset( $post->post_content ) && has_shortcode( (string) $post->post_content, 'ppg_build_here' ) ) {
			wp_enqueue_script( 'ppg-build-here' );
		}
	}

	/**
	 * Settings for the script, from the saved options and the shortcode's own attributes.
	 */
	public static function config( $options, $atts ) {
		$buttons = array();
		if ( '' !== $options['cta_label'] && '' !== $options['cta_url'] ) {
			$buttons[] = array( 'label' => $options['cta_label'], 'url' => $options['cta_url'] );
		}
		if ( '' !== $options['cta2_label'] && '' !== $options['cta2_url'] ) {
			$buttons[] = array( 'label' => $options['cta2_label'], 'url' => $options['cta2_url'], 'ghost' => true );
		}
		$host   = wp_parse_url( home_url(), PHP_URL_HOST );
		$config = array(
			'brand'       => $options['brand'],
			'accent'      => $options['accent'],
			'theme'       => $options['theme'],
			'font'        => $options['font'],
			'maxWidth'    => '' !== $options['max_width'] ? $options['max_width'] . 'px' : '',
			'dataBase'    => PPGBH_Options::data_url( $options ),
			'siteBase'    => trailingslashit( home_url() ),
			'geocodeUrl'  => '1' === $options['geocode_relay'] ? esc_url_raw( rest_url( 'ppg-build-here/v1/geocode' ) ) : '',
			'services'    => array(
				'esriGeocoder'    => '1' === $options['esri_geocoder'],
				'worldImagery'    => '1' === $options['world_imagery'],
				'googleMap'       => '1' === $options['google_map'],
				'openStreetMap'   => '1' === $options['openstreetmap'],
				'msFootprints'    => '1' === $options['ms_footprints'],
				'parcelDiscovery' => '1' === $options['parcel_discovery'],
			),
			'cta'         => '' !== $options['cta_heading'] ? array(
				'heading' => $options['cta_heading'],
				'text'    => $options['cta_text'],
				'buttons' => $buttons,
			) : null,
			'contactLine' => $options['contact_line'],
			'leadEmail'   => $options['lead_email'],
			'leadSource'  => $host ? $host : '',
			'permitsUrl'  => $options['permits_url'],
			'bidsUrl'     => $options['bids_url'],
			'customCss'   => $options['custom_css'],
		);

		// Attributes on the shortcode win over the saved settings, for a page that needs its own look.
		if ( '' !== $atts['brand'] ) {
			$config['brand'] = sanitize_text_field( $atts['brand'] );
		}
		$accent = sanitize_hex_color( $atts['accent'] );
		if ( $accent && 7 === strlen( $accent ) ) {
			$config['accent'] = $accent;
		}
		if ( in_array( $atts['theme'], array( 'light', 'dark' ), true ) ) {
			$config['theme'] = $atts['theme'];
		}
		$width = absint( $atts['max_width'] );
		if ( $width >= 320 && $width <= 2400 ) {
			$config['maxWidth'] = $width . 'px';
		}
		$data_url = esc_url_raw( trim( $atts['data_url'] ), array( 'http', 'https' ) );
		if ( '' !== $data_url ) {
			$config['dataBase'] = trailingslashit( $data_url );
		}
		$cta_url = esc_url_raw( trim( $atts['cta_url'] ), array( 'http', 'https' ) );
		if ( '' !== $cta_url && ! empty( $config['cta']['buttons'][0] ) ) {
			$config['cta']['buttons'][0]['url'] = $cta_url;
		}

		/**
		 * Last word on the settings handed to the script.
		 *
		 * @param array $config  Settings as the script reads them.
		 * @param array $options Saved options.
		 * @param array $atts    Shortcode attributes.
		 */
		return apply_filters( 'ppg_build_here_config', $config, $options, $atts );
	}

	public static function render( $atts ) {
		$atts = shortcode_atts(
			array(
				'brand'     => '',
				'accent'    => '',
				'theme'     => '',
				'max_width' => '',
				'data_url'  => '',
				'cta_url'   => '',
				'title'     => '',
				'intro'     => '',
			),
			$atts,
			'ppg_build_here'
		);

		self::$count++;
		if ( self::$count > 1 ) {
			return '<!-- ppg_build_here: the tool is already on this page, so this second shortcode prints nothing. -->';
		}

		// A block theme renders the page content before wp_enqueue_scripts has run, and a page builder can
		// render a shortcode from its own request. Register here when that hook has not done it yet.
		if ( ! wp_script_is( 'ppg-build-here', 'registered' ) ) {
			self::register_script();
		}
		wp_enqueue_script( 'ppg-build-here' );

		$options = PPGBH_Options::get();
		$config  = self::config( $options, $atts );
		// The settings travel as JSON inside one HTML attribute. The HEX flags write & < > ' and any quote
		// inside a value as \uXXXX, so the JSON holds no character that HTML reads. That matters because
		// esc_attr() leaves text that already looks like an entity alone: a brand name typed as "A &quot;B&quot;"
		// would otherwise come out of the attribute as a bare quote and break the JSON.
		$json = wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES );
		if ( false === $json ) {
			$json = '{}';
		}

		// The heading and the first paragraph are ordinary page content: the theme styles them and search engines read them.
		$html = '<div class="ppgbh-block">';
		if ( '' !== $atts['title'] ) {
			$html .= '<h2 class="ppgbh-title">' . esc_html( $atts['title'] ) . '</h2>';
		}
		if ( '' !== $atts['intro'] ) {
			$html .= '<p class="ppgbh-intro">' . esc_html( $atts['intro'] ) . '</p>';
		}
		// The paragraph inside the element shows until the script runs, and stays for a visitor without JavaScript.
		// The minimum height is about the tool's own starting height at the width it is given (see HOST_STYLE).
		$host_style = empty( $config['leadEmail'] ) ? self::HOST_STYLE : self::HOST_STYLE_FORM;
		$html      .= '<div class="ppgbh-frame" style="' . esc_attr( self::FRAME_STYLE ) . '">';
		$html      .= '<div class="ppgbh-host" style="' . esc_attr( $host_style ) . '" data-ppgbh="' . esc_attr( $json ) . '">';
		$html      .= '<p class="ppgbh-fallback" style="margin:0">' . esc_html__( 'The lot feasibility tool is loading. It needs JavaScript. If it does not appear, reload the page or call us.', 'ppg-build-here' ) . '</p>';
		$html      .= '</div></div></div>';

		return $html;
	}
}
