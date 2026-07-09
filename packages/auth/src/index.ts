import type { Middleware, PotatoContext } from "@potato/ssr"
import { Effect } from "effect"

export interface AuthUser {
  id: string
  email?: string
  name?: string
  roles?: string[]
  [key: string]: unknown
}

export interface SessionRecord {
  id: string
  userId: string
  expiresAt: number
  data?: Record<string, unknown>
}

export interface SessionStore {
  get(id: string): Promise<SessionRecord | null>
  set(session: SessionRecord): Promise<void>
  delete(id: string): Promise<void>
}

export interface AuthOptions {
  /** Cookie name. Default potato_session */
  cookie?: string
  /** Session TTL seconds. Default 7 days */
  ttlSeconds?: number
  /** Session storage (memory default — use KV/DB in prod) */
  store?: SessionStore
  /** Secure cookies */
  secure?: boolean
  /** Resolve user from session */
  getUser: (userId: string, ctx: PotatoContext) => Promise<AuthUser | null>
  secret?: string
}

const memory = new Map<string, SessionRecord>()

export function memorySessionStore(): SessionStore {
  return {
    async get(id) {
      const s = memory.get(id)
      if (!s) return null
      if (s.expiresAt < Date.now()) {
        memory.delete(id)
        return null
      }
      return s
    },
    async set(session) {
      memory.set(session.id, session)
    },
    async delete(id) {
      memory.delete(id)
    },
  }
}

function randomId(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Auth middleware — attaches `ctx.locals.user` and helpers.
 */
export function createAuth(opts: AuthOptions) {
  const cookieName = opts.cookie ?? "potato_session"
  const ttl = (opts.ttlSeconds ?? 60 * 60 * 24 * 7) * 1000
  const store = opts.store ?? memorySessionStore()

  const middleware: Middleware = async (ctx, next) => {
    const sid = ctx.cookies.get(cookieName)
    let user: AuthUser | null = null
    let session: SessionRecord | null = null

    if (sid) {
      session = await store.get(sid)
      if (session) {
        user = await opts.getUser(session.userId, ctx)
      }
    }

    ctx.locals.user = user
    ctx.locals.session = session
    ctx.locals.auth = {
      user,
      async login(userId: string, data?: Record<string, unknown>) {
        const id = randomId()
        const rec: SessionRecord = {
          id,
          userId,
          expiresAt: Date.now() + ttl,
          data,
        }
        await store.set(rec)
        ctx.cookies.set(cookieName, id, {
          httpOnly: true,
          secure: opts.secure ?? true,
          sameSite: "lax",
          path: "/",
          maxAge: Math.floor(ttl / 1000),
        })
        const u = await opts.getUser(userId, ctx)
        ctx.locals.user = u
        ctx.locals.session = rec
        return u
      },
      async logout() {
        const id = ctx.cookies.get(cookieName)
        if (id) await store.delete(id)
        ctx.cookies.delete(cookieName)
        ctx.locals.user = null
        ctx.locals.session = null
      },
      requireUser(): AuthUser {
        const u = ctx.locals.user as AuthUser | null
        if (!u) {
          const err = new Error("Unauthorized") as Error & { status: number }
          err.status = 401
          throw err
        }
        return u
      },
    }

    return next()
  }

  return {
    middleware,
    /** Protect API routes */
    requireAuth(): Middleware {
      return async (ctx, next) => {
        if (!ctx.locals.user) return ctx.json({ error: "Unauthorized" }, 401)
        return next()
      }
    },
  }
}

export type AuthLocals = {
  user: AuthUser | null
  session: SessionRecord | null
  auth: {
    user: AuthUser | null
    login(userId: string, data?: Record<string, unknown>): Promise<AuthUser | null>
    logout(): Promise<void>
    requireUser(): AuthUser
  }
}

export function getAuth(ctx: PotatoContext): AuthLocals["auth"] {
  return ctx.locals.auth as AuthLocals["auth"]
}

/** Password hashing via Web Crypto (PBKDF2) — works on CF Workers. */
export async function hashPassword(
  password: string,
  iterations = 100_000,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await derive(password, salt, iterations)
  const saltB64 = b64(salt)
  const keyB64 = b64(new Uint8Array(key))
  return `pbkdf2$${iterations}$${saltB64}$${keyB64}`
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const [algo, iterS, saltB64, keyB64] = stored.split("$")
    if (algo !== "pbkdf2" || !iterS || !saltB64 || !keyB64) return false
    const iterations = Number(iterS)
    if (!Number.isFinite(iterations) || iterations <= 0) return false
    const salt = ub64(saltB64)
    const expected = ub64(keyB64)
    const actual = new Uint8Array(await derive(password, salt, iterations))
    if (actual.length !== expected.length) return false
    let ok = 0
    for (let i = 0; i < actual.length; i++) ok |= actual[i]! ^ expected[i]!
    return ok === 0
  } catch {
    return false
  }
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<ArrayBuffer> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )
  // Copy into a plain ArrayBuffer for TS DOM lib compatibility
  const saltBuf = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength,
  ) as ArrayBuffer
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuf,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    256,
  )
}

function b64(bytes: Uint8Array): string {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function ub64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Effect wrapper for require user */
export const requireUserEffect = (
  ctx: PotatoContext,
): Effect.Effect<AuthUser, { _tag: "Unauthorized" }> =>
  Effect.gen(function* () {
    const user = ctx.locals.user as AuthUser | null
    if (!user) {
      return yield* Effect.fail({ _tag: "Unauthorized" as const })
    }
    return user
  })
