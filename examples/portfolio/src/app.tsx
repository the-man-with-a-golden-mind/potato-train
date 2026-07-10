/**
 * Portfolio dashboard — createApp + typed Events + Tailwind.
 * Client mounts this app; data always comes from the server API.
 */
import {
  createApp as createTypedApp,
  defineFeature,
  combineState,
  asRawApp,
  type PotatoApp,
  type TypedPotatoApp,
} from "potato-train-core"
import {
  getPortfolio,
  totals,
  bySector,
  marketValue,
  gain,
  gainPct,
  type Portfolio,
} from "./data.js"

export type State = {
  portfolio: Portfolio
  stats: ReturnType<typeof totals>
  sectors: ReturnType<typeof bySector>
  tick: number
  status: string
  busy: boolean
}

export type Events = {
  "dash:refresh": []
  "dash:tick": []
  "dash:fetch": []
  "dash:loaded": [
    {
      portfolio: Portfolio
      stats: ReturnType<typeof totals>
      sectors: ReturnType<typeof bySector>
    },
  ]
  "dash:error": [message: string]
}

function snapshot() {
  const portfolio = getPortfolio()
  return {
    portfolio,
    stats: totals(portfolio),
    sectors: bySector(portfolio),
  }
}

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" })

function Kpi(props: { label: string; value: string; tone?: "up" | "down" }) {
  const tone =
    props.tone === "up"
      ? "text-emerald-400"
      : props.tone === "down"
        ? "text-rose-400"
        : "text-white"
  return (
    <div class="rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
      <div class="text-xs text-slate-400">{props.label}</div>
      <div class={`mt-1 text-xl font-bold ${tone}`}>{props.value}</div>
    </div>
  )
}

async function fetchPortfolio() {
  const res = await fetch("/api/portfolio")
  if (!res.ok) throw new Error(`portfolio ${res.status}`)
  return (await res.json()) as {
    portfolio: Portfolio
    stats: ReturnType<typeof totals>
    sectors: ReturnType<typeof bySector>
  }
}

async function postTick() {
  const res = await fetch("/api/portfolio/tick", { method: "POST" })
  if (!res.ok) throw new Error(`tick ${res.status}`)
  return (await res.json()) as {
    ok: boolean
    portfolio: Portfolio
    stats: ReturnType<typeof totals>
    sectors: ReturnType<typeof bySector>
  }
}

const dash = defineFeature<State, Events>({
  name: "portfolio",
  state: {
    ...snapshot(),
    tick: 0,
    status: "Ready",
    busy: false,
  },
  setup: ({ patch, on, get }) => {
    on("dash:loaded", (data) => {
      patch({
        portfolio: data.portfolio,
        stats: data.stats,
        sectors: data.sectors,
        tick: Date.now(),
        busy: false,
        status: `Updated ${new Date().toLocaleTimeString()}`,
      })
    })

    on("dash:error", (message) => {
      patch({ busy: false, status: `Error: ${message}` })
    })

    on("dash:fetch", async () => {
      if (get().busy) return
      patch({ busy: true, status: "Loading…" })
      try {
        const data = await fetchPortfolio()
        patch({
          portfolio: data.portfolio,
          stats: data.stats,
          sectors: data.sectors,
          tick: Date.now(),
          busy: false,
          status: `Loaded ${new Date().toLocaleTimeString()}`,
        })
      } catch (e) {
        patch({
          busy: false,
          status: `Error: ${e instanceof Error ? e.message : String(e)}`,
        })
      }
    })

    on("dash:refresh", () => {
      // Always hit the server — client module data is not shared with Node
      void (async () => {
        if (get().busy) return
        patch({ busy: true, status: "Refreshing…" })
        try {
          const data = await fetchPortfolio()
          patch({
            portfolio: data.portfolio,
            stats: data.stats,
            sectors: data.sectors,
            tick: Date.now(),
            busy: false,
            status: `Refreshed ${new Date().toLocaleTimeString()}`,
          })
        } catch (e) {
          patch({
            busy: false,
            status: `Error: ${e instanceof Error ? e.message : String(e)}`,
          })
        }
      })()
    })

    on("dash:tick", () => {
      void (async () => {
        if (get().busy) return
        patch({ busy: true, status: "Simulating tick…" })
        try {
          const data = await postTick()
          patch({
            portfolio: data.portfolio,
            stats: data.stats,
            sectors: data.sectors,
            tick: Date.now(),
            busy: false,
            status: `Tick applied ${new Date().toLocaleTimeString()}`,
          })
        } catch (e) {
          patch({
            busy: false,
            status: `Error: ${e instanceof Error ? e.message : String(e)}`,
          })
        }
      })()
    })
  },
})

