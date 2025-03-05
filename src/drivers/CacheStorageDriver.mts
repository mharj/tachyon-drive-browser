import type {ILoggerLike} from '@avanio/logger-like';
import type {Loadable} from '@luolapeikko/ts-common';
import {type IPersistSerializer, type IStoreProcessor, StorageDriver, TachyonBandwidth} from 'tachyon-drive';

export type CacheStorageDriverOptions = {
	/** Cache Store name, defaults as 'tachyon' */
	cacheName?: string;
	/** Cache Request url */
	url: URL;
};
/**
 * CacheStorageDriver
 * @example
 * const stringSerializer: IPersistSerializer<DemoData, string> = { ... };
 * export const cacheStoreDriver = new CacheStorageDriver('CacheStorageDriver', {url: new URL('http://tachyon')}, stringSerializer);
 * @since v0.3.0
 */
export class CacheStorageDriver<Input, Output extends ArrayBuffer | string> extends StorageDriver<Input, Output> {
	public readonly bandwidth = TachyonBandwidth.Large;
	private options: Loadable<CacheStorageDriverOptions>;
	private caches: CacheStorage;
	private currentCache: Cache | undefined;
	private currentRequest: Request | undefined;
	/**
	 * CacheStorageDriver constructor
	 * @param {string} name Driver name
	 * @param {Loadable<CacheStorageDriverOptions>} options CacheStorageDriver options which can be a value, promise or a function
	 * @param {IPersistSerializer<Input, Output>} serializer Serializer object for the data, this can be string or ArrayBuffer serializer
	 * @param {IStoreProcessor<Output>} processor optional Processor which can be used to modify the data before storing or after hydrating
	 * @param {ILoggerLike} logger optional logger
	 * @param {CacheStorage} caches override the caches storage instance (for testing)
	 */
	constructor(
		name: string,
		options: Loadable<CacheStorageDriverOptions>,
		serializer: IPersistSerializer<Input, Output>,
		processor?: Loadable<IStoreProcessor<Output>>,
		logger?: ILoggerLike,
		caches?: CacheStorage,
	) {
		super(name, serializer, null, processor, logger);
		/* c8 ignore next 6 */
		if (!caches && typeof window !== 'undefined') {
			caches = window.caches;
		}
		if (!caches) {
			throw new Error('Cache storage not supported');
		}
		this.options = options;
		this.caches = caches;
	}

	protected async handleInit(): Promise<boolean> {
		await this.getCurrentCache();
		return true;
	}

	protected async handleStore(buffer: Output): Promise<void> {
		let size: number;
		let contentType: string;
		if (typeof buffer === 'string') {
			size = buffer.length;
			contentType = 'text/plain';
		} else {
			size = buffer.byteLength;
			contentType = 'application/octet-stream';
		}
		const cache = await this.getCurrentCache();
		const request = await this.getRequest();
		await cache.put(
			request,
			new Response(buffer, {
				headers: {
					'Content-Type': contentType,
					'Content-Length': size.toString(),
				},
			}),
		);
		this.logger.debug(`${this.name}: Stored ${size.toString()} bytes as '${contentType}'`);
	}

	protected async handleHydrate(): Promise<Output | undefined> {
		const cache = await this.getCurrentCache();
		const res = await cache.match(await this.getRequest());
		if (res) {
			const contentType = res.headers.get('Content-Type');
			let data: Output;
			switch (contentType) {
				case 'application/octet-stream': {
					data = (await res.clone().arrayBuffer()) as Output;
					break;
				}
				case 'text/plain': {
					data = (await res.clone().text()) as Output;
					break;
				}
				/* c8 ignore next 2 */
				default:
					throw new Error('Content-Type header missing or wrong');
			}
			const size = typeof data === 'string' ? data.length : data.byteLength;
			this.logger.debug(`${this.name}: Read ${size.toString()} bytes as '${contentType}'`);
			return data;
		}
		return undefined;
	}

	protected async handleClear(): Promise<void> {
		const cache = await this.getCurrentCache();
		await cache.delete(await this.getRequest());
	}

	protected handleUnload(): Promise<boolean> {
		this.currentCache = undefined;
		this.currentRequest = undefined;
		return Promise.resolve(true);
	}

	private async getRequest(): Promise<Request> {
		if (!this.currentRequest) {
			const options = await this.getOptions();
			this.currentRequest = new Request(options.url);
			this.logger.debug(`${this.name}: Created request for '${options.url}'`);
		}
		return this.currentRequest;
	}

	private async getCurrentCache(): Promise<Cache> {
		if (!this.currentCache) {
			const options = await this.getOptions();
			const cacheName = options.cacheName ?? 'tachyon';
			this.currentCache = await this.caches.open(cacheName);
			this.logger.debug(`${this.name}: Opened cache '${cacheName}'`);
		}
		return this.currentCache;
	}

	private getOptions(): Promise<CacheStorageDriverOptions> | CacheStorageDriverOptions {
		return this.options instanceof Function ? this.options() : this.options;
	}
}
