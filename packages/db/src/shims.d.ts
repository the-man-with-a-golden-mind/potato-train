declare module "better-sqlite3" {
  export default class Database {
    constructor(path: string, options?: { readonly?: boolean })
    pragma(source: string): unknown
    prepare(source: string): unknown
    exec(source: string): unknown
    close(): void
  }
}

declare module "postgres" {
  type Sql = ((
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown[]>) & {
    end(opts?: { timeout?: number }): Promise<void>
  }
  export default function postgres(
    url: string,
    opts?: { max?: number },
  ): Sql
}
