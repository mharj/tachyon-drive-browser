import type {ILoggerLike} from '@avanio/logger-like';
import type {Loadable} from '@luolapeikko/ts-common';
import {type IPersistSerializer, type IStoreProcessor, StorageDriver, TachyonBandwidth} from 'tachyon-drive';

/**
 * LocalStorageDriver
 * @example
 * const stringSerializer: IPersistSerializer<DemoData, string> = { ... };
 * export const localStoreDriver = new LocalStorageDriver('LocalStorageDriver', 'tachyon', stringSerializer, undefined, console);
 * @since v0.3.0
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
		processor?: Loadable<IStoreProcessor<Output>>,
		logger?: ILoggerLike,
		localStorage?: Storage,
	) {
		super(name, serializer, null, processor, logger);
		/* c8 ignore next 6 */
		if (!localStorage && typeof window !== 'undefined') {
			localStorage = window.localStorage;
		}
		if (!localStorage) {
			throw new Error('Local storage not supported');
		}
		this.keyName = keyName;
		this.localStorage = localStorage;
		this.onStorageEvent = this.onStorageEvent.bind(this);
	}

	protected async handleInit(): Promise<boolean> {
		await this.getKey(); // resolve key name to variable
		this.logger.debug(`${this.name}: Register storage event listener for key '${String(this.currentKey)}'`);
		window.addEventListener('storage', this.onStorageEvent);
		return true;
	}

	protected async handleStore(buffer: string): Promise<void> {
		this.localStorage.setItem(await this.getKey(), buffer);
		this.logger.debug(`${this.name}: Stored ${buffer.length.toString()} bytes to LocalStorage`);
	}

	protected async handleHydrate(): Promise<Output | undefined> {
		const data = this.localStorage.getItem(await this.getKey()) as Output | null;
		if (data) {
			this.logger.debug(`${this.name}: Read ${data.length.toString()} bytes from LocalStorage`);
		}
		return data ?? undefined;
	}

	protected async handleClear(): Promise<void> {
		this.localStorage.removeItem(await this.getKey());
	}

	protected async handleUnload(): Promise<boolean> {
		this.logger.debug(`${this.name}: Unregister storage event listener for key '${await this.getKey()}'`);
		window.removeEventListener('storage', this.onStorageEvent);
		return true;
	}

	private async getKey(): Promise<string> {
		if (!this.currentKey) {
			if (this.keyName instanceof Function) {
				this.keyName = this.keyName();
			}
			this.currentKey = await this.keyName;
			this.logger.debug(`${this.name}: Using key '${this.currentKey}'`);
		}
		return this.currentKey;
	}

	private onStorageEvent(event: StorageEvent) {
		/* c8 ignore next 8 */
		if (!this.currentKey) {
			throw new Error('keyName was not resolved yet');
		}
		if (event.key === this.currentKey) {
			this.logger.debug(`${this.name}: Storage event for key '${event.key}'`);
			void this.handleUpdate().catch((err: unknown) => this.logger.error(err));
		}
	}
}
