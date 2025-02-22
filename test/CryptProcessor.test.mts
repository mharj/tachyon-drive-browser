import {isValidStoreProcessor} from 'tachyon-drive';
import {describe, expect, it} from 'vitest';
import {CryptoBufferProcessor} from '../src/index.mjs';

const processor = new CryptoBufferProcessor(new TextEncoder().encode('some-secret-key').buffer);

const data = new TextEncoder().encode('test');

let encryptedData: ArrayBuffer;

describe('CryptoProcessor', function () {
	it('should be empty store', async function () {
		encryptedData = await processor.preStore(data);
		expect(encryptedData.byteLength).to.be.greaterThan(0);
	});
	it('should store to storage driver', async function () {
		const decryptedData = await processor.postHydrate(encryptedData);
		expect(decryptedData).to.eql(data.buffer);
	});
	it('should be valid processor', function () {
		expect(isValidStoreProcessor(processor)).to.be.equal(true);
	});
	it('should get toString()', function () {
		expect(processor.toString()).to.be.equal('CryptoBufferProcessor algorithm: AES-GCM');
	});
	it('should get toJSON()', function () {
		expect(processor.toJSON()).toStrictEqual({name: 'CryptoBufferProcessor', algorithm: 'AES-GCM'});
	});
});
