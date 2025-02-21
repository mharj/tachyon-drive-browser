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
 * @since v0.10.2
 */
export class WebFsStorageDriver<Input> extends StorageDriver<Input, ArrayBuffer> {
	public readonly bandwidth = TachyonBandwidth.VeryLarge;
	private fileHandleLoadable: Loadable<FileSystemFileHandle>;

	public constructor(
		name: string,
		fileHandle: Loadable<FileSystemFileHandle>,
		serializer: IPersistSerializer<Input, ArrayBuffer>,
		processor?: IStoreProcessor<ArrayBuffer>,
		logger?: ILoggerLike,
	) {
		super(name, serializer, null, processor, logger);
		this.fileHandleLoadable = fileHandle;
	}

	protected async handleInit(): Promise<boolean> {
		await this.getFileHandler();
		return true;
	}

	protected async handleStore(buffer: ArrayBuffer): Promise<void> {
		const fileHandle = await this.getFileHandler();
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
			const fileHandle = await this.getFileHandler();
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
		const fileHandle = await this.getFileHandler();
		if ('remove' in fileHandle && typeof fileHandle.remove === 'function') {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
			await fileHandle.remove();
		}
	}

	protected handleUnload(): Promise<boolean> | boolean {
		return true;
	}

	private async getFileHandler(): Promise<FileSystemFileHandle> {
		if (typeof this.fileHandleLoadable === 'function') {
			this.fileHandleLoadable = this.fileHandleLoadable();
		}
		const fileHandle = await this.fileHandleLoadable;
		const permission = await fileHandle.queryPermission({mode: 'readwrite'});
		/* c8 ignore next 3 */
		if (permission !== 'granted') {
			throw new Error(`Permission denied: fileHandle permission is ${permission}`);
		}
		return fileHandle;
	}
}
