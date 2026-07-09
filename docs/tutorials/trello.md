# Tutorial: Build Trello with Potato

You will build **boards → lists → cards** with drag-free “move” actions, SSR, and REST field updates. About 30 minutes.

## 0. What we’re cloning

- Board page with multiple lists  
- Cards inside lists  
- Add card / move card / rename  
- Persist in memory (swap for Drizzle later)

## 1. Domain model

```ts
// src/types.ts
export type Card = { id: string; title: string; listId: string }
export type List = { id: string; title: string; cardIds: string[] }
export type Board = {
  id: string
  title: string
  lists: List[]
  cards: Record<string, Card>
}
```

## 2. In-memory repository

```ts
// src/db.ts
import type { Board, Card, List } from './types'

const board: Board = {
  id: 'b1',
  title: 'Product launch',
  lists: [
    { id: 'l1', title: 'Backlog', cardIds: ['c1', 'c2'] },
    { id: 'l2', title: 'Doing', cardIds: ['c3'] },
    { id: 'l3', title: 'Done', cardIds: [] },
  ],
  cards: {
    c1: { id: 'c1', title: 'Write docs', listId: 'l1' },
    c2: { id: 'c2', title: 'Design API', listId: 'l1' },
    c3: { id: 'c3', title: 'Ship MVP', listId: 'l2' },
  },
}

export const repo = {
  getBoard: () => board,
  addCard(listId: string, title: string) {
    const id = 'c' + Math.random().toString(36).slice(2, 8)
    board.cards[id] = { id, title, listId }
    board.lists.find((l) => l.id === listId)?.cardIds.push(id)
    return board.cards[id]
  },
  moveCard(cardId: string, toListId: string) {
    const card = board.cards[cardId]
    if (!card) return
    const from = board.lists.find((l) => l.id === card.listId)
    const to = board.lists.find((l) => l.id === toListId)
    if (!from || !to) return
    from.cardIds = from.cardIds.filter((id) => id !== cardId)
    to.cardIds.push(cardId)
    card.listId = toListId
  },
  renameCard(cardId: string, title: string) {
    if (board.cards[cardId]) board.cards[cardId]!.title = title
  },
}
```

## 3. Potato app + typed feature

```ts
// src/app.ts — State + Events are the type spine (renames → tsc, not grep)
import { createApp as createTypedApp, defineFeature, combineState } from '@potato/core'
import { repo } from './db'
import type { Board } from './types'

type State = { board: Board; draft: string; activeList: string }
type Events = {
  'card:draft': [value: string]
  'card:list': [id: string]
  'card:add': []
  'card:move': [{ cardId: string; toListId: string }]
}

const boardFeature = defineFeature<State, Events>({
  name: 'board',
  state: {
    board: repo.getBoard(),
    draft: '',
    activeList: repo.getBoard().lists[0]!.id,
  },
  setup: ({ get, patch, on }) => {
    on('card:draft', (v) => patch({ draft: String(v) }))
    on('card:list', (id) => patch({ activeList: String(id) }))

    on('card:add', async () => {
      const s = get()
      if (!s.draft.trim()) return
      await fetch('/api/cards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listId: s.activeList, title: s.draft }),
      })
      patch({ board: await (await fetch('/api/board')).json(), draft: '' })
    })

    on('card:move', async ({ cardId, toListId }) => {
      await fetch(`/api/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listId: toListId }),
      })
      patch({ board: await (await fetch('/api/board')).json() })
    })
  },
})

export function createApp() {
  const app = createTypedApp<State, Events>({ state: combineState(boardFeature) })
  app.useFeature(boardFeature)

  app.route('/', (state, emit) => (
    <div class="board">
      <h1>{state.board.title}</h1>
      <div class="lists">
        {state.board.lists.map((list) => (
          <section class="list" key={list.id}>
            <h2>{list.title}</h2>
            {/* cards + move buttons: emit('card:move', …) */}
            {/* composer: emit('card:draft') / emit('card:add') */}
          </section>
        ))}
      </div>
    </div>
  ))

  return app.raw // for createServer
}
```

See `examples/trello` for the full Live multiplayer board.

## 4. SSR + API (field updates)

```ts
// src/server.ts
import { createServer, logger } from '@potato/ssr'
import { createApp } from './app'
import { repo } from './db'

const app = createApp()
const server = createServer({
  app,
  middleware: [logger()],
  document: {
    title: 'Potato Trello',
    styles: [`<style>
      body{margin:0;font-family:system-ui;background:#0f172a;color:#e2e8f0}
      .board{padding:1rem}
      .lists{display:flex;gap:1rem;align-items:flex-start;overflow:auto}
      .list{background:#1e293b;border-radius:12px;padding:.75rem;min-width:260px}
      .card{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:.5rem;margin:.4rem 0}
      .moves{display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.4rem}
      button{font-size:.75rem;cursor:pointer}
      input{width:100%;box-sizing:border-box;margin:.4rem 0;padding:.4rem;border-radius:6px;border:1px solid #334155;background:#020617;color:#fff}
    </style>`],
  },
})

server.get('/api/board', () => repo.getBoard())

server.post('/api/cards', async (ctx) => {
  const body = await ctx.req.json() as { listId: string; title: string }
  return repo.addCard(body.listId, body.title)
})

// Field update: move or rename
server.patch('/api/cards/:id', async (ctx) => {
  const body = await ctx.req.json() as { listId?: string; title?: string }
  if (body.listId) repo.moveCard(ctx.params.id!, body.listId)
  if (body.title) repo.renameCard(ctx.params.id!, body.title)
  return repo.getBoard().cards[ctx.params.id!]
})

server.page('/', () => ({ board: repo.getBoard() } as never))

await server.listen(3030)
```

## 5. Run it

```bash
pnpm exec tsx src/server.ts
# open http://localhost:3030
```

## 6. Level-up checklist

| Feature | How |
|---------|-----|
| Auth | `@potato/auth` middleware; board.userId |
| Persist | `@potato/db` + Drizzle tables `boards/lists/cards` |
| Live multiplayer | `@potato/live` — broadcast `card:move` patches |
| Cloudflare | `potatoWorker({ server })` + D1 |
| Optimistic UI | update local state before `fetch` resolves; rollback on error |
| Drag & drop | HTML5 DnD → same `card:move` event |

## 7. Why this maps cleanly to Potato

- **Lists/cards** = pure view over serializable board state  
- **Move card** = one `PATCH` field update (`listId`)  
- **Add card** = `POST` + replace board snapshot  
- **SSR** = first paint with `page('/')` loader  

Same patterns power the spreadsheet (`PATCH` cell) and portfolio (`PATCH` holding) examples.

## Next

- Spreadsheet tutorial: [spreadsheet.md](./spreadsheet.md)  
- Production DB: see `@potato/db` in [api.md](../api.md)
