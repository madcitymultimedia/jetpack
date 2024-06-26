<?php
/**
 * Inline Help FAB icon template.
 *
 * @package automattic/jetpack
 */

// phpcs:disable VariableAnalysis.CodeAnalysis.VariableAnalysis.UndefinedVariable -- Defined by the caller. Let Phan handle it.
'@phan-var-force array{href:string,icon:string,svg_allowed:array} $args';

?>

<div class="a8c-faux-inline-help">
	<a class="a8c-faux-inline-help__button" href="<?php echo esc_url( $args['href'] ); ?>" target="_blank" rel="noopener noreferrer" title="<?php echo esc_attr__( 'Help', 'jetpack' ); ?>">
		<?php echo wp_kses( $args['icon'], $args['svg_allowed'] ); ?>
	</a>
</div>
