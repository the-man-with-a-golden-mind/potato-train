/**
 * Multiplayer Trello — createApp + typed Events + Tailwind.
 */
import {
  createApp as createTypedApp,
  defineFeature,
  combineState,
} from "potato-train-core"
import { liveClick, liveSubmit } from "potato-train-live"
import { getBoard, type Board } from "./board.js"

export type State = {
  board: Board
  draft: string
  activeList: string
  peers: number
}

export type Events = {
  "card:draft": [value: string]
  "card:focus-list": [id: string]
  "board:sync": [board: Board]
  "card:add": [{ title?: string; listId?: string }]
  "card:move": [{ cardId?: string; toListId?: string }]
  "list:add": [{ title?: string }]
}

const boardFeature = defineFeature<State, Events>({
  name: "board",
  state: {
    board: getBoard(),
    draft: "",
    activeList: getBoard().lists[0]!.id,
    peers: 1,
  },
  setup: ({ patch, on }) => {
    on("card:draft", (v) => {
      patch({ draft: String(v ?? "") })
    })
    on("card:focus-list", (id) => {
      patch({ activeList: String(id) })
    })
    on("board:sync", (board) => {
      patch({ board })
    })
    on("card:add", () => {})
    on("card:move", () => {})
    on("list:add", () => {})
  },
})

export function createApp() {
  const app = createTypedApp<State, Events>({
    state: combineState(boardFeature),
  })
  app.useFeature(boardFeature)

  app.route("/", (state) => {
    const board = state.board

    return (
      <div class="min-h-screen font-sans">
        <header class="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900 px-5 py-4">
          <h1 class="m-0 text-xl font-bold text-white">{board.title}</h1>
          <span class="rounded-full bg-emerald-900 px-2 py-0.5 text-xs font-bold text-emerald-200">
            {`Live · ${state.peers ?? 1} peer(s)`}
          </span>
          <span class="text-sm text-slate-400">
            Multiplayer Trello · Tailwind
          </span>
        </header>
        <div class="flex gap-4 overflow-x-auto p-5">
          {board.lists.map((list) => (
            <section
              class="flex w-72 shrink-0 flex-col rounded-xl bg-slate-900/90 p-3 ring-1 ring-slate-800"
              key={list.id}
              data-list={list.id}
            >
              <h2 class="mb-3 text-sm font-semibold text-slate-200">
                {list.title}
              </h2>
              <div class="mb-3 flex flex-col gap-2">
                {list.cardIds.map((cid) => {
                  const card = board.cards[cid]!
                  return (
                    <article
                      class="card rounded-lg bg-slate-800 p-3 ring-1 ring-slate-700"
                      key={cid}
                      id={`card-${cid}`}
                    >
                      <div class="mb-2 text-sm font-medium text-white">
                        {card.title}
                      </div>
                      <div class="flex flex-wrap gap-1">
                        {board.lists
                          .filter((l) => l.id !== list.id)
                          .map((l) => (
                            <button
                              type="button"
                              key={l.id}
                              class="rounded bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-200 hover:bg-sky-700"
                              {...liveClick("card:move", {
                                cardId: cid,
                                toListId: l.id,
                              })}
                            >
                              {`→ ${l.title}`}
                            </button>
                          ))}
                      </div>
                    </article>
                  )
                })}
              </div>
              <form
                class="mt-auto flex flex-col gap-2"
                {...liveSubmit("card:add")}
              >
                <input
                  class="rounded-lg border-0 bg-slate-800 px-2 py-1.5 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
                  name="title"
                  placeholder="New card…"
                  autocomplete="off"
                />
                <input type="hidden" name="listId" value={list.id} />
                <button
                  type="submit"
                  class="rounded-lg bg-sky-500 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
                >
                  Add
                </button>
              </form>
            </section>
          ))}
        </div>
      </div>
    )
  })

  return app.raw
}
