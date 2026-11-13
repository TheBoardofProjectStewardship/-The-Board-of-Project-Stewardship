<?php
/**
 * Address lookup relay: POST /wp-json/ppg-build-here/v1/geocode  {"address": "..."}
 *
 * The US Census geocoder sends no CORS header, so a browser can only call it by loading its answer
 * as a script (JSONP). That runs another origin's script in the page and breaks a strict
 * Content-Security-Policy. This route asks the Census from the server instead and hands back JSON.
 *
 * What it does not do: it does not store the address, cache the answer, or write either to a log.
 * It talks to one fixed host. It is not a general proxy.
 *
 * @package PPG_Build_Here
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class PPGBH_Rest {

	const CENSUS = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';

	public static function register() {
		register_rest_route(
			'ppg-build-here/v1',
			'/geocode',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'geocode' ),
				// Public on purpose: the visitor is not signed in. The checks are in the callback.
				'permission_callback' => '__return_true',
				'args'                => array(
					'address' => array(
						'required' => true,
						'type'     => 'string',
					),
				),
			)
		);
	}

	/**
	 * A browser on another site must not use this route. Requests with no Origin (server-side tools) are
	 * limited by the rate check only.
	 */
	private static function same_site( $request ) {
		$origin = $request->get_header( 'origin' );
		if ( ! $origin ) {
			return true;
		}
		$theirs = wp_parse_url( $origin, PHP_URL_HOST );
		$ours   = array( wp_parse_url( home_url(), PHP_URL_HOST ), wp_parse_url( site_url(), PHP_URL_HOST ) );
		return $theirs && in_array( strtolower( $theirs ), array_map( 'strtolower', array_filter( $ours ) ), true );
	}

	/**
	 * At most N lookups a minute from one network address. The address is hashed with the site salt and
	 * kept for one minute as a counter. It is not written anywhere else.
	 */
	private static function too_many() {
		$limit = (int) apply_filters( 'ppg_build_here_rate_limit', 30 );
		if ( $limit <= 0 ) {
			return false;
		}
		$ip    = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		$key   = 'ppgbh_rl_' . substr( hash_hmac( 'sha256', $ip, wp_salt( 'nonce' ) ), 0, 32 );
		$count = (int) get_transient( $key );
		if ( $count >= $limit ) {
			return true;
		}
		set_transient( $key, $count + 1, MINUTE_IN_SECONDS );
		return false;
	}

	public static function geocode( $request ) {
		if ( ! self::same_site( $request ) ) {
			return new WP_Error( 'ppgbh_forbidden', 'This lookup is for pages on this site.', array( 'status' => 403 ) );
		}
		$raw     = (string) $request->get_param( 'address' );
		$address = trim( sanitize_text_field( $raw ) );
		$length  = function_exists( 'mb_strlen' ) ? mb_strlen( $address ) : strlen( $address );
		// A street address has a number and a name, and no markup. Anything else is answered here and not forwarded.
		if ( preg_match( '/[<>{}\\\\]/', $raw ) || $length < 5 || $length > 200 || ! preg_match( '/\d/', $address ) || ! preg_match( '/[A-Za-z]/', $address ) ) {
			return new WP_Error( 'ppgbh_bad_address', 'Enter a street address with a house number, city and ZIP.', array( 'status' => 400 ) );
		}
		if ( self::too_many() ) {
			return new WP_Error( 'ppgbh_slow_down', 'Too many lookups from this connection. Wait a minute and try again.', array( 'status' => 429 ) );
		}

		$url = add_query_arg(
			array(
				'address'   => rawurlencode( $address ),
				'benchmark' => 'Public_AR_Current',
				'vintage'   => 'Current_Current',
				'layers'    => rawurlencode( 'States,Counties,Incorporated Places' ),
				'format'    => 'json',
			),
			self::CENSUS
		);
		$answer = wp_remote_get(
			$url,
			array(
				'timeout'     => 12,
				'redirection' => 0,
				'user-agent'  => 'PPG-Build-Here/' . PPGBH_VERSION,
			)
		);
		if ( is_wp_error( $answer ) || 200 !== (int) wp_remote_retrieve_response_code( $answer ) ) {
			return new WP_Error( 'ppgbh_upstream', 'The US Census geocoder did not answer.', array( 'status' => 502 ) );
		}
		$data = json_decode( wp_remote_retrieve_body( $answer ), true );
		if ( ! is_array( $data ) || ! isset( $data['result'] ) ) {
			return new WP_Error( 'ppgbh_upstream', 'The US Census geocoder sent an answer this site could not read.', array( 'status' => 502 ) );
		}

		$response = new WP_REST_Response( array( 'result' => array( 'addressMatches' => self::matches( $data ) ) ), 200 );
		$response->header( 'Cache-Control', 'no-store, private' );
		return $response;
	}

	/**
	 * Only the fields the tool reads are passed on: the matched address, the point, and the names of the
	 * state, county and city.
	 */
	private static function matches( $data ) {
		$out  = array();
		$list = isset( $data['result']['addressMatches'] ) && is_array( $data['result']['addressMatches'] ) ? $data['result']['addressMatches'] : array();
		foreach ( array_slice( $list, 0, 1 ) as $m ) {
			if ( ! isset( $m['matchedAddress'], $m['coordinates']['x'], $m['coordinates']['y'] ) ) {
				continue;
			}
			$geo = array();
			foreach ( array( 'States', 'Counties', 'Incorporated Places' ) as $layer ) {
				$rows = isset( $m['geographies'][ $layer ] ) && is_array( $m['geographies'][ $layer ] ) ? $m['geographies'][ $layer ] : array();
				foreach ( array_slice( $rows, 0, 1 ) as $row ) {
					$item = array( 'NAME' => isset( $row['NAME'] ) ? sanitize_text_field( $row['NAME'] ) : '' );
					if ( 'States' === $layer ) {
						$item['STUSAB'] = isset( $row['STUSAB'] ) ? sanitize_text_field( $row['STUSAB'] ) : '';
					}
					$geo[ $layer ][] = $item;
				}
			}
			$out[] = array(
				'matchedAddress' => sanitize_text_field( $m['matchedAddress'] ),
				'coordinates'    => array(
					'x' => (float) $m['coordinates']['x'],
					'y' => (float) $m['coordinates']['y'],
				),
				'geographies'    => $geo,
			);
		}
		return $out;
	}
}
