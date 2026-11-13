<?php
/**
 * Plugin Name:       PPG Build Here
 * Description:       Address-based lot feasibility study for Pacific Pro Group. Add it to a page with the shortcode [ppg_build_here].
 * Version:           1.0.1
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Pacific Pro Group
 * Text Domain:       ppg-build-here
 *
 * The tool itself is one script, assets/js/ppg-build-here.js. It is built from the Build Here
 * source files by wordpress/build.py in the source tree and is not edited by hand.
 *
 * @package PPG_Build_Here
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PPGBH_VERSION', '1.0.1' );
define( 'PPGBH_FILE', __FILE__ );
define( 'PPGBH_DIR', plugin_dir_path( __FILE__ ) );
define( 'PPGBH_OPTION', 'ppgbh_options' );

require_once PPGBH_DIR . 'includes/class-ppgbh-options.php';
require_once PPGBH_DIR . 'includes/class-ppgbh-shortcode.php';
require_once PPGBH_DIR . 'includes/class-ppgbh-rest.php';
require_once PPGBH_DIR . 'includes/class-ppgbh-settings.php';

add_action( 'init', array( 'PPGBH_Shortcode', 'register' ) );
add_action( 'wp_enqueue_scripts', array( 'PPGBH_Shortcode', 'enqueue_for_page' ) );
add_action( 'rest_api_init', array( 'PPGBH_Rest', 'register' ) );

if ( is_admin() ) {
	add_action( 'admin_menu', array( 'PPGBH_Settings', 'menu' ) );
	add_action( 'admin_init', array( 'PPGBH_Settings', 'register' ) );
	add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), array( 'PPGBH_Settings', 'action_link' ) );
}

register_activation_hook( __FILE__, array( 'PPGBH_Options', 'activate' ) );
