import {type IPersistSerializer, type IStorageDriver} from 'tachyon-drive';
import {beforeAll, describe, expect, it} from 'vitest';
import {z} from 'zod';
import {CacheStorageDriver, LocalStorageDriver, WebFsStorageDriver} from '../src/index.mjs';
import {MockStorage} from './lib/MockStorage.mjs';
import {MockupCacheStore} from './lib/mockupCache.mjs';

const dataSchema = z.object({
	test: z.string(),
});

type Data = z.infer<typeof dataSchema>;

const isBrowser = typeof window !== 'undefined';

function getStorage(): Storage {
	return isBrowser ? window.localStorage : new MockStorage();
}

function getCacheStorage(): CacheStorage {
	return isBrowser ? window.caches : new MockupCacheStore();
}

const stringSerializer: IPersistSerializer<Data, string> = {
	name: 'stringSerializer',
	serialize: (data: Data) => JSON.stringify(data),
	deserialize: (buffer: string) => JSON.parse(buffer) as Data,
	validator: (data: Data) => dataSchema.safeParse(data).success,
};

const arrayBufferSerializer: IPersistSerializer<Data, ArrayBuffer> = {
	name: 'arrayBufferSerializer',
	serialize: (data: Data) => new TextEncoder().encode(JSON.stringify(data)),
	deserialize: (buffer: ArrayBuffer) => JSON.parse(new TextDecoder().decode(buffer)) as Data,
	validator: (data: Data) => dataSchema.safeParse(data).success,
};

let fsDir: FileSystemDirectoryHandle;
let fsStoreHandle: FileSystemFileHandle;

const driverSet = new Set<IStorageDriver<Data>>([
	new LocalStorageDriver('LocalStorageDriver1', () => Promise.resolve('storageKey'), stringSerializer, undefined, undefined, getStorage()),
	new LocalStorageDriver('LocalStorageDriver2', 'storageKey', stringSerializer, undefined, undefined, getStorage()),
	new CacheStorageDriver(
		'CacheStorageDriver1',
		() => Promise.resolve({url: new URL('https://example.com/data')}),
		arrayBufferSerializer,
		undefined,
		undefined,
		getCacheStorage(),
	),
	new CacheStorageDriver('CacheStorageDriver2', {url: new URL('https://example.com/data')}, stringSerializer, undefined, undefined, getCacheStorage()),
	new WebFsStorageDriver('WebFsStorageDriver', () => fsStoreHandle, arrayBufferSerializer),
]);

const data = dataSchema.parse({test: 'demo'});

describe('StorageDriver', () => {
	beforeAll(async () => {
		fsDir = await navigator.storage.getDirectory();
		fsStoreHandle = await fsDir.getFileHandle('store.data', {create: true});
		expect(await fsStoreHandle.queryPermission({mode: 'readwrite'})).to.be.eq('granted');
	});
	driverSet.forEach((currentDriver) => {
		describe(currentDriver.name, () => {
			beforeAll(async function () {
				await currentDriver.init();
				await currentDriver.clear();
				expect(currentDriver.isInitialized).to.be.eq(false);
			});
			it('should be empty store', async () => {
				expect(await currentDriver.hydrate()).to.eq(undefined);
				expect(currentDriver.isInitialized).to.be.eq(true);
			});
			it('should store to storage driver', async () => {
				await currentDriver.store(data);
				expect(await currentDriver.hydrate()).to.eql(data);
				expect(currentDriver.isInitialized).to.be.eq(true);
			});
			it('should restore data from storage driver', async () => {
				expect(await currentDriver.hydrate()).to.eql(data);
				expect(currentDriver.isInitialized).to.be.eq(true);
			});
			it('should clear to storage driver', async () => {
				await currentDriver.clear();
				expect(currentDriver.isInitialized).to.be.eq(false);
				expect(await currentDriver.hydrate()).to.eq(undefined);
				expect(currentDriver.isInitialized).to.be.eq(true);
			});
			it('should unload to storage driver', async () => {
				expect(currentDriver.isInitialized).to.be.eq(true);
				expect(await currentDriver.unload()).to.eq(true);
				expect(currentDriver.isInitialized).to.be.eq(false);
			});
		});
	});
	describe('Errors', {skip: isBrowser}, () => {
		it('should throw error on constructor', function () {
			expect(
				() => new LocalStorageDriver('LocalStorageDriver', () => Promise.resolve('storageKey'), stringSerializer, undefined, undefined, undefined),
			).to.throw('Local storage not supported');
			expect(
				() =>
					new CacheStorageDriver(
						'CacheStorageDriver',
						() => Promise.resolve({url: new URL('https://example.com/data')}),
						arrayBufferSerializer,
						undefined,
						undefined,
						undefined,
					),
			).to.throw('Cache storage not supported');
		});
	});
});