const btnPrimary =
  "rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-50"
const btnGhost =
  "rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-50"

function buildApp(): TypedPotatoApp<State, Events> {
  const app = createTypedApp<State, Events>({ state: combineState(dash) })
  app.useFeature(dash)

  app.route("/", (state, emit) => {
    const { stats, sectors, portfolio } = state

    return (
      <div class="mx-auto max-w-5xl px-4 py-6 font-sans text-slate-100">
        <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-white">
              {portfolio.name}
            </h1>
            <p class="text-sm text-slate-400">
              Potato portfolio · Tailwind ·{" "}
              <span class="text-slate-500">{state.status}</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class={btnPrimary}
              disabled={state.busy}
              onclick={() => emit("dash:tick")}
            >
              Simulate tick
            </button>
            <button
              type="button"
              class={btnGhost}
              disabled={state.busy}
              onclick={() => emit("dash:refresh")}
            >
              Refresh
            </button>
          </div>
        </header>

        <section class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Total value" value={money(stats.total)} />
          <Kpi label="Invested" value={money(stats.invested)} />
          <Kpi label="Cash" value={money(stats.cash)} />
          <Kpi
            label="P&L"
            value={`${money(stats.pnl)} (${stats.pnlPct.toFixed(2)}%)`}
            tone={stats.pnl >= 0 ? "up" : "down"}
          />
        </section>

        <section class="grid gap-3 md:grid-cols-[1fr_1.4fr]">
          <div class="rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
            <h2 class="mb-3 text-sm font-semibold text-white">
              Allocation by sector
            </h2>
            <div class="space-y-3">
              {sectors.map((sec) => (
                <div key={sec.sector}>
                  <div class="mb-1 flex justify-between text-sm">
                    <span>{sec.sector}</span>
                    <span class="text-slate-400">{sec.pct.toFixed(1)}%</span>
                  </div>
                  <div class="h-2.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-amber-400 to-sky-400"
                      style={{ width: `${sec.pct}%` }}
                    />
                  </div>
                  <div class="mt-0.5 text-xs text-slate-500">
                    {money(sec.value)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class="rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
            <h2 class="mb-3 text-sm font-semibold text-white">Holdings</h2>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-slate-800 text-slate-400">
                    <th class="py-2 pr-2 font-semibold">Symbol</th>
                    <th class="py-2 pr-2 font-semibold">Shares</th>
                    <th class="py-2 pr-2 font-semibold">Price</th>
                    <th class="py-2 pr-2 font-semibold">Value</th>
                    <th class="py-2 font-semibold">Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.holdings.map((hold) => {
                    const g = gain(hold)
                    return (
                      <tr
                        key={hold.symbol}
                        class="border-b border-slate-800/80"
                      >
                        <td class="py-2.5 pr-2 align-top">
                          <strong class="text-white">{hold.symbol}</strong>
                          <div class="text-xs text-slate-500">{hold.name}</div>
                        </td>
                        <td class="py-2.5 pr-2">{hold.shares}</td>
                        <td class="py-2.5 pr-2">{money(hold.price)}</td>
                        <td class="py-2.5 pr-2">{money(marketValue(hold))}</td>
                        <td
                          class={
                            "py-2.5 " +
                            (g >= 0 ? "text-emerald-400" : "text-rose-400")
                          }
                        >
                          {`${money(g)} (${gainPct(hold).toFixed(1)}%)`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    )
  })

  return app
}

/** SSR / createServer: raw app (no browser handlers until client mounts) */
export function createApp(): PotatoApp {
  return asRawApp(buildApp())
}

/** Browser: typed app for mount */
export function createBrowserApp(): TypedPotatoApp<State, Events> {
  return buildApp()
}
