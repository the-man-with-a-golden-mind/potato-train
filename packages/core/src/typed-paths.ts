/**
 * Compile-time route param extraction.
 *
 * @example
 * type P = PathParams<'/users/:id/posts/:pid'>
 * // { id: string; pid: string }
 */

/** Extract `:param` names from a route pattern into a params object type. */
export type PathParams<S extends string> = string extends S
  ? Record<string, string>
  : S extends `${infer _Start}:${infer Rest}`
    ? Rest extends `${infer Param}/${infer After}`
      ? { [K in Param | keyof PathParams<`/${After}`>]: string }
      : Rest extends `${infer Param}*`
        ? { [K in Param]: string }
        : Rest extends `${infer Param}?${infer _Q}`
          ? { [K in Param]: string }
          : { [K in Rest]: string }
    : // wildcard-only route
      S extends `${infer _Pre}*${infer _Post}`
      ? { wildcard: string }
      : Record<string, never>

/** Merge two param maps */
export type MergeParams<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? B[K]
    : K extends keyof A
      ? A[K]
      : never
}

/** Assert a path is a static route pattern (for IDE hints) */
export type RoutePattern = `/${string}` | "/" | "*" | `/*`
