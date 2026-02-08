import { writable } from 'svelte/store';
import type { WorkspaceFile, FileContent, FileWriteResponse } from '$lib/types';

export const files = writable<WorkspaceFile[]>([]);
export const currentPath = writable<string>('');
export const activeFile = writable<FileContent | null>(null);
export const activeFileName = writable<string>('');

export async function loadFiles(dir?: string): Promise<void> {
	const url = dir ? `/api/workspace/files?dir=${encodeURIComponent(dir)}` : '/api/workspace/files';
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(res.statusText);
	}
	const data = await res.json();
	files.set(data.files);
}

export async function loadFile(filePath: string): Promise<void> {
	const res = await fetch(`/api/workspace/files/${filePath}`);
	if (!res.ok) {
		throw new Error(res.statusText);
	}
	const data = await res.json();
	activeFile.set(data);
	activeFileName.set(filePath);
}

export async function saveFile(
	filePath: string,
	content: string,
	baseHash: string
): Promise<FileWriteResponse> {
	const res = await fetch(`/api/workspace/files/${filePath}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ content, baseHash })
	});
	if (res.status === 409) {
		throw new Error('File was modified by another process. Please reload and try again.');
	}
	if (!res.ok) {
		throw new Error(res.statusText);
	}
	return await res.json();
}

export async function deleteFile(filePath: string): Promise<void> {
	const res = await fetch(`/api/workspace/files/${filePath}`, {
		method: 'DELETE'
	});
	if (!res.ok) {
		throw new Error(res.statusText);
	}
}

export async function createFile(filePath: string, content: string): Promise<FileWriteResponse> {
	const res = await fetch(`/api/workspace/files/${filePath}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ content })
	});
	if (!res.ok) {
		throw new Error(res.statusText);
	}
	return await res.json();
}

export async function renameFile(filePath: string, newName: string): Promise<void> {
	const res = await fetch(`/api/workspace/files/${filePath}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ newName })
	});
	if (res.status === 409) {
		throw new Error('A file with that name already exists');
	}
	if (!res.ok) {
		throw new Error(res.statusText);
	}
}

export async function navigateTo(dir: string): Promise<void> {
	currentPath.set(dir);
	await loadFiles(dir);
}
