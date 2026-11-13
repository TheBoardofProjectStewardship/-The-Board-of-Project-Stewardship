<?php
/**
 * Stand-ins for the WordPress functions the plugin calls, so its PHP can be run from the command line.
 *
 * These are not WordPress. They copy the documented behavior closely enough to check the plugin's own
 * logic: what it cleans on the way in, what it escapes on the way out, and what each route answers.
 * A pass here does not replace a test on a real WordPress site.
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'MINUTE_IN_SECONDS', 60 );

$GLOBALS['ppgbh_test'] = array(
	'options'    => array(),
	'transients' => array(),
	'enqueued'   => array(),
	'registered' => array(),
	'routes'     => array(),
	'shortcodes' => array(),
	'filters'    => array(),
	'remote'     => null, // callable( $url, $args ) => array|WP_Error.
	'remote_log' => array(),
	'is_admin'   => false,
	'singular'   => false,
	'post'       => null, // object with post_content, or null.
	'can'        => true,
	'home'       => 'https://www.pacificprogroup.example',
	'uploads'    => sys_get_temp_dir() . '/ppgbh-uploads',
);

class WP_Error {
	public $code;
	public $message;
	public $data;
	public function __construct( $code = '', $message = '', $data = '' ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}
	public function get_error_message() {
		return $this->message;
	}
	public function get_error_code() {
		return $this->code;
	}
}

class WP_REST_Response {
	public $data;
	public $status;
	public $headers = array();
	public function __construct( $data = null, $status = 200 ) {
		$this->data   = $data;
		$this->status = $status;
	}
	public function header( $key, $value ) {
		$this->headers[ $key ] = $value;
	}
}

class WP_REST_Request {
	private $params;
	private $headers;
	public function __construct( $params = array(), $headers = array() ) {
		$this->params  = $params;
		$this->headers = array_change_key_case( $headers, CASE_LOWER );
	}
	public function get_param( $key ) {
		return isset( $this->params[ $key ] ) ? $this->params[ $key ] : null;
	}
	public function get_header( $key ) {
		$key = strtolower( $key );
		return isset( $this->headers[ $key ] ) ? $this->headers[ $key ] : null;
	}
}

function add_action( $hook, $callback, $priority = 10, $args = 1 ) {
	$GLOBALS['ppgbh_test']['filters'][ $hook ][] = $callback;
}
function add_filter( $hook, $callback, $priority = 10, $args = 1 ) {
	$GLOBALS['ppgbh_test']['filters'][ $hook ][] = $callback;
}
function apply_filters( $hook, $value ) {
	$args = func_get_args();
	array_shift( $args );
	if ( ! empty( $GLOBALS['ppgbh_test']['filters'][ $hook ] ) ) {
		foreach ( $GLOBALS['ppgbh_test']['filters'][ $hook ] as $cb ) {
			$args[0] = call_user_func_array( $cb, $args );
		}
	}
	return $args[0];
}
function register_activation_hook( $file, $callback ) {}
function add_shortcode( $tag, $callback ) {
	$GLOBALS['ppgbh_test']['shortcodes'][ $tag ] = $callback;
}
function shortcode_atts( $pairs, $atts, $shortcode = '' ) {
	$atts = (array) $atts;
	$out  = array();
	foreach ( $pairs as $name => $default ) {
		$out[ $name ] = array_key_exists( $name, $atts ) ? $atts[ $name ] : $default;
	}
	return $out;
}
function plugin_dir_path( $file ) {
	return rtrim( dirname( $file ), '/' ) . '/';
}
function plugin_basename( $file ) {
	return basename( dirname( $file ) ) . '/' . basename( $file );
}
function plugins_url( $path = '', $plugin = '' ) {
	return $GLOBALS['ppgbh_test']['home'] . '/wp-content/plugins/' . basename( dirname( $plugin ) ) . '/' . ltrim( $path, '/' );
}
function is_admin() {
	return $GLOBALS['ppgbh_test']['is_admin'];
}
function is_singular() {
	return $GLOBALS['ppgbh_test']['singular'];
}
function get_post() {
	return $GLOBALS['ppgbh_test']['post'];
}
// Like WordPress: the tag has to be registered, and it has to open a shortcode, not just appear as text.
function has_shortcode( $content, $tag ) {
	if ( false === strpos( $content, '[' ) || ! isset( $GLOBALS['ppgbh_test']['shortcodes'][ $tag ] ) ) {
		return false;
	}
	return 1 === preg_match( '/\\[' . preg_quote( $tag, '/' ) . '(?=[\\s\\]\\/])/', $content );
}
function current_user_can( $cap ) {
	return $GLOBALS['ppgbh_test']['can'];
}
function get_option( $name, $default = false ) {
	return array_key_exists( $name, $GLOBALS['ppgbh_test']['options'] ) ? $GLOBALS['ppgbh_test']['options'][ $name ] : $default;
}
function add_option( $name, $value = '', $deprecated = '', $autoload = 'yes' ) {
	if ( ! array_key_exists( $name, $GLOBALS['ppgbh_test']['options'] ) ) {
		$GLOBALS['ppgbh_test']['options'][ $name ] = $value;
	}
	return true;
}
function update_option( $name, $value ) {
	$GLOBALS['ppgbh_test']['options'][ $name ] = $value;
	return true;
}
function delete_option( $name ) {
	unset( $GLOBALS['ppgbh_test']['options'][ $name ] );
	return true;
}
function get_transient( $key ) {
	return isset( $GLOBALS['ppgbh_test']['transients'][ $key ] ) ? $GLOBALS['ppgbh_test']['transients'][ $key ] : false;
}
function set_transient( $key, $value, $ttl = 0 ) {
	$GLOBALS['ppgbh_test']['transients'][ $key ] = $value;
	return true;
}
function wp_salt( $scheme = 'auth' ) {
	return 'test-salt-' . $scheme;
}
function wp_upload_dir( $time = null, $create = true ) {
	return array(
		'basedir' => $GLOBALS['ppgbh_test']['uploads'],
		'baseurl' => $GLOBALS['ppgbh_test']['home'] . '/wp-content/uploads',
	);
}
function wp_mkdir_p( $dir ) {
	return is_dir( $dir ) || mkdir( $dir, 0777, true );
}
function trailingslashit( $s ) {
	return rtrim( $s, '/\\' ) . '/';
}
function set_url_scheme( $url, $scheme = null ) {
	return $url;
}
function home_url( $path = '' ) {
	return $GLOBALS['ppgbh_test']['home'] . $path;
}
function site_url( $path = '' ) {
	return $GLOBALS['ppgbh_test']['home'] . $path;
}
function admin_url( $path = '' ) {
	return $GLOBALS['ppgbh_test']['home'] . '/wp-admin/' . ltrim( $path, '/' );
}
function rest_url( $path = '' ) {
	return $GLOBALS['ppgbh_test']['home'] . '/wp-json/' . ltrim( $path, '/' );
}
function wp_parse_url( $url, $component = -1 ) {
	return parse_url( $url, $component );
}
function wp_unslash( $value ) {
	return is_string( $value ) ? stripslashes( $value ) : $value;
}
function wp_strip_all_tags( $text, $remove_breaks = false ) {
	$text = preg_replace( '@<(script|style)[^>]*?>.*?</\\1>@si', '', (string) $text );
	return trim( strip_tags( $text ) );
}
function sanitize_text_field( $str ) {
	$str = (string) $str;
	$str = preg_replace( '@<(script|style)[^>]*?>.*?</\\1>@si', '', $str );
	$str = preg_replace( '/<[^>]*>?/', '', $str );
	$str = preg_replace( '/[\r\n\t ]+/', ' ', $str );
	return trim( $str );
}
function sanitize_hex_color( $color ) {
	if ( '' === $color || null === $color ) {
		return '';
	}
	return preg_match( '|^#([A-Fa-f0-9]{3}){1,2}$|', $color ) ? $color : null;
}
function sanitize_email( $email ) {
	$email = trim( (string) $email );
	return preg_match( '/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/', $email ) ? $email : '';
}
function is_email( $email ) {
	return '' !== sanitize_email( $email ) ? $email : false;
}
function absint( $n ) {
	return abs( (int) $n );
}
function esc_url_raw( $url, $protocols = null ) {
	$url = trim( (string) $url );
	if ( '' === $url ) {
		return '';
	}
	$allowed = $protocols ? $protocols : array( 'http', 'https', 'mailto' );
	$scheme  = strtolower( (string) parse_url( $url, PHP_URL_SCHEME ) );
	if ( '' === $scheme && preg_match( '/^[a-z][a-z0-9+.-]*:/i', $url ) ) {
		return ''; // a scheme parse_url could not read (javascript:alert(1) and friends).
	}
	if ( '' !== $scheme && ! in_array( $scheme, $allowed, true ) ) {
		return '';
	}
	return str_replace( array( '"', "'", '<', '>', ' ' ), array( '%22', '%27', '%3C', '%3E', '%20' ), $url );
}
function esc_url( $url ) {
	return htmlspecialchars( esc_url_raw( $url ), ENT_QUOTES, 'UTF-8' );
}
// Like WordPress, these do not encode an & that already starts an entity (double_encode is false).
function esc_attr( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8', false );
}
function esc_html( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8', false );
}
function esc_textarea( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
}
function esc_html__( $text, $domain = 'default' ) {
	return esc_html( $text );
}
function __( $text, $domain = 'default' ) {
	return $text;
}
function wp_json_encode( $data, $options = 0, $depth = 512 ) {
	return json_encode( $data, $options, $depth );
}
function number_format_i18n( $n, $decimals = 0 ) {
	return number_format( (float) $n, $decimals );
}
function wp_register_script( $handle, $src, $deps = array(), $ver = false, $args = array() ) {
	$GLOBALS['ppgbh_test']['registered'][ $handle ] = array( 'src' => $src, 'ver' => $ver, 'args' => $args );
	return true;
}
function wp_script_is( $handle, $status = 'enqueued' ) {
	if ( 'registered' === $status ) {
		return isset( $GLOBALS['ppgbh_test']['registered'][ $handle ] );
	}
	return in_array( $handle, $GLOBALS['ppgbh_test']['enqueued'], true );
}
function wp_enqueue_script( $handle ) {
	$GLOBALS['ppgbh_test']['enqueued'][] = $handle;
}
function register_rest_route( $ns, $route, $args = array() ) {
	$GLOBALS['ppgbh_test']['routes'][ $ns . $route ] = $args;
	return true;
}
function add_query_arg( $args, $url ) {
	$pairs = array();
	foreach ( $args as $k => $v ) {
		$pairs[] = $k . '=' . $v; // like WordPress, values are not encoded here.
	}
	return $url . ( false === strpos( $url, '?' ) ? '?' : '&' ) . implode( '&', $pairs );
}
function wp_remote_get( $url, $args = array() ) {
	$GLOBALS['ppgbh_test']['remote_log'][] = array( 'url' => $url, 'args' => $args );
	return call_user_func( $GLOBALS['ppgbh_test']['remote'], $url, $args );
}
function is_wp_error( $thing ) {
	return $thing instanceof WP_Error;
}
function wp_remote_retrieve_response_code( $response ) {
	return is_array( $response ) && isset( $response['response']['code'] ) ? $response['response']['code'] : '';
}
function wp_remote_retrieve_body( $response ) {
	return is_array( $response ) && isset( $response['body'] ) ? $response['body'] : '';
}
function add_options_page( $title, $menu, $cap, $slug, $callback ) {
	return 'settings_page_' . $slug;
}
function register_setting( $group, $name, $args = array() ) {
	$GLOBALS['ppgbh_test']['settings'][ $name ] = $args;
}
function settings_fields( $group ) {
	echo '<input type="hidden" name="option_page" value="' . esc_attr( $group ) . '"><input type="hidden" name="_wpnonce" value="' . esc_attr( wp_create_nonce( $group . '-options' ) ) . '">';
}
function submit_button() {
	echo '<p class="submit"><input type="submit" class="button button-primary" value="Save Changes"></p>';
}
function checked( $checked, $current = true, $echo = true ) {
	$out = (string) $checked === (string) $current ? " checked='checked'" : '';
	if ( $echo ) {
		echo $out;
	}
	return $out;
}
function selected( $selected, $current = true, $echo = true ) {
	$out = (string) $selected === (string) $current ? " selected='selected'" : '';
	if ( $echo ) {
		echo $out;
	}
	return $out;
}
// As in WordPress, a nonce belongs to one action: the nonce of the settings form does not pass the connection test.
function wp_create_nonce( $action = -1 ) {
	return substr( md5( 'ppgbh-test-salt|' . $action ), 0, 10 );
}
function wp_nonce_url( $url, $action = -1 ) {
	return $url . ( false === strpos( $url, '?' ) ? '?' : '&' ) . '_wpnonce=' . wp_create_nonce( $action );
}
// WordPress stops the request here ("The link you followed has expired"). In a test that is an exception to catch.
class PPGBH_Test_Stopped extends Exception {}
function check_admin_referer( $action = -1 ) {
	$given = isset( $_REQUEST['_wpnonce'] ) ? (string) $_REQUEST['_wpnonce'] : '';
	if ( ! hash_equals( wp_create_nonce( $action ), $given ) ) {
		throw new PPGBH_Test_Stopped( 'nonce' );
	}
	return 1;
}
