export const mockStorage: Storage = {
	// [name: string]: any;
	// length: number;

	clear(): void {
		// can't clear a mock
	},

	getItem(key: string): string | null {
		return this[key];
	},

	key(_index: number): string | null {
		return null;
	},

	removeItem(key: string): void {
		delete this[key];
	},

	setItem(key: string, value: string): void {
		this[key] = value;
	},

	length: 0,
};
