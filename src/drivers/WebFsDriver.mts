import {type ILoggerLike} from '@avanio/logger-like';
import {type Loadable} from '@luolapeikko/ts-common';
import {type IPersistSerializer, type IStoreProcessor, StorageDriver, TachyonBandwidth} from 'tachyon-drive';

/**
 * WebFsStorageDriver which uses `FileSystemFileHandle` to read and write store data (permission need to be handled before using this)
 * @example
 * const arrayBufferSerializer: IPersistSerializer<DemoData, ArrayBuffer> = {
 *   name: 'arrayBufferSerializer',
 *   serialize: (data: DemoData) => new TextEncoder().encode(JSON.stringify(data)),
 *   deserialize: (buffer: ArrayBuffer) => JSON.parse(new TextDecoder().decode(buffer)) as DemoData,
 * };
 * export const webFsStoreDriver = new WebFsStorageDriver('WebFsStorageDriver', () => fileSystemFileHandle, arrayBufferSerializer);
 * @see https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
 * @since v0.10.3
 */
export class WebFsStorageDriver<Input> extends StorageDriver<Input, ArrayBuffer> {
	public readonly bandwidth = TachyonBandwidth.VeryLarge;
	private dirHandleLoadable: Loadable<FileSystemDirectoryHandle>;
	private fileName: Loadable<string>;

	public constructor(
		name: string,
		fileName: Loadable<string>,
		dirHandle: Loadable<FileSystemDirectoryHandle>,
		serializer: IPersistSerializer<Input, ArrayBuffer>,
		processor?: Loadable<IStoreProcessor<ArrayBuffer>>,
		logger?: ILoggerLike,
	) {
		super(name, serializer, null, processor, logger);
		this.dirHandleLoadable = dirHandle;
		this.fileName = fileName;
	}

	protected async handleInit(): Promise<boolean> {
		await this.getDirHandler();
		await this.getFileName();
		return true;
	}

	protected async handleStore(buffer: ArrayBuffer): Promise<void> {
		const fileHandle = await this.getFileHandle(true);
		this.logger.debug(`${this.name}: Writing file '${fileHandle.name}' size: ${buffer.byteLength.toString()}`);
		const writable = await fileHandle.createWritable();
		try {
			await writable.write(buffer);
		} finally {
			await writable.close();
		}
	}

	protected async handleHydrate(): Promise<ArrayBuffer | undefined> {
		try {
			const fileHandle = await this.getFileHandle(false);
			this.logger.debug(`${this.name}: Reading file '${fileHandle.name}'`);
			const file = await fileHandle.getFile();
			return await file.arrayBuffer();
		} catch (err) {
			if (err instanceof Error && err.name === 'NotFoundError') {
				return undefined;
			}
			/* c8 ignore next 2 */
			throw err;
		}
	}

	protected async handleClear(): Promise<void> {
		try {
			const dir = await this.getDirHandler();
			return await dir.removeEntry(await this.getFileName());
		} catch (err) {
			if (err instanceof Error && err.name === 'NotFoundError') {
				return;
			}
			/* c8 ignore next 2 */
			throw err;
		}
	}

	protected handleUnload(): Promise<boolean> | boolean {
		return true;
	}

	private getDirHandler(): FileSystemDirectoryHandle | Promise<FileSystemDirectoryHandle> {
		if (typeof this.dirHandleLoadable === 'function') {
			this.dirHandleLoadable = this.dirHandleLoadable();
		}
		return this.dirHandleLoadable;
	}

	private getFileName(): string | Promise<string> {
		if (typeof this.fileName === 'function') {
			this.fileName = this.fileName();
		}
		return this.fileName;
	}

	private async getFileHandle(create: boolean): Promise<FileSystemFileHandle | Promise<FileSystemFileHandle>> {
		const dir = await this.getDirHandler();
		return dir.getFileHandle(await this.getFileName(), {create});
	}
}
