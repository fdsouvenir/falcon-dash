import * as fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DomainError, requireValue } from '../work/store.mjs';

const { O_RDONLY, O_DIRECTORY, O_NOFOLLOW, O_WRONLY, O_CREAT, O_EXCL } = fs.constants;
const forbidden =
	/(^\.|credential|secret|password|token|vault|auth|\.kdbx$|\.key$|\.pem$|\.p12$|\.sqlite|\.db$)/i;
const extensions = new Set([
	'.md',
	'.txt',
	'.csv',
	'.svg',
	'.html',
	'.css',
	'.js',
	'.ts',
	'.json',
	'.yaml',
	'.yml'
]);
const hash = (value) => createHash('sha256').update(value).digest('hex');
export class Documents {
	constructor(roots) {
		this.roots = new Map();
		for (const root of roots) {
			requireValue(
				path.isAbsolute(root.path) && Array.isArray(root.actors) && root.actors.length,
				'invalid_config',
				'Documents roots need an absolute path and explicit actors'
			);
			const real = fs.realpathSync(root.path);
			requireValue(
				real === root.path && !real.split(path.sep).includes('.openclaw'),
				'unsafe_root',
				'Use a dedicated authorized documents workspace, never OpenClaw state'
			);
			const fd = fs.openSync(real, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
			this.roots.set(root.id, { ...root, fd });
		}
	}
	close() {
		for (const root of this.roots.values()) fs.closeSync(root.fd);
		this.roots.clear();
	}
	root(id, actor, write = false) {
		const r = this.roots.get(id);
		requireValue(
			r && r.actors.includes(actor) && (!write || r.writable === true),
			'access_denied',
			'Workspace access is not authorized'
		);
		return r;
	}
	parts(value, empty = false) {
		requireValue(
			typeof value === 'string' &&
				value.length <= 1000 &&
				!value.includes('\\') &&
				!value.includes('\0') &&
				!path.isAbsolute(value),
			'unsafe_path',
			'Use a workspace-relative path'
		);
		const parts = value.split('/');
		if (empty && value === '') return [];
		requireValue(
			parts.every((p) => p && p !== '.' && p !== '..' && !forbidden.test(p)),
			'protected_path',
			'Path is not available in Documents'
		);
		return parts;
	}
	parent(root, parts) {
		let fd = fs.openSync(`/proc/self/fd/${root.fd}`, O_RDONLY | O_DIRECTORY);
		try {
			for (const p of parts) {
				const next = fs.openSync(`/proc/self/fd/${fd}/${p}`, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
				fs.closeSync(fd);
				fd = next;
			}
			return fd;
		} catch {
			fs.closeSync(fd);
			throw new DomainError('unsafe_path', 'Directory is unavailable or is a symbolic link');
		}
	}
	file(root, relative, callback) {
		const parts = this.parts(relative);
		requireValue(
			extensions.has(path.extname(parts.at(-1)).toLowerCase()),
			'unsupported_file',
			'This file type is not available'
		);
		const dir = this.parent(root, parts.slice(0, -1));
		try {
			return callback(`/proc/self/fd/${dir}/${parts.at(-1)}`, dir, parts.at(-1));
		} finally {
			fs.closeSync(dir);
		}
	}
	readBytes(file) {
		let fd;
		try {
			fd = fs.openSync(file, O_RDONLY | O_NOFOLLOW);
			const stat = fs.fstatSync(fd);
			requireValue(
				stat.isFile() && stat.nlink === 1 && stat.size <= 262144,
				'unsafe_file',
				'Only bounded regular files without hard links are available'
			);
			const bytes = fs.readFileSync(fd);
			requireValue(
				bytes.length <= 262144 && !bytes.includes(0),
				'unsupported_file',
				'Only bounded text documents are available'
			);
			return { bytes, stat };
		} catch (e) {
			if (e instanceof DomainError) throw e;
			throw new DomainError('unavailable', 'Document is unavailable');
		} finally {
			if (fd !== undefined) fs.closeSync(fd);
		}
	}
	list({ root_id, path: relative = '', search = '' }, actor) {
		const root = this.root(root_id, actor);
		const fd = this.parent(root, this.parts(relative, true));
		try {
			const entries = fs
				.readdirSync(`/proc/self/fd/${fd}`, { withFileTypes: true })
				.filter(
					(e) =>
						!forbidden.test(e.name) &&
						!e.isSymbolicLink() &&
						(e.isDirectory() || extensions.has(path.extname(e.name).toLowerCase())) &&
						e.name.toLowerCase().includes(search.toLowerCase())
				)
				.slice(0, 200)
				.map((e) => ({ name: e.name, kind: e.isDirectory() ? 'directory' : 'file' }));
			return { entries, limit: 200 };
		} finally {
			fs.closeSync(fd);
		}
	}
	read({ root_id, path: relative }, actor) {
		return this.file(this.root(root_id, actor), relative, (file) => {
			const { bytes } = this.readBytes(file);
			return { content: bytes.toString('utf8'), version: hash(bytes), render: 'text' };
		});
	}
	write({ root_id, path: relative, content, expected_version }, actor) {
		requireValue(typeof content === 'string', 'invalid_input', 'Expected text content');
		const bytes = Buffer.from(content);
		requireValue(
			bytes.length <= 262144 && !bytes.includes(0),
			'invalid_input',
			'Document exceeds the text limit'
		);
		return this.file(this.root(root_id, actor, true), relative, (file, dir) => {
			let old = null;
			try {
				old = this.readBytes(file);
			} catch (e) {
				if (fs.existsSync(file) || fs.lstatSync(file, { throwIfNoEntry: false })) throw e;
			}
			requireValue(
				old ? expected_version === hash(old.bytes) : expected_version === null,
				'version_conflict',
				'Document changed; keep your edits and reload before saving'
			);
			const temporary = `/proc/self/fd/${dir}/.falcon-${randomUUID()}`;
			let fd;
			try {
				fd = fs.openSync(temporary, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600);
				fs.writeFileSync(fd, bytes);
				fs.fsyncSync(fd);
				fs.closeSync(fd);
				fd = undefined;
				if (old) {
					const current = this.readBytes(file);
					requireValue(
						current.stat.ino === old.stat.ino && hash(current.bytes) === expected_version,
						'version_conflict',
						'Document changed during save'
					);
					fs.renameSync(temporary, file);
				} else {
					fs.linkSync(temporary, file);
					fs.unlinkSync(temporary);
				}
				fs.fsyncSync(dir);
				return { version: hash(bytes), bytes: bytes.length };
			} finally {
				if (fd !== undefined) fs.closeSync(fd);
				try {
					fs.unlinkSync(temporary);
				} catch (e) {
					if (e.code !== 'ENOENT') process.emitWarning('Temporary file cleanup failed');
				}
			}
		});
	}
	mkdir({ root_id, path: relative }, actor) {
		const root = this.root(root_id, actor, true),
			parts = this.parts(relative),
			fd = this.parent(root, parts.slice(0, -1));
		try {
			fs.mkdirSync(`/proc/self/fd/${fd}/${parts.at(-1)}`, { mode: 0o700 });
			fs.fsyncSync(fd);
			return { created: true };
		} finally {
			fs.closeSync(fd);
		}
	}
}
