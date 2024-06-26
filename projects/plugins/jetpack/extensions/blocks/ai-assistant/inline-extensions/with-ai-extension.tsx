/*
 * External dependencies
 */
import {
	ERROR_NETWORK,
	ERROR_QUOTA_EXCEEDED,
	useAiSuggestions,
} from '@automattic/jetpack-ai-client';
import { BlockControls, useBlockProps } from '@wordpress/block-editor';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useDispatch, useSelect } from '@wordpress/data';
import { useCallback, useEffect, useState, useRef, useMemo } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import debugFactory from 'debug';
import React from 'react';
/*
 * Internal dependencies
 */
import useAiFeature from '../hooks/use-ai-feature';
import { mapInternalPromptTypeToBackendPromptType } from '../lib/prompt/backend-prompt';
import AiAssistantInput from './components/ai-assistant-input';
import AiAssistantExtensionToolbarDropdown from './components/ai-assistant-toolbar-dropdown';
import { getBlockHandler } from './get-block-handler';
import { isPossibleToExtendBlock } from './lib/is-possible-to-extend-block';
/*
 * Types
 */
import type {
	AiAssistantDropdownOnChangeOptionsArgProps,
	OnRequestSuggestion,
} from '../components/ai-assistant-toolbar-dropdown/dropdown-content';
import type { ExtendedInlineBlockProp } from '../extensions/ai-assistant';
import type { PromptTypeProp } from '../lib/prompt';

const debug = debugFactory( 'jetpack-ai-assistant:extensions:with-ai-extension' );

const blockExtensionMapper = {
	'core/heading': 'heading',
};

// Defines where the block controls should be placed in the toolbar
const blockControlsProps = {
	group: 'block' as const,
};

const BLOCK_INPUT_GAP = 16;

type RequestOptions = {
	promptType: PromptTypeProp;
	options?: AiAssistantDropdownOnChangeOptionsArgProps;
	humanText?: string;
};

type CoreEditorDispatch = { undo: () => Promise< void > };
type CoreEditorSelect = { getCurrentPostId: () => number };

