import {spy} from 'sinon';
import {type IPersistSerializer, type IStorageDriver} from 'tachyon-drive';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {z} from 'zod';
import {CacheStorageDriver, CryptoBufferProcessor, LocalStorageDriver, WebFsStorageDriver} from '../src/index.mjs';

const dataSchema = z.object({
	test: z.string(),
});

type Data = z.infer<typeof dataSchema>;

const isBrowser = typeof window !== 'undefined';

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

const loadCryptoProcessor = spy(function () {
	const processor = new CryptoBufferProcessor(() => new TextEncoder().encode('some-secret-key').buffer);
	processor.setLogger(undefined);
	return processor;
});

const driverSet = new Set<{driver: IStorageDriver<Data>; crypto?: boolean}>([
	{driver: new LocalStorageDriver('LocalStorageDriver1', () => Promise.resolve('storageKey'), stringSerializer)},
	{driver: new LocalStorageDriver('LocalStorageDriver2', 'storageKey', stringSerializer)},
	{
		driver: new CacheStorageDriver(
			'CacheStorageDriver1',
			() => Promise.resolve({url: new URL('https://example.com/data')}),
			arrayBufferSerializer,
			loadCryptoProcessor,
		),
		crypto: true,
	},
	{
		driver: new CacheStorageDriver('CacheStorageDriver2', {url: new URL('https://example.com/data')}, stringSerializer),
	},
	{
		driver: new CacheStorageDriver('CacheStorageDriver3', {url: new URL('https://example.com/data')}, stringSerializer),
	},
	{
		driver: new WebFsStorageDriver(
			'WebFsStorageDriver',
			() => 'test.file',
			() => navigator.storage.getDirectory(),
			arrayBufferSerializer,
		),
	},
]);

const data = dataSchema.parse({test: 'demo'});

describe('StorageDriver', () => {
	driverSet.forEach(({driver: currentDriver, crypto}) => {
		describe(currentDriver.name, () => {
			beforeEach(function () {
				loadCryptoProcessor.resetHistory();
			});
			beforeAll(async function () {
				await currentDriver.clear();
				expect(currentDriver.isInitialized).to.be.eq(false);
				expect(loadCryptoProcessor.callCount).equals(0); // should not be loaded yet
			});
			it('should be empty store', async () => {
				expect(await currentDriver.hydrate()).to.eq(undefined);
				expect(currentDriver.isInitialized).to.be.eq(true);
				expect(loadCryptoProcessor.callCount).equals(crypto ? 1 : 0);
			});
			it('should store to storage driver', async () => {
				await currentDriver.store(data);
				expect(await currentDriver.hydrate()).to.eql(data);
				expect(currentDriver.isInitialized).to.be.eq(true);
				expect(loadCryptoProcessor.callCount).equals(0); // crypto loads only once
			});
			it('should restore data from storage driver', async () => {
				expect(await currentDriver.hydrate()).to.eql(data);
				expect(currentDriver.isInitialized).to.be.eq(true);
				expect(loadCryptoProcessor.callCount).equals(0); // crypto loads only once
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
