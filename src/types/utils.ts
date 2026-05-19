/**
 * Shared utility types used across the codebase.
 */

export type DeepImmutable<T> = T extends Record<string, unknown>
  ? { readonly [K in keyof T]: DeepImmutable<T[K]> }
  : T extends Array<infer U>
    ? ReadonlyArray<DeepImmutable<U>>
    : T;

export type Permutations<T extends string, U extends string = T> = T extends string
  ? T | `${T} ${Permutations<Exclude<U, T>>}`
  : never;
