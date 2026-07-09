# Task: Typed counter

Build a Potato SPA counter.

## Requirements

1. Use `createApp<State, Events>` with:
   - State: `{ count: number }`
   - Events: `{ increment: [n?: number]; reset: [] }`
2. Use `defineStore` with initial state (no `as never`).
3. Route `/` shows count and two buttons: +1 and reset.
4. `emit('incremnt')` must be a **TypeScript error** if written.
5. Export `createCounterApp()` returning the app.

## Forbidden

- `as any`, `as never` on set/get
- Class components
- External UI frameworks
