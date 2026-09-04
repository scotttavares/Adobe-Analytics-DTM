/** Makes selected keys of `T` required while leaving the rest optional. */
export type Required_<T, K extends keyof T> = T & { [P in K]-?: T[P] };
