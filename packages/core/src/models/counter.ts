type CounterKey = string | boolean | number;

interface CounterKeyFunc<T> {
	(item: T): CounterKey;
}

export class Counter<T> extends Map<CounterKey, number> {
	key: CounterKeyFunc<T>;

	constructor(items: Iterable<T>, key: CounterKeyFunc<T>) {
		super();
		this.key = key;
		for (const it of items) {
			this.add(it);
		}
	}

	add(it: T) {
		const k = this.key(it);
		this.set(k, (this.get(k) || 0) + 1);
	}
}