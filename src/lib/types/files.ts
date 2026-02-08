export interface WorkspaceFile {
	name: string;
	isDirectory: boolean;
	size: number;
	mtime: string;
}

export interface FileContent {
	content: string;
	hash: string;
	mtime: string;
}

export interface FileWriteRequest {
	content: string;
	baseHash?: string;
}

export interface FileWriteResponse {
	hash: string;
	ok: boolean;
}
