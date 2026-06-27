export type Fn<T = unknown, A extends unknown[] = never[]> = (...args: A) => T;
export type WithOptional<T, K extends keyof T> = Omit<T, K> & {[P in K]?: T[P]};
