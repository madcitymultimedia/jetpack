<?php
/**
 * Handle the VideoPress metadata properties.
 *
 * @package Jetpack
 */

use Automattic\Jetpack\Connection\Client;

/**
 * Class Videopress_Attachment_Metadata
 */
class Videopress_Attachment_Metadata {

	/**
	 * Persist the VideoPress metadata information, including rating and display_embed.
	 *
	 * @param string|int $post_id       The post id.
	 * @param string     $post_title    The post title.
	 * @param string     $caption       Video caption.
	 * @param string     $post_excerpt  The post excerpt.
	 * @param string     $rating        The rating.
	 * @param int        $display_embed The display_embed.
	 *
	 * @return bool|WP_Error
	 */
	public static function persist_metadata( $post_id, $post_title, $caption, $post_excerpt, $rating, $display_embed ) {
		$meta = wp_get_attachment_metadata( $post_id );

		$post_id = absint( $post_id );

		// If this has not been processed by videopress, we can skip the rest.
		if ( ! is_videopress_attachment( $post_id ) ) {
			return new WP_Error(
				400,
				__( 'The media you are trying to update is not processed by VideoPress.', 'jetpack' )
			);
		}

		$values = array();

		// Add the video title & description in, so that we save it properly.
		if ( isset( $post_title ) ) {
			$values['title'] = trim( wp_strip_all_tags( $post_title ) );
		}

		if ( isset( $caption ) ) {
			$values['caption'] = $caption;
		}

		if ( isset( $post_excerpt ) ) {
			$values['description'] = trim( wp_strip_all_tags( $post_excerpt ) );
		}

		if ( isset( $rating ) && videopress_is_valid_video_rating( $rating ) ) {
			$values['rating'] = $rating;
		}

		if ( isset( $display_embed ) ) {
			$display_embed = absint( $display_embed );
		}

		if ( self::is_display_embed_valid( $display_embed ) ) {
			$values['display_embed'] = $display_embed;
		}

		$args = array(
			'method' => 'POST',
		);

		$guid = get_post_meta( $post_id, 'videopress_guid', true );

		$endpoint = "videos/{$guid}";
		$result   = Client::wpcom_json_api_request_as_blog( $endpoint, Client::WPCOM_JSON_API_VERSION, $args, $values );

		if ( is_wp_error( $result ) ) {
			$error_message = __(
				'There was an issue saving your updates to the VideoPress service. Please try again later.',
				'jetpack'
			);

			return new \WP_Error( $result->get_error_code(), $error_message );
		}

		if ( isset( $values['display_embed'] ) ) {
			$meta['videopress']['display_embed'] = $values['display_embed'];
		}

		if ( isset( $values['rating'] ) ) {
			$meta['videopress']['rating'] = $values['rating'];
		}

		wp_update_attachment_metadata( $post_id, $meta );

		return true;
	}

	/**
	 * Check if display_embed has valid values.
	 *
	 * @param null|int $display_embed The input display embed.
	 *
	 * @return bool
	 */
	private static function is_display_embed_valid( $display_embed ) {
		return ( 0 === $display_embed || 1 === $display_embed );
	}
}
