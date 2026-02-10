import { writable, readonly, derived, get, type Readable, type Writable } from 'svelte/store';

export interface FileEntry {
	name: string;
	type: 'file' | 'directory';
	path: string;
	size: number;
	modified: number;
	extension?: string;
}

export type SortField = 'name' | 'modified' | 'size';
export type SortDirection = 'asc' | 'desc';

const _entries: Writable<FileEntry[]> = writable([]);
const _currentPath: Writable<string> = writable('');
const _isLoading: Writable<boolean> = writable(false);
const _error: Writable<string | null> = writable(null);
const _sortField: Writable<SortField> = writable('name');
const _sortDirection: Writable<SortDirection> = writable('asc');
const _searchQuery: Writable<string> = writable('');

export const currentPath: Readable<string> = readonly(_currentPath);
export const isLoading: Readable<boolean> = readonly(_isLoading);
export const fileError: Readable<string | null> = readonly(_error);
export const sortField: Readable<SortField> = readonly(_sortField);
export const sortDirection: Readable<SortDirection> = readonly(_sortDirection);
export const fileSearchQuery = _searchQuery;

export const sortedEntries: Readable<FileEntry[]> = derived(
	[_entries, _sortField, _sortDirection, _searchQuery],
	([$entries, $field, $dir, $query]) => {
		let list = $entries;
		if ($query.trim()) {
			const q = $query.toLowerCase();
			list = list.filter((e) => e.name.toLowerCase().includes(q));
		}
		return [...list].sort((a, b) => {
			// Directories first
			if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
			let cmp = 0;
			if ($field === 'name') cmp = a.name.localeCompare(b.name);
			else if ($field === 'modified') cmp = a.modified - b.modified;
			else if ($field === 'size') cmp = a.size - b.size;
			return $dir === 'asc' ? cmp : -cmp;
		});
	}
);

export const breadcrumbs: Readable<Array<{ name: string; path: string }>> = derived(
	_currentPath,
	($path) => {
		const parts = $path.split('/').filter(Boolean);
		const crumbs = [{ name: 'Documents', path: '' }];
		let accumulated = '';
		for (const part of parts) {
			accumulated = accumulated ? `${accumulated}/${part}` : part;
			crumbs.push({ name: part, path: accumulated });
		}
		return crumbs;
	}
);

export async function loadDirectory(path = ''): Promise<void> {
	_isLoading.set(true);
	_error.set(null);
	_currentPath.set(path);
	try {
		const url = path ? `/api/files/${encodeURIComponent(path)}` : '/api/files/';
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Failed to load: ${res.statusText}`);
		const data = await res.json();
		_entries.set(data.entries ?? []);
	} catch (err) {
		_error.set((err as Error).message);
		_entries.set([]);
	} finally {
		_isLoading.set(false);
	}
}

export function setSortField(field: SortField): void {
	_sortField.update((current) => {
		if (current === field) {
			_sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			_sortDirection.set('asc');
		}
		return field;
	});
}

export function navigateUp(): void {
	let path = '';
	_currentPath.subscribe((p) => {
		path = p;
	})();
	const parts = path.split('/').filter(Boolean);
	parts.pop();
	loadDirectory(parts.join('/'));
}

export async function createFile(name: string, content = ''): Promise<boolean> {
	const path = get(_currentPath);
	const filePath = path ? `${path}/${name}` : name;
	try {
		const res = await fetch(`/api/files/${encodeURIComponent(filePath)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'file', content })
		});
		if (!res.ok) throw new Error((await res.json()).message ?? res.statusText);
		await loadDirectory(path);
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function createFolder(name: string): Promise<boolean> {
	const path = get(_currentPath);
	const folderPath = path ? `${path}/${name}` : name;
	try {
		const res = await fetch(`/api/files/${encodeURIComponent(folderPath)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'directory' })
		});
		if (!res.ok) throw new Error((await res.json()).message ?? res.statusText);
		await loadDirectory(path);
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function deleteEntry(entryPath: string): Promise<boolean> {
	try {
		const res = await fetch(`/api/files/${encodeURIComponent(entryPath)}`, {
			method: 'DELETE'
		});
		if (!res.ok) throw new Error((await res.json()).message ?? res.statusText);
		const path = get(_currentPath);
		await loadDirectory(path);
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function renameEntry(entryPath: string, newName: string): Promise<boolean> {
	try {
		const res = await fetch(`/api/files/${encodeURIComponent(entryPath)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ newName })
		});
		if (!res.ok) throw new Error((await res.json()).message ?? res.statusText);
		const path = get(_currentPath);
		await loadDirectory(path);
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function uploadFile(file: File): Promise<boolean> {
	const path = get(_currentPath);
	const filePath = path ? `${path}/${file.name}` : file.name;
	try {
		const content = await file.text();
		const res = await fetch(`/api/files/${encodeURIComponent(filePath)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'file', content })
		});
		if (res.status === 409) {
			// File exists, overwrite with PUT using empty baseHash trick
			const putRes = await fetch(`/api/files/${encodeURIComponent(filePath)}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/octet-stream',
					'X-Base-Hash': '' // new file
				},
				body: content
			});
			if (!putRes.ok) throw new Error('Upload failed: file already exists');
		} else if (!res.ok) {
			throw new Error((await res.json()).message ?? res.statusText);
		}
		await loadDirectory(path);
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}
