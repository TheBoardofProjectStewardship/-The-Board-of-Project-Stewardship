<?php
/**
 * Settings: defaults, reading, cleaning, and the data folder.
 *
 * @package PPG_Build_Here
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class PPGBH_Options {

	/**
	 * Every setting with its default. Checkboxes are '1' or ''.
	 */
	public static function defaults() {
		return array(
			// Brand.
			'brand'            => 'Pacific Pro Group',
			'accent'           => '#14532d',
			'theme'            => 'light',
			'font'             => 'site',
			'max_width'        => '',
			'contact_line'     => '',
			// Call to action at the end of the study.
			'cta_heading'      => 'Talk to Pacific Pro Group about this lot',
			'cta_text'         => 'A feasibility study is a starting point. A site visit and a conversation with a licensed contractor come next.',
			'cta_label'        => 'Request a consultation',
			'cta_url'          => '',
			'cta2_label'       => '',
			'cta2_url'         => '',
			// Optional email form under the study. Empty means the form is not shown.
			'lead_email'       => '',
			// Optional links inside the study.
			'permits_url'      => '',
			'bids_url'         => '',
			// Data.
			'data_url'         => '',
			// Outside services.
			'geocode_relay'    => '1',
			'esri_geocoder'    => '',
			'world_imagery'    => '1',
			'google_map'       => '1',
			'openstreetmap'    => '1',
			'ms_footprints'    => '1',
			'parcel_discovery' => '',
			// Other.
			'custom_css'       => '',
		);
	}

	public static function get() {
		$saved = get_option( PPGBH_OPTION, array() );
		return array_merge( self::defaults(), is_array( $saved ) ? $saved : array() );
	}

	/**
	 * Clean a submitted settings array. Unknown keys are dropped.
	 *
	 * This is the sanitize callback of register_setting(). WordPress has already removed the slashes it
	 * adds to form data by the time it calls this (wp-admin/options.php does so before update_option()),
	 * so nothing is unslashed here: doing it again would eat a backslash the admin typed, such as a CSS
	 * escape. WordPress can also run the callback twice on the first save, so cleaning a clean value must
	 * give the same value back.
	 */
	public static function sanitize( $input ) {
		$input = is_array( $input ) ? $input : array();
		$out   = array();
		$def   = self::defaults();

		foreach ( array( 'brand', 'contact_line', 'cta_heading', 'cta_text', 'cta_label', 'cta2_label' ) as $key ) {
			$out[ $key ] = isset( $input[ $key ] ) && is_scalar( $input[ $key ] ) ? sanitize_text_field( (string) $input[ $key ] ) : '';
		}
		if ( '' === $out['brand'] ) {
			$out['brand'] = $def['brand'];
		}
		foreach ( array( 'cta_url', 'cta2_url', 'permits_url', 'bids_url', 'data_url' ) as $key ) {
			$out[ $key ] = isset( $input[ $key ] ) && is_scalar( $input[ $key ] ) ? esc_url_raw( trim( (string) $input[ $key ] ), array( 'http', 'https' ) ) : '';
		}
		$accent        = isset( $input['accent'] ) && is_scalar( $input['accent'] ) ? sanitize_hex_color( trim( (string) $input['accent'] ) ) : '';
		$out['accent'] = ( $accent && 7 === strlen( $accent ) ) ? $accent : $def['accent'];
		$out['theme']  = ( isset( $input['theme'] ) && 'dark' === $input['theme'] ) ? 'dark' : 'light';
		$out['font']   = ( isset( $input['font'] ) && 'system' === $input['font'] ) ? 'system' : 'site';
		$width         = isset( $input['max_width'] ) && is_scalar( $input['max_width'] ) ? absint( $input['max_width'] ) : 0;
		$out['max_width'] = ( $width >= 320 && $width <= 2400 ) ? (string) $width : '';
		$email         = isset( $input['lead_email'] ) && is_scalar( $input['lead_email'] ) ? sanitize_email( (string) $input['lead_email'] ) : '';
		$out['lead_email'] = is_email( $email ) ? $email : '';
		foreach ( array( 'geocode_relay', 'esri_geocoder', 'world_imagery', 'google_map', 'openstreetmap', 'ms_footprints', 'parcel_discovery' ) as $key ) {
			$out[ $key ] = empty( $input[ $key ] ) ? '' : '1';
		}
		// Styles only. Anything that looks like markup is removed, and the loader strips a style end tag again.
		$css               = isset( $input['custom_css'] ) && is_scalar( $input['custom_css'] ) ? wp_strip_all_tags( (string) $input['custom_css'] ) : '';
		$out['custom_css'] = substr( $css, 0, 20000 );

		return $out;
	}

	/**
	 * Folder for the King County data files. It is in uploads so a plugin update does not remove it.
	 *
	 * @return array{dir:string,url:string}
	 */
	public static function data_folder() {
		$up = wp_upload_dir( null, false );
		return array(
			'dir' => trailingslashit( $up['basedir'] ) . 'ppg-build-here/',
			'url' => trailingslashit( set_url_scheme( $up['baseurl'] ) ) . 'ppg-build-here/',
		);
	}

	/**
	 * The address the script reads data from: the setting when one is saved, otherwise the uploads folder.
	 */
	public static function data_url( $options ) {
		if ( ! empty( $options['data_url'] ) ) {
			return trailingslashit( $options['data_url'] );
		}
		$folder = self::data_folder();
		return $folder['url'];
	}

	/**
	 * What is in the data folder, for the settings page.
	 *
	 * @return array{found:bool,built:string,source_date:string,parcels:int,shards:int}
	 */
	public static function data_status() {
		$folder = self::data_folder();
		$meta   = $folder['dir'] . 'kc-resbldg/_meta.json';
		$status = array(
			'found'       => false,
			'built'       => '',
			'source_date' => '',
			'parcels'     => 0,
			'shards'      => 0,
		);
		if ( is_readable( $meta ) ) {
			$json = json_decode( (string) file_get_contents( $meta ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file in uploads.
			if ( is_array( $json ) ) {
				$status['found']       = true;
				$status['built']       = isset( $json['built'] ) ? sanitize_text_field( $json['built'] ) : '';
				$status['source_date'] = isset( $json['sourceDate'] ) ? sanitize_text_field( $json['sourceDate'] ) : '';
				$status['parcels']     = isset( $json['parcels'] ) ? absint( $json['parcels'] ) : 0;
				$status['shards']      = isset( $json['shards'] ) && is_array( $json['shards'] ) ? count( $json['shards'] ) : 0;
			}
		}
		return $status;
	}

	public static function activate() {
		$folder = self::data_folder();
		if ( ! is_dir( $folder['dir'] . 'kc-resbldg' ) ) {
			wp_mkdir_p( $folder['dir'] . 'kc-resbldg' );
		}
		if ( false === get_option( PPGBH_OPTION, false ) ) {
			add_option( PPGBH_OPTION, self::defaults(), '', 'no' );
		}
	}
}