// HOC to populate the block's edit component with the AI Assistant control inpuit and toolbar button.
const blockEditWithAiComponents = createHigherOrderComponent( BlockEdit => {
	return props => {
		const { clientId, isSelected, name: blockName } = props;
		// Ref to the control wrapper, its height and its ResizeObserver, for positioning adjustments.
		const controlRef: React.MutableRefObject< HTMLDivElement | null > = useRef( null );
		const controlHeight = useRef< number >( 0 );
		const controlObserver = useRef< ResizeObserver | null >( null );
		// Ref to the original block padding to reset it when the AI Control is closed.
		const blockOriginalPaddingBottom = useRef< string >( '' );
		// Ref to the input element to focus on it when the AI Control is displayed or when a request is done.
		// Also used to determine the ownerDocument, as the editor can be in an iframe.
		const inputRef: React.MutableRefObject< HTMLInputElement | null > = useRef( null );
		const ownerDocument = useRef< Document >( document );
		// A human-readable action to be displayed in the input when a toolbar suggestion is requested, like "Translate: Japanese".
		const [ action, setAction ] = useState< string >( '' );
		// The last request made by the user, to be used when the user clicks the "Try Again" button.
		const [ lastRequest, setLastRequest ] = useState< RequestOptions | null >( null );
		// State to display the AI Control or not.
		const [ showAiControl, setShowAiControl ] = useState( false );
		// Data and functions from the editor.
		const { undo } = useDispatch( 'core/editor' ) as CoreEditorDispatch;
		const { postId } = useSelect( select => {
			const { getCurrentPostId } = select( 'core/editor' ) as CoreEditorSelect;

			return { postId: getCurrentPostId() };
		}, [] );
		// The block's id to find it in the DOM for the positioning adjustments.
		const { id } = useBlockProps();
		// Jetpack AI Assistant feature functions.
		const { increaseRequestsCount, dequeueAsyncRequest, requireUpgrade } = useAiFeature();

		// Data and functions with block-specific implementations.
		const {
			onSuggestion: onBlockSuggestion,
			onDone: onBlockDone,
			getContent,
		} = useMemo( () => getBlockHandler( blockName, clientId ), [ blockName, clientId ] );

		// Called when the user clicks the "Ask AI Assistant" button.
		const handleAskAiAssistant = useCallback( () => {
			setShowAiControl( true );
		}, [] );

		// Function to get the messages array for the request.
		const getRequestMessages = useCallback(
			( {
				promptType,
				options,
			}: {
				promptType: PromptTypeProp;
				options?: AiAssistantDropdownOnChangeOptionsArgProps;
			} ) => {
				const blockContent = getContent();

				const extension = blockExtensionMapper[ blockName ];

				return [
					{
						role: 'jetpack-ai' as const,
						context: {
							type: mapInternalPromptTypeToBackendPromptType( promptType, extension ),
							content: blockContent,
							request: options?.userPrompt,
							tone: options?.tone,
							language: options?.language,
						},
					},
				];
			},
			[ blockName, getContent ]
		);

		const adjustBlockPadding = useCallback(
			( blockElement?: HTMLElement | null ) => {
				const block = blockElement || ownerDocument.current.getElementById( id );

				if ( block && controlRef.current ) {
					// The gap between the input and the block's bottom is set at BLOCK_INPUT_GAP, regardless of the theme
					block.style.setProperty(
						'padding-bottom',
						`calc(${ controlHeight.current + BLOCK_INPUT_GAP }px + ${
							blockOriginalPaddingBottom.current || '0px'
						} )`,
						'important'
					);
				}
			},
			[ id ]
		);

		// Called when a suggestion chunk is received.
		const onSuggestion = useCallback(
			( suggestion: string ) => {
				onBlockSuggestion( suggestion );

				// Make sure the block element has the necessary bottom padding, as it can be replaced or changed
				adjustBlockPadding();
			},
			[ onBlockSuggestion, adjustBlockPadding ]
		);

		// Called after the last suggestion chunk is received.
		const onDone = useCallback( () => {
			onBlockDone();
			increaseRequestsCount();
			setAction( '' );
			setLastRequest( null );

			// Make sure the block element has the necessary bottom padding, as it can be replaced or changed
			setTimeout( () => {
				adjustBlockPadding();
				inputRef.current?.focus();
			}, 100 );
		}, [ onBlockDone, increaseRequestsCount, adjustBlockPadding ] );

		// Called when an error is received.
		const onError = useCallback(
			error => {
				setAction( '' );

				debug( 'Request error', error );

				// Increase the AI Suggestion counter only for valid errors.
				if ( error.code === ERROR_NETWORK || error.code === ERROR_QUOTA_EXCEEDED ) {
					return;
				}

				increaseRequestsCount();
			},
			[ increaseRequestsCount ]
		);

		const {
			request,
			stopSuggestion,
			requestingState,
			error,
			reset: resetSuggestions,
		} = useAiSuggestions( {
			onSuggestion,
			onDone,
			onError,
			askQuestionOptions: {
				postId,
				feature: 'ai-assistant',
			},
		} );

		// Called when a suggestion from the toolbar is requested, like "Change tone".
		const handleRequestSuggestion = useCallback< OnRequestSuggestion >(
			( promptType, options, humanText ) => {
				setShowAiControl( true );

				// If the user needs to upgrade, don't make the request, but show the input with the upgrade message.
				if ( requireUpgrade ) {
					return;
				}

				if ( humanText ) {
					setAction( humanText );
				}

				const messages = getRequestMessages( { promptType, options } );

				debug( 'Request suggestion', promptType, options );

				setLastRequest( { promptType, options, humanText } );

				/*
				 * Always dequeue/cancel the AI Assistant feature async request,
				 * in case there is one pending,
				 * when performing a new AI suggestion request.
				 */
				dequeueAsyncRequest();

				request( messages );
			},
			[ dequeueAsyncRequest, getRequestMessages, request, requireUpgrade ]
		);

		// Called when the user types a custom prompt.
		const handleUserRequest = useCallback(
			( userPrompt: string ) => {
				const promptType = 'userPrompt';
				const options = { userPrompt };

				handleRequestSuggestion( promptType, options );
			},
			[ handleRequestSuggestion ]
		);

		// Called when the user clicks the "Stop" button in the input.
		const handleStopSuggestion = useCallback( () => {
			stopSuggestion();

			inputRef.current?.focus();
		}, [ stopSuggestion ] );

		// Called when the user clicks the "Try Again" button in the input error message.
		const handleTryAgain = useCallback( () => {
			if ( lastRequest ) {
				handleRequestSuggestion(
					lastRequest.promptType,
					lastRequest.options,
					lastRequest.humanText
				);
			}
		}, [ lastRequest, handleRequestSuggestion ] );

		// Cleanup function.
		const handleClose = useCallback( () => {
			setShowAiControl( false );
			resetSuggestions();
			setAction( '' );
			setLastRequest( null );
		}, [ resetSuggestions ] );

		// Called when the user clicks the "Undo" button after a successful request.
		const handleUndo = useCallback( async () => {
			await undo();

			handleClose();
		}, [ undo, handleClose ] );

		// Closes the AI Control if the block is deselected.
		useEffect( () => {
			if ( ! isSelected ) {
				handleClose();
			}
		}, [ isSelected, handleClose ] );

		// Focus the input when the AI Control is displayed and set the ownerDocument.
		useEffect( () => {
			if ( inputRef.current ) {
				// Save the block's ownerDocument to use it later, as the editor can be in an iframe.
				ownerDocument.current = inputRef.current.ownerDocument;
				// Focus the input when the AI Control is displayed.
				inputRef.current.focus();
			}
		}, [ showAiControl ] );

		// Adjusts the input position in the editor by increasing the block's bottom-padding
		// and setting the control's margin-top, "wrapping" the input with the block.
		useEffect( () => {
			let block = ownerDocument.current.getElementById( id );

			if ( ! block ) {
				return;
			}

			// Once when the AI Control is displayed
			if ( showAiControl && ! controlObserver.current && controlRef.current ) {
				// Save the block bottom padding to reset it later.
				blockOriginalPaddingBottom.current = block.style.paddingBottom;

				// Observe the control's height to adjust the block's bottom padding.
				controlObserver.current = new ResizeObserver( ( [ entry ] ) => {
					// The block element can be replaced or changed, so we need to get it again.
					block = ownerDocument.current.getElementById( id );
					controlHeight.current = entry.contentRect.height;

					if ( block && controlRef.current && controlHeight.current > 0 ) {
						adjustBlockPadding( block );

						const { marginBottom } = getComputedStyle( block );
						const bottom = parseFloat( marginBottom );

						// The control's margin-top is the negative of the control's height plus the block's bottom margin, to end up with the intended gap.
						// P2 uses "!important", so we need to add it to override the theme's styles.
						controlRef.current.style.setProperty(
							'margin-top',
							`-${ controlHeight.current + bottom }px`,
							'important'
						);

						// The control's bottom margin is set to at least the same value as the block's bottom margin, to keep the distance to the next block.
						// The gap height is added for a bit more space on themes with a smaller bottom margin.
						controlRef.current.style.setProperty(
							'margin-bottom',
							`${ bottom + BLOCK_INPUT_GAP }px`,
							'important'
						);
					}
				} );

				controlObserver.current.observe( controlRef.current );
			} else if ( controlObserver.current ) {
				block.style.paddingBottom = blockOriginalPaddingBottom.current;

				controlObserver.current.disconnect();
				controlObserver.current = null;
				controlHeight.current = 0;
			}

			return () => {
				if ( controlObserver.current ) {
					controlObserver.current.disconnect();
				}
			};
		}, [ adjustBlockPadding, clientId, controlObserver, id, showAiControl ] );

		return (
			<>
				<BlockEdit { ...props } />

				{ showAiControl && (
					<AiAssistantInput
						requestingState={ requestingState }
						requestingError={ error }
						wrapperRef={ controlRef }
						inputRef={ inputRef }
						action={ action }
						blockType={ blockName }
						request={ handleUserRequest }
						stopSuggestion={ handleStopSuggestion }
						close={ handleClose }
						undo={ handleUndo }
						tryAgain={ handleTryAgain }
					/>
				) }

				<BlockControls { ...blockControlsProps }>
					<AiAssistantExtensionToolbarDropdown
						blockType={ blockName }
						onAskAiAssistant={ handleAskAiAssistant }
						onRequestSuggestion={ handleRequestSuggestion }
					/>
				</BlockControls>
			</>
		);
	};
}, 'blockEditWithAiComponents' );

/**
 * Function used to extend the registerBlockType settings.
 * Populates the block edit component with the AI Assistant bar and button.
 * @param {object} settings - The block settings.
 * @param {string} name     - The block name.
 * @returns {object}          The extended block settings.
 */
function blockWithInlineExtension( settings, name: ExtendedInlineBlockProp ) {
	// Only extend the allowed block types and when AI is enabled
	const possibleToExtendBlock = isPossibleToExtendBlock( name );

	if ( ! possibleToExtendBlock ) {
		return settings;
	}

	return {
		...settings,
		edit: blockEditWithAiComponents( settings.edit ),
	};
}

addFilter(
	'blocks.registerBlockType',
	'jetpack/ai-assistant-support/with-ai-extension',
	blockWithInlineExtension,
	100
);
