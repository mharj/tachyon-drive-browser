type RequestKey = Record<Request['method'], {req: Request; res: Response | undefined}>;

type InteralCache = Record<string, RequestKey>;

export class MockupCache implements Cache {
	private cache: InteralCache = {};

	public async add(request: RequestInfo | URL): Promise<void> {
		const req = this.buildRequest(request);
		this.handleAdd(req);
	}

	private handleAdd(req: Request, res?: Response) {
		const entry = this.cache[req.url];
		if (!entry) {
			this.cache[req.url] = {
				[req.method]: {
					req,
					res,
				},
			};
		} else {
			entry[req.method] = {
				req,
				res,
			};
		}
	}

	private handleDelete(req: Request, options: CacheQueryOptions): boolean {
		const entry = this.cache[req.url];
		if (!entry) {
			return false;
		}
		delete entry[req.method];
		if (Object.keys(entry).length === 0) {
			delete this.cache[req.url];
		}
		return true;
	}

	public async addAll(requests: RequestInfo[]): Promise<void>;
	public async addAll(requests: Iterable<RequestInfo>): Promise<void>;
	public async addAll(requests: unknown): Promise<void> {
		if (requests instanceof Set || Array.isArray(requests)) {
			requests.forEach((request) => {
				const req = this.buildRequest(request);
				this.handleAdd(req);
			});
		}
		throw new TypeError('addAll() only accepts an array or a set.');
	}

	public async delete(request: RequestInfo | URL, options?: CacheQueryOptions | undefined): Promise<boolean> {
		const req = this.buildRequest(request);
		return this.handleDelete(req, options || {});
	}

	private handleReqKeyRequestList(keyObject: RequestKey, options: CacheQueryOptions): Request[] {
		return Object.values(keyObject).map((value) => value.req);
	}

	public async keys(request?: RequestInfo | URL | undefined, options?: CacheQueryOptions | undefined): Promise<readonly Request[]> {
		if (request) {
			const req = this.buildRequest(request);
			const keyObject = this.cache[req.url];
			if (!keyObject) {
				return [];
			}
			return this.handleReqKeyRequestList(keyObject, options || {});
		}
		return Object.values(this.cache).reduce<Request[]>((acc, curr) => {
			return acc.concat(this.handleReqKeyRequestList(curr, options || {}));
		}, []);
	}

	public async match(request: RequestInfo | URL, options?: CacheQueryOptions | undefined): Promise<Response | undefined> {
		const req = this.buildRequest(request);
		const entry = this.cache[req.url];
		if (!entry) {
			return undefined;
		}
		return entry[req.method]?.res;
	}

	private getResponsesFromEntry(entry: RequestKey): Response[] {
		return Object.values(entry)
			.map((value) => value.res)
			.filter((res) => res !== undefined) as Response[];
	}

	public async matchAll(request?: RequestInfo | URL | undefined, options?: CacheQueryOptions | undefined): Promise<readonly Response[]> {
		if (request) {
			const req = this.buildRequest(request);
			const entry = this.cache[req.url];
			if (!entry) {
				return [];
			}
			return this.getResponsesFromEntry(entry);
		}
		return Object.values(this.cache).reduce<Response[]>((acc, curr) => {
			return acc.concat(this.getResponsesFromEntry(curr));
		}, []);
	}

	public async put(request: RequestInfo | URL, response: Response): Promise<void> {
		const req = this.buildRequest(request);
		this.handleAdd(req, response);
	}

	private buildRequest(request: RequestInfo | URL) {
		if (request instanceof Request) {
			return request;
		}
		return new Request(request);
	}
}

export class MockupCacheStore implements CacheStorage {
	private cacheStore = new Map<string, Cache>();
	public async delete(cacheName: string): Promise<boolean> {
		return this.cacheStore.delete(cacheName);
	}

	public async has(cacheName: string): Promise<boolean> {
		return this.cacheStore.has(cacheName);
	}

	public async keys(): Promise<string[]> {
		return Array.from(this.cacheStore.keys());
	}

	public async match(request: RequestInfo | URL, options?: MultiCacheQueryOptions | undefined): Promise<Response | undefined> {
		if (options?.cacheName) {
			const cache = this.cacheStore.get(options.cacheName);
			if (cache) {
				return cache.match(request, options);
			}
		}
		for (const cache of Array.from(this.cacheStore.values())) {
			const res = await cache.match(request, options);
			if (res) {
				return res;
			}
		}
		return undefined;
	}

	public async open(cacheName: string): Promise<Cache> {
		let cache = this.cacheStore.get(cacheName);
		if (!cache) {
			cache = new MockupCache();
			this.cacheStore.set(cacheName, cache);
		}
		return cache;
	}
}
