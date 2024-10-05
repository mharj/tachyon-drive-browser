import type {ILoggerLike} from '@avanio/logger-like';
import {StorageDriver, type IStoreProcessor, type IPersistSerializer, TachyonBandwidth} from 'tachyon-drive';
import type {Loadable} from '@luolapeikko/ts-common';

/**
 * LocalStorageDriver
 * @example
 * const stringSerializer: IPersistSerializer<DemoData, string> = { ... };
 * export const localStoreDriver = new LocalStorageDriver('LocalStorageDriver', 'tachyon', stringSerializer, undefined, console);
 */
export class LocalStorageDriver<Input, Output extends string = string> extends StorageDriver<Input, Output> {
	public readonly bandwidth = TachyonBandwidth.Large;
	private keyName: Loadable<string>;
	private localStorage: Storage;
	private currentKey: string | undefined;
	/**
	 * LocalStorageDriver constructor
	 * @param {string} name Driver name
	 * @param {Loadable<string>} keyName local storage key name which can be a value, promise or a function
	 * @param {IPersistSerializer<Input, Output>} serializer Serializer object for the data, this can be string serializer
	 * @param {IStoreProcessor<Output>} processor optional Processor which can be used to modify the data before storing or after hydrating
	 * @param {ILoggerLike} logger optional logger
	 * @param {Storage} localStorage override the local storage instance (for testing)
	 */
	constructor(
		name: string,
		keyName: Loadable<string>,
		serializer: IPersistSerializer<Input, Output>,
		processor?: IStoreProcessor<Output>,
		logger?: ILoggerLike | Console,
		localStorage?: Storage,
	) {
		super(name, serializer, null, processor, logger);
		// istanbul ignore next
		if (!localStorage && typeof window !== 'undefined') {
			localStorage = window.localStorage;
		}
		if (!localStorage) {
			throw new Error('Local storage not supported');
		}
		this.keyName = keyName;
		this.localStorage = localStorage;
	}

	protected handleInit(): Promise<boolean> {
		return Promise.resolve(true);
	}

	protected async handleStore(buffer: string): Promise<void> {
		this.localStorage.setItem(await this.getKey(), buffer);
		this.logger.debug(`LocalStorageDriver: Stored ${buffer.length.toString()} bytes`);
	}

	protected async handleHydrate(): Promise<Output | undefined> {
		const data = this.localStorage.getItem(await this.getKey()) as Output | null;
		if (data) {
			this.logger.debug(`LocalStorageDriver: Read ${data.length.toString()} bytes`);
		}
		return data || undefined;
	}

	protected async handleClear(): Promise<void> {
		this.localStorage.removeItem(await this.getKey());
	}

	protected handleUnload(): Promise<boolean> {
		return Promise.resolve(true);
	}

	private async getKey(): Promise<string> {
		if (!this.currentKey) {
			this.currentKey = await (this.keyName instanceof Function ? this.keyName() : this.keyName);
			this.logger.debug(`LocalStorageDriver: Using key '${this.currentKey}'`);
		}
		return this.currentKey;
	}
}
