<?php
/**
 * Template used to display arguments used to build the carousel modal.
 *
 * @package automattic/jetpack
 */

// phpcs:disable VariableAnalysis.CodeAnalysis.VariableAnalysis.UndefinedVariable -- Defined by the caller. Let Phan handle it.
'@phan-var-force Jetpack_Tiled_Gallery_Layout $this';
'@phan-var-force array $context';

$item             = $context['item'];
$fuzzy_image_meta = $item->fuzzy_image_meta(); // See https://github.com/Automattic/jetpack/issues/2765 .
if ( isset( $fuzzy_image_meta['keywords'] ) ) {
	unset( $fuzzy_image_meta['keywords'] );
}

// Using JSON_HEX_AMP avoids breakage due to `esc_attr()` refusing to double-encode.
$fuzzy_image_meta = wp_json_encode( map_deep( $fuzzy_image_meta, 'strval' ), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );

?>
data-attachment-id="<?php echo esc_attr( $item->image->ID ); ?>"
data-orig-file="<?php echo esc_url( wp_get_attachment_url( $item->image->ID ) ); ?>"
data-orig-size="<?php echo esc_attr( $item->meta_width() ); ?>,<?php echo esc_attr( $item->meta_height() ); ?>"
data-comments-opened="<?php echo esc_attr( comments_open( $item->image->ID ) ); ?>"
data-image-meta="<?php echo esc_attr( $fuzzy_image_meta ); ?>"
<?php // The two lines below use `esc_attr( htmlspecialchars( ) )` because esc_attr tries to be too smart and won't double-encode, and we need that here. ?>
data-image-title="<?php echo esc_attr( htmlspecialchars( wptexturize( $item->image->post_title ), ENT_COMPAT ) ); ?>"
data-image-description="<?php echo esc_attr( htmlspecialchars( wpautop( wptexturize( $item->image->post_content ) ), ENT_COMPAT ) ); ?>"
data-medium-file="<?php echo esc_url( $item->medium_file() ); ?>"
data-large-file="<?php echo esc_url( $item->large_file() ); ?>"
