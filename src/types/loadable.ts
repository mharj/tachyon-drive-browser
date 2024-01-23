/**
 * Loadable type, this can be a value, promise or a function.
 * @template T
 * @example
 * // resolve a Loadable value
 * const value: T = await (typeof loadable === 'function' ? loadable() : loadable);
 */
export type Loadable<T> = T | Promise<T> | (() => T | Promise<T>);
