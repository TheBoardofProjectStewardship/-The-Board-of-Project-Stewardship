<?php
/**
 * Removes the plugin's settings when the plugin is deleted.
 * The data files in wp-content/uploads/ppg-build-here/ are left in place: they are large, and they are yours.
 *
 * @package PPG_Build_Here
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'ppgbh_options' );
