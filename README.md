# tachyon-drive-browser

## Browser CacheStorage and LocalStorage driver for [tachyon-drive](https://www.npmjs.com/package/tachyon-drive)

### Compatibility

- Uses `CacheStorage` and `LocalStorage` Browser APIs.
- Have peer dependencies on Browserify `events` packages (for StorageDriver `EventEmitter`).

### CacheStorageDriver and LocalStorageDriver examples

```typescript
export type DemoData = z.infer<typeof dataSchema>;
const stringSerializer: IPersistSerializer<DemoData, string> = {
	name: 'stringSerializer',
	serialize: (data: DemoData) => JSON.stringify(data),
	deserialize: (buffer: string) => JSON.parse(buffer),
	validator: (data: DemoData) => dataSchema.safeParse(data).success,
};
const arrayBufferSerializer: IPersistSerializer<DemoData, ArrayBuffer> = {
	name: 'arrayBufferSerializer',
	serialize: (data: DemoData) => new TextEncoder().encode(JSON.stringify(data)),
	deserialize: (buffer: ArrayBuffer) => JSON.parse(new TextDecoder().decode(buffer)),
	validator: (data: DemoData) => dataSchema.safeParse(data).success,
};

// local storage driver allows only string values.
export const localStoreDriver = new LocalStorageDriver('LocalStorageDriver', 'tachyon', stringSerializer, undefined, console);
// cache storage driver can handle string and array buffer values.
export const cacheStoreDriver = new CacheStorageDriver('CacheStorageDriver', {url: new URL('http://tachyon')}, stringSerializer, undefined, console);
export const cacheStoreDriver = new CacheStorageDriver('CacheStorageDriver', {url: new URL('http://tachyon')}, arrayBufferSerializer, undefined, console);
// WebFS Api driver
export const webFsStoreDriver = new WebFsStorageDriver('WebFsStorageDriver', 'store.json', () => navigator.storage.getDirectory(), arrayBufferSerializer);
// encrypted cache storage (ArrayBuffer)
const processor = new CryptoBufferProcessor(() => new TextEncoder().encode('some-secret-key'));
export const cacheStoreDriver = new CacheStorageDriver('CacheStorageDriver', {url: new URL('http://tachyon')}, arrayBufferSerializer, processor, console);
export const webFsStoreDriver = new WebFsStorageDriver('WebFsStorageDriver', 'store.aes', () => navigator.storage.getDirectory(), arrayBufferSerializer, processor, console);
```

### see more on NPMJS [tachyon-drive](https://www.npmjs.com/package/tachyon-drive)
