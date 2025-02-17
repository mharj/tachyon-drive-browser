export class MockupCache implements Cache {
	private cache = new Map<string, {req: Request; res: Response | undefined}>();

	public add(request: RequestInfo | URL): Promise<void> {
		const req = this.buildRequest(request);
		this.handleAdd(req);
		return Promise.resolve();
	}

	public addAll(requests: Iterable<RequestInfo>): Promise<void> {
		for (const request of requests) {
			const req = this.buildRequest(request);
			this.handleAdd(req);
		}
		return Promise.resolve();
	}

	public delete(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<boolean> {
		const req = this.buildRequest(request);
		return Promise.resolve(this.handleDelete(req, options || {}));
	}

	public keys(request?: RequestInfo | URL, options?: CacheQueryOptions): Promise<readonly Request[]> {
		if (request) {
			const req = this.buildRequest(request);
			const key = this.getRequestStringKey(req, options);
			const res = this.cache.get(key)?.res;
			if (!res) {
				return Promise.resolve([]);
			}
			return Promise.resolve([req]);
		}
		return Promise.resolve(Array.from(this.cache.values()).map((value) => value.req));
	}

	public match(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<Response | undefined> {
		const req = this.buildRequest(request);
		const key = this.getRequestStringKey(req, options);
		return Promise.resolve(this.cache.get(key)?.res);
	}

	public matchAll(request?: RequestInfo | URL, options?: CacheQueryOptions): Promise<readonly Response[]> {
		if (request) {
			const req = this.buildRequest(request);
			const keyList = options ? [this.getRequestStringKey(req, options)] : this.buildRequestKeyList(req);
			return Promise.resolve(
				keyList.reduce<Response[]>((acc, key) => {
					const res = this.cache.get(key)?.res;
					if (res) {
						acc.push(res);
					}
					return acc;
				}, []),
			);
		}
		return Promise.resolve(
			Array.from(this.cache.values()).reduce<Response[]>((acc, value) => {
				if (value.res) {
					acc.push(value.res);
				}
				return acc;
			}, []),
		);
	}

	public put(request: RequestInfo | URL, response: Response): Promise<void> {
		const req = this.buildRequest(request);
		this.handleAdd(req, response);
		return Promise.resolve();
	}

	private buildRequest(request: RequestInfo | URL) {
		if (request instanceof Request) {
			return request;
		}
		return new Request(request);
	}

	private getRequestStringKey(request: Request, options: CacheQueryOptions | undefined): string {
		const method = options?.ignoreMethod ? '*' : request.method;
		const vary = options?.ignoreVary ? '*' : request.headers.get('Vary') || '*';
		return `${method}:${request.url}:${vary}`;
	}

	private buildRequestKeyList(request: Request): string[] {
		// build all key options for lookup `method:url:vary`
		const keys: string[] = [];
		const methodSet = new Set(['*', request.method]);
		const varySet = new Set([request.headers.get('Vary') || '*', '*']);
		for (const method of methodSet) {
			for (const vary of varySet) {
				keys.push(`${method}:${request.url}:${vary}`);
			}
		}
		return keys;
	}

	private handleAdd(req: Request, res?: Response) {
		const keyList = this.buildRequestKeyList(req);
		keyList.forEach((key) => this.cache.set(key, {req, res}));
	}

	private handleDelete(req: Request, _options: CacheQueryOptions): boolean {
		let isDeleted = false;
		const keyList = this.buildRequestKeyList(req);
		keyList.forEach((key) => {
			if (this.cache.delete(key)) {
				isDeleted = true;
			}
		});
		return isDeleted;
	}
}

export class MockupCacheStore implements CacheStorage {
	private cacheStore = new Map<string, Cache>();
	public delete(cacheName: string): Promise<boolean> {
		return Promise.resolve(this.cacheStore.delete(cacheName));
	}

	public has(cacheName: string): Promise<boolean> {
		return Promise.resolve(this.cacheStore.has(cacheName));
	}

	public keys(): Promise<string[]> {
		return Promise.resolve(Array.from(this.cacheStore.keys()));
	}

	public async match(request: RequestInfo | URL, options?: MultiCacheQueryOptions): Promise<Response | undefined> {
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

	public open(cacheName: string): Promise<Cache> {
		let cache = this.cacheStore.get(cacheName);
		if (!cache) {
			cache = new MockupCache();
			this.cacheStore.set(cacheName, cache);
		}
		return Promise.resolve(cache);
	}
}
