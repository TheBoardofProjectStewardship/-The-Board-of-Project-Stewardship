<?php
/**
 * Settings > PPG Build Here.
 *
 * @package PPG_Build_Here
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class PPGBH_Settings {

	const PAGE = 'ppg-build-here';

	public static function menu() {
		add_options_page( 'PPG Build Here', 'PPG Build Here', 'manage_options', self::PAGE, array( __CLASS__, 'page' ) );
	}

	public static function register() {
		register_setting(
			'ppgbh',
			PPGBH_OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( 'PPGBH_Options', 'sanitize' ),
				'default'           => PPGBH_Options::defaults(),
			)
		);
	}

	public static function action_link( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'options-general.php?page=' . self::PAGE ) ) . '">' . esc_html__( 'Settings', 'ppg-build-here' ) . '</a>' );
		return $links;
	}

	private static function text( $o, $key, $label, $help = '', $type = 'text', $placeholder = '' ) {
		$id = 'ppgbh-' . $key;
		echo '<tr><th scope="row"><label for="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</label></th><td>';
		echo '<input class="regular-text" type="' . esc_attr( $type ) . '" id="' . esc_attr( $id ) . '" name="' . esc_attr( PPGBH_OPTION . '[' . $key . ']' ) . '" value="' . esc_attr( $o[ $key ] ) . '" placeholder="' . esc_attr( $placeholder ) . '"' . ( $help ? ' aria-describedby="' . esc_attr( $id ) . '-help"' : '' ) . '>';
		if ( $help ) {
			echo '<p class="description" id="' . esc_attr( $id ) . '-help">' . esc_html( $help ) . '</p>';
		}
		echo '</td></tr>';
	}

	private static function check( $o, $key, $label, $help ) {
		$id = 'ppgbh-' . $key;
		echo '<tr><th scope="row">' . esc_html( $label ) . '</th><td><label for="' . esc_attr( $id ) . '">';
		echo '<input type="checkbox" id="' . esc_attr( $id ) . '" name="' . esc_attr( PPGBH_OPTION . '[' . $key . ']' ) . '" value="1"' . checked( '1', $o[ $key ], false ) . '> ';
		echo esc_html( $help ) . '</label></td></tr>';
	}

	/**
	 * One server-side call to the Census with a public address, so an admin can see whether this host
	 * allows outgoing requests. Runs only when the button is pressed.
	 */
	private static function relay_test() {
		$answer = wp_remote_get(
			add_query_arg(
				array(
					'address'   => rawurlencode( '4600 Silver Hill Rd, Washington, DC 20233' ),
					'benchmark' => 'Public_AR_Current',
					'vintage'   => 'Current_Current',
					'format'    => 'json',
				),
				PPGBH_Rest::CENSUS
			),
			array(
				'timeout'    => 12,
				'user-agent' => 'PPG-Build-Here/' . PPGBH_VERSION,
			)
		);
		if ( is_wp_error( $answer ) ) {
			return array( false, 'This server could not reach the US Census geocoder: ' . $answer->get_error_message() );
		}
		$code = (int) wp_remote_retrieve_response_code( $answer );
		$data = json_decode( wp_remote_retrieve_body( $answer ), true );
		if ( 200 !== $code || ! isset( $data['result'] ) ) {
			return array( false, 'The US Census geocoder answered with HTTP ' . $code . ', and the answer could not be read.' );
		}
		return array( true, 'This server reached the US Census geocoder and read its answer.' );
	}

	public static function page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$o      = PPGBH_Options::get();
		$folder = PPGBH_Options::data_folder();
		$data   = PPGBH_Options::data_status();

		echo '<div class="wrap"><h1>PPG Build Here</h1>';

		if ( isset( $_GET['ppgbh_test'] ) && check_admin_referer( 'ppgbh_test' ) ) {
			list( $ok, $message ) = self::relay_test();
			echo '<div class="notice ' . ( $ok ? 'notice-success' : 'notice-error' ) . '"><p>' . esc_html( $message ) . '</p></div>';
		}

		echo '<p>Add the tool to a page with the shortcode <code>[ppg_build_here]</code>. In Elementor, use the Shortcode widget. One tool per page.</p>';

		echo '<h2>King County data files</h2>';
		if ( $data['found'] ) {
			echo '<p><span class="dashicons dashicons-yes" aria-hidden="true"></span> ' . esc_html( sprintf( 'Found: %1$s parcels in %2$s files, built %3$s%4$s.', number_format_i18n( $data['parcels'] ), number_format_i18n( $data['shards'] ), $data['built'], $data['source_date'] ? ', county file dated ' . $data['source_date'] : '' ) ) . '</p>';
		} elseif ( '' !== $o['data_url'] ) {
			echo '<p>The data address below is set, so the files in this site\'s uploads folder are not used.</p>';
		} else {
			echo '<div class="notice notice-warning inline"><p>No data files were found. The tool works without them, but it will not fill in finished living area, year built or stories for King County addresses. Upload the <code>kc-resbldg</code> folder to <code>' . esc_html( $folder['dir'] ) . '</code> or set a data address below. The README has the steps.</p></div>';
		}

		echo '<form method="post" action="options.php">';
		settings_fields( 'ppgbh' );

		echo '<table class="form-table" role="presentation">';
		self::text( $o, 'data_url', 'Data address', 'Leave empty to read ' . $folder['url'] . ' on this site. Set it only if the data files are hosted elsewhere, and that host must send an Access-Control-Allow-Origin header.', 'url', 'https://' );
		echo '</table>';

		echo '<h2>Brand</h2><table class="form-table" role="presentation">';
		self::text( $o, 'brand', 'Name on the study', 'Printed in the foot of every page of the study and at the top of the saved file.' );
		self::text( $o, 'accent', 'Brand color', 'Six-digit hex, such as #14532d. Used for buttons, links and focus rings around the study. Text colors are chosen for contrast.', 'text', '#14532d' );
		echo '<tr><th scope="row"><label for="ppgbh-theme">Tool background</label></th><td><select id="ppgbh-theme" name="' . esc_attr( PPGBH_OPTION . '[theme]' ) . '"><option value="light"' . selected( 'light', $o['theme'], false ) . '>Light cards (for a light page)</option><option value="dark"' . selected( 'dark', $o['theme'], false ) . '>Dark cards (for a dark page)</option></select></td></tr>';
		echo '<tr><th scope="row"><label for="ppgbh-font">Font</label></th><td><select id="ppgbh-font" name="' . esc_attr( PPGBH_OPTION . '[font]' ) . '"><option value="site"' . selected( 'site', $o['font'], false ) . '>The font of the page it sits on</option><option value="system"' . selected( 'system', $o['font'], false ) . '>The device\'s system font</option></select></td></tr>';
		self::text( $o, 'max_width', 'Maximum width (px)', 'Leave empty for 1152. The tool never grows wider than the column it is placed in.', 'number' );
		self::text( $o, 'contact_line', 'Contact line', 'One plain line printed at the foot of the saved study, such as a name, phone number and web address.' );
		echo '</table>';

		echo '<h2>Call to action at the end of the study</h2><table class="form-table" role="presentation">';
		self::text( $o, 'cta_heading', 'Heading', 'Leave empty to show no call to action.' );
		self::text( $o, 'cta_text', 'Text' );
		self::text( $o, 'cta_label', 'Button label' );
		self::text( $o, 'cta_url', 'Button link', 'The button is shown only when both the label and the link are set.', 'url', 'https://' );
		self::text( $o, 'cta2_label', 'Second button label' );
		self::text( $o, 'cta2_url', 'Second button link', '', 'url', 'https://' );
		self::text( $o, 'lead_email', 'Email form address', 'Optional. When set, a short form under the study opens the visitor\'s own email app with a message to this address. Nothing is sent by this site. Leave empty to show no form.', 'email' );
		self::text( $o, 'permits_url', 'Permit resources link', 'Optional. Linked from the study where a zone is not coded.', 'url', 'https://' );
		self::text( $o, 'bids_url', 'How to compare bids link', 'Optional. Linked from the Next steps page.', 'url', 'https://' );
		echo '</table>';

		echo '<h2>Outside services</h2><p>The tool always reads county, city, state and federal map servers. These are the others. Turning one off marks what it feeds as unavailable. Nothing is guessed in its place.</p><table class="form-table" role="presentation">';
		self::check( $o, 'geocode_relay', 'Address lookup through this site', 'Ask the US Census geocoder from this server (recommended). Off: the visitor\'s browser loads the Census answer as a script.' );
		self::check( $o, 'esri_geocoder', 'Esri World Geocoder', 'Try Esri when the Census has no match. Check Esri\'s terms of use for your site before you turn this on.' );
		self::check( $o, 'world_imagery', 'Esri World Imagery', 'Use it for the aerial photo outside King and Snohomish counties, and when a county photo does not load.' );
		self::check( $o, 'google_map', 'Google satellite map', 'Offer a Google map of the lot. It loads only when the visitor presses the button.' );
		self::check( $o, 'openstreetmap', 'OpenStreetMap', 'Read driveways and, where no county layer exists, building outlines from the public Overpass servers.' );
		self::check( $o, 'ms_footprints', 'Microsoft building footprints', 'Read Esri-hosted building footprints where no county or city outline exists.' );
		self::check( $o, 'parcel_discovery', 'Search for parcel layers nationwide', 'Outside the built-in list of states, search ArcGIS Online for a public parcel layer. Leave off for a King and Snohomish County audience.' );
		echo '</table>';

		echo '<h2>Custom styles</h2><table class="form-table" role="presentation"><tr><th scope="row"><label for="ppgbh-custom_css">CSS for inside the tool</label></th><td>';
		echo '<textarea id="ppgbh-custom_css" class="large-text code" rows="6" name="' . esc_attr( PPGBH_OPTION . '[custom_css]' ) . '" aria-describedby="ppgbh-custom_css-help">' . esc_textarea( $o['custom_css'] ) . '</textarea>';
		echo '<p class="description" id="ppgbh-custom_css-help">The tool is drawn inside a shadow root, so the theme\'s CSS and Elementor\'s custom CSS do not reach it. Rules typed here do. Start selectors with <code>.ppgbh</code>, for example <code>.ppgbh .bh-btn{border-radius:999px}</code>.</p></td></tr></table>';

		submit_button();
		echo '</form>';

		$test = wp_nonce_url( admin_url( 'options-general.php?page=' . self::PAGE . '&ppgbh_test=1' ), 'ppgbh_test' );
		echo '<h2>Check the address lookup</h2><p>This makes one request from this server to the US Census geocoder, using the Census Bureau\'s own street address.</p><p><a class="button" href="' . esc_url( $test ) . '">Test the connection</a></p>';
		echo '</div>';
	}
}
