import {type ILoggerLike} from '@avanio/logger-like';
import {type Loadable} from '@luolapeikko/ts-common';
import {type IStoreProcessor} from 'tachyon-drive';

function mergeArrayBuffers(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
	const merged = new Uint8Array(a.byteLength + b.byteLength);
	merged.set(new Uint8Array(a), 0);
	merged.set(new Uint8Array(b), a.byteLength);
	return merged.buffer;
}

/**
 * A processor that encrypts and decrypts ArrayBuffer data.
 * - Uses AES-256-GCM encryption (iv stored in the first 12 bytes)
 * - Secret Key is derived from a key buffer and build as sha256 hash key
 */
export class CryptoBufferProcessor implements IStoreProcessor<ArrayBuffer> {
	public readonly name = 'CryptoBufferProcessor';
	private buffer: Loadable<ArrayBuffer>;
	private key: CryptoKey | undefined;

	private readonly algorithm = 'AES-GCM';
	private logger: ILoggerLike | undefined;

	public constructor(keyBuffer: Loadable<ArrayBuffer>, logger?: ILoggerLike) {
		this.buffer = keyBuffer;
		this.logger = logger;
	}

	public preStore(buffer: ArrayBuffer): ArrayBuffer | Promise<ArrayBuffer> {
		return this.encryptPromise(buffer);
	}

	public postHydrate(buffer: ArrayBuffer): ArrayBuffer | Promise<ArrayBuffer> {
		return this.decryptPromise(buffer);
	}

	public toString() {
		return `${this.name} algorithm: ${this.algorithm}`;
	}

	public toJSON() {
		return {
			name: this.name,
			algorithm: this.algorithm,
		};
	}

	public setLogger(logger: ILoggerLike | undefined) {
		this.logger = logger;
	}

	private async getCryptoKey(): Promise<CryptoKey> {
		if (!this.key) {
			const digest = await crypto.subtle.digest('SHA-256', await this.getBuffer());
			this.key = await crypto.subtle.importKey('raw', digest, {name: this.algorithm, length: 256}, true, ['encrypt', 'decrypt']);
		}
		return this.key;
	}

	private async getBuffer(): Promise<ArrayBuffer> {
		if (typeof this.buffer === 'function') {
			this.buffer = this.buffer();
		}
		return this.buffer;
	}

	private async encryptPromise(buffer: ArrayBuffer): Promise<ArrayBuffer> {
		this.logger?.debug(`${this.name}: Encrypting ${buffer.byteLength.toString()} bytes`);
		const key = await this.getCryptoKey();
		// get 12 random bytes from crypto
		const iv = crypto.getRandomValues(new Uint8Array(12));
		// encrypt using the key as [iv, data]
		return mergeArrayBuffers(iv.buffer, await crypto.subtle.encrypt({name: this.algorithm, iv}, key, buffer));
	}

	private async decryptPromise(buffer: ArrayBuffer): Promise<ArrayBuffer> {
		this.logger?.debug(`${this.name}: Decrypting ${buffer.byteLength.toString()} bytes`);
		const key = await this.getCryptoKey();
		// get iv from beginning of buffer
		const iv = buffer.slice(0, 12);
		// decrypt using the key
		return await crypto.subtle.decrypt({name: this.algorithm, iv}, key, buffer.slice(12));
	}
}
