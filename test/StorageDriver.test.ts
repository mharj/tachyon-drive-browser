/* eslint-disable sonarjs/no-duplicate-string */
import * as chai from 'chai';
import 'mocha';
import {z} from 'zod';
import * as chaiAsPromised from 'chai-as-promised';
import {IPersistSerializer, IStorageDriver} from 'tachyon-drive';
import {LocalStorageDriver, CacheStorageDriver} from '../src/';
import {mockStorage} from './lib/MockStorage';
import {MockupCacheStore} from './lib/mockupCache';

chai.use(chaiAsPromised);
const expect = chai.expect;

const dataSchema = z.object({
	test: z.string(),
});

type Data = z.infer<typeof dataSchema>;

const stringSerializer: IPersistSerializer<Data, string> = {
	serialize: (data: Data) => JSON.stringify(data),
	deserialize: (buffer: string) => JSON.parse(buffer),
	validator: (data: Data) => dataSchema.safeParse(data).success,
};

const arrayBufferSerializer: IPersistSerializer<Data, ArrayBuffer> = {
	serialize: (data: Data) => new TextEncoder().encode(JSON.stringify(data)),
	deserialize: (buffer: ArrayBuffer) => JSON.parse(new TextDecoder().decode(buffer)),
	validator: (data: Data) => dataSchema.safeParse(data).success,
};

const driverSet = new Set<IStorageDriver<Data>>([
	new LocalStorageDriver('LocalStorageDriver1', async () => 'storageKey', stringSerializer, undefined, undefined, mockStorage),
	new LocalStorageDriver('LocalStorageDriver2', 'storageKey', stringSerializer, undefined, undefined, mockStorage),
	new CacheStorageDriver(
		'CacheStorageDriver1',
		async () => ({url: new URL('https://example.com/data')}),
		arrayBufferSerializer,
		undefined,
		undefined,
		new MockupCacheStore(),
	),
	new CacheStorageDriver('CacheStorageDriver2', {url: new URL('https://example.com/data')}, stringSerializer, undefined, undefined, new MockupCacheStore()),
]);

const data = dataSchema.parse({test: 'demo'});

describe('StorageDriver', () => {
	driverSet.forEach((currentDriver) => {
		describe(currentDriver.name, () => {
			before(async function () {
				this.timeout(10000);
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
	describe('Errors', () => {
		it('should throw error on constructor', async () => {
			expect(() => new LocalStorageDriver('LocalStorageDriver', async () => 'storageKey', stringSerializer, undefined, undefined, undefined)).to.throw(
				'Local storage not supported',
			);
			expect(
				() =>
					new CacheStorageDriver(
						'CacheStorageDriver',
						async () => ({url: new URL('https://example.com/data')}),
						arrayBufferSerializer,
						undefined,
						undefined,
						undefined,
					),
			).to.throw('Cache storage not supported');
		});
	});
});
