import { describe, it, expect, vi } from 'vitest';
import { findReferencedMessage, getReplyPreviewText, isReply } from './reply-utils.js';
import type { ChatMessage } from '$lib/stores/chat.js';

vi.mock('$lib/stores/chat.js', () => ({}));

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
	return {
		id: 'msg-1',
		role: 'user',
		content: 'Hello',
		timestamp: Date.now(),
		status: 'complete',
		...overrides
	};
}

describe('findReferencedMessage', () => {
	it('finds message by ID', () => {
		const messages = [
			makeMessage({ id: 'msg-1', content: 'First' }),
			makeMessage({ id: 'msg-2', content: 'Second' }),
			makeMessage({ id: 'msg-3', content: 'Third' })
		];

		const result = findReferencedMessage(messages, 'msg-2');
		expect(result).toBeDefined();
		expect(result?.id).toBe('msg-2');
		expect(result?.content).toBe('Second');
	});

	it('returns undefined when not found', () => {
		const messages = [makeMessage({ id: 'msg-1' }), makeMessage({ id: 'msg-2' })];

		const result = findReferencedMessage(messages, 'msg-999');
		expect(result).toBeUndefined();
	});
});

describe('getReplyPreviewText', () => {
	it('returns full text when short', () => {
		const message = makeMessage({ content: 'Short message' });
		const result = getReplyPreviewText(message);
		expect(result).toBe('Short message');
	});

	it('truncates long text with ellipsis', () => {
		const longText = 'a'.repeat(150);
		const message = makeMessage({ content: longText });
		const result = getReplyPreviewText(message, 100);
		expect(result).toHaveLength(103); // 100 chars + '...'
		expect(result.endsWith('...')).toBe(true);
	});

	it('trims whitespace', () => {
		const message = makeMessage({ content: '  Hello world  ' });
		const result = getReplyPreviewText(message);
		expect(result).toBe('Hello world');
	});
});

describe('isReply', () => {
	it('returns true when replyToMessageId is set', () => {
		const message = makeMessage({ replyToMessageId: 'msg-999' });
		expect(isReply(message)).toBe(true);
	});

	it('returns false when replyToMessageId is undefined', () => {
		const message = makeMessage({ replyToMessageId: undefined });
		expect(isReply(message)).toBe(false);
	});
});
