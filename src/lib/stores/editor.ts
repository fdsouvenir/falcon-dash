import { writable, readonly, derived, type Readable, type Writable } from 'svelte/store';

export interface EditorState {
	filePath: string;
	fileName: string;
	content: string;
	originalContent: string;
	baseHash: string;
	isLoading: boolean;
	isSaving: boolean;
	error: string | null;
	fileType: 'markdown' | 'code' | 'image' | 'json' | 'text';
}

const _editor: Writable<EditorState | null> = writable(null);

export const editor: Readable<EditorState | null> = readonly(_editor);

export const hasUnsavedChanges: Readable<boolean> = derived(_editor, ($e) => {
	if (!$e) return false;
	return $e.content !== $e.originalContent;
});

export const currentFileType: Readable<string> = derived(_editor, ($e) => $e?.fileType ?? 'text');

function detectFileType(name: string): EditorState['fileType'] {
	const ext = name.split('.').pop()?.toLowerCase() ?? '';
	if (['md', 'mdx'].includes(ext)) return 'markdown';
	if (['json'].includes(ext)) return 'json';
	if (
		[
			'ts',
			'js',
			'py',
			'go',
			'rs',
			'svelte',
			'vue',
			'html',
			'css',
			'yaml',
			'yml',
			'toml',
			'sh',
			'bash'
		].includes(ext)
	)
		return 'code';
	if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
	return 'text';
}

export async function openFile(filePath: string): Promise<void> {
	const fileName = filePath.split('/').pop() ?? filePath;
	const fileType = detectFileType(fileName);

	_editor.set({
		filePath,
		fileName,
		content: '',
		originalContent: '',
		baseHash: '',
		isLoading: true,
		isSaving: false,
		error: null,
		fileType
	});

	try {
		const res = await fetch(`/api/files/${encodeURIComponent(filePath)}`);
		if (!res.ok) throw new Error(`Failed to load: ${res.statusText}`);

		const hash = res.headers.get('X-File-Hash') ?? '';

		if (fileType === 'image') {
			// For images, store the URL instead of content
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			_editor.update((e) =>
				e ? { ...e, content: url, originalContent: url, baseHash: hash, isLoading: false } : null
			);
		} else {
			const text = await res.text();
			_editor.update((e) =>
				e ? { ...e, content: text, originalContent: text, baseHash: hash, isLoading: false } : null
			);
		}
	} catch (err) {
		_editor.update((e) => (e ? { ...e, isLoading: false, error: (err as Error).message } : null));
	}
}

export function updateContent(content: string): void {
	_editor.update((e) => (e ? { ...e, content } : null));
}

export async function saveFile(): Promise<boolean> {
	let currentState: EditorState | null = null;
	const unsubscribe = _editor.subscribe((e) => {
		currentState = e;
	});
	unsubscribe();
	if (!currentState) return false;

	const state: EditorState = currentState;

	_editor.update((e) => (e ? { ...e, isSaving: true, error: null } : null));

	try {
		const res = await fetch(`/api/files/${encodeURIComponent(state.filePath)}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/octet-stream',
				'X-Base-Hash': state.baseHash
			},
			body: state.content
		});

		if (res.status === 409) {
			_editor.update((e) =>
				e
					? {
							...e,
							isSaving: false,
							error: 'File was modified externally. Reload to get latest version.'
						}
					: null
			);
			return false;
		}

		if (!res.ok) throw new Error(`Save failed: ${res.statusText}`);

		const result = await res.json();
		_editor.update((e) =>
			e ? { ...e, originalContent: e.content, baseHash: result.hash, isSaving: false } : null
		);
		return true;
	} catch (err) {
		_editor.update((e) => (e ? { ...e, isSaving: false, error: (err as Error).message } : null));
		return false;
	}
}

export function closeFile(): void {
	_editor.set(null);
}
