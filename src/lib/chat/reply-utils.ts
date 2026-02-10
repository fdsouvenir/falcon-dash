import type { ChatMessage } from '$lib/stores/chat.js';

/**
 * Find a referenced message by ID in a message list.
 * Used by ReplyPreview to show the correct referenced message.
 */
export function findReferencedMessage(
	messages: ChatMessage[],
	replyToMessageId: string
): ChatMessage | undefined {
	return messages.find((m) => m.id === replyToMessageId);
}

/**
 * Extract a compact preview from a message for reply display.
 */
export function getReplyPreviewText(message: ChatMessage, maxLength = 100): string {
	const text = message.content.trim();
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength) + '...';
}

/**
 * Check if a message is a reply to another message.
 */
export function isReply(message: ChatMessage): boolean {
	return !!message.replyToMessageId;
}
