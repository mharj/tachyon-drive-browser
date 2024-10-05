export class MockStorage extends Map<string, string> implements Storage {
	getItem(key: string): string | null {
		return this.get(key) || null;
	}

	key(index: number): string | null {
		const keys = Array.from(this.keys());
		return keys[index] || null;
	}

	removeItem(key: string): void {
		this.delete(key);
	}

	setItem(key: string, value: string): void {
		this.set(key, value);
	}

	get length(): number {
		return this.size;
	}
}
