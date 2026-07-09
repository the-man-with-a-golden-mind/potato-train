export interface Holding {
  symbol: string
  name: string
  shares: number
  cost: number
  price: number
  sector: string
}

export interface Portfolio {
  id: string
  name: string
  cash: number
  holdings: Holding[]
  updatedAt: number
}

const portfolio: Portfolio = {
  id: "main",
  name: "Growth Book",
  cash: 12_450.32,
  updatedAt: Date.now(),
  holdings: [
    { symbol: "AAPL", name: "Apple", shares: 40, cost: 150, price: 198.4, sector: "Tech" },
    { symbol: "MSFT", name: "Microsoft", shares: 25, cost: 280, price: 420.1, sector: "Tech" },
    { symbol: "NVDA", name: "NVIDIA", shares: 15, cost: 400, price: 875.2, sector: "Tech" },
    { symbol: "JNJ", name: "J&J", shares: 30, cost: 155, price: 148.6, sector: "Health" },
    { symbol: "XOM", name: "Exxon", shares: 50, cost: 95, price: 112.3, sector: "Energy" },
    { symbol: "VTI", name: "Total Market", shares: 80, cost: 200, price: 262.5, sector: "ETF" },
  ],
}

export function getPortfolio(): Portfolio {
  return portfolio
}

export function marketValue(h: Holding): number {
  return h.shares * h.price
}

export function gain(h: Holding): number {
  return (h.price - h.cost) * h.shares
}

export function gainPct(h: Holding): number {
  return ((h.price - h.cost) / h.cost) * 100
}

export function totals(p: Portfolio) {
  const invested = p.holdings.reduce((a, h) => a + marketValue(h), 0)
  const costBasis = p.holdings.reduce((a, h) => a + h.cost * h.shares, 0)
  const total = invested + p.cash
  return {
    invested,
    costBasis,
    cash: p.cash,
    total,
    pnl: invested - costBasis,
    pnlPct: costBasis ? ((invested - costBasis) / costBasis) * 100 : 0,
  }
}

export function bySector(p: Portfolio): Array<{ sector: string; value: number; pct: number }> {
  const map = new Map<string, number>()
  for (const h of p.holdings) {
    map.set(h.sector, (map.get(h.sector) ?? 0) + marketValue(h))
  }
  const invested = [...map.values()].reduce((a, b) => a + b, 0) || 1
  return [...map.entries()]
    .map(([sector, value]) => ({
      sector,
      value,
      pct: (value / invested) * 100,
    }))
    .sort((a, b) => b.value - a.value)
}

/** Simulate a live price tick */
export function tickPrices(): Portfolio {
  for (const h of portfolio.holdings) {
    const delta = 1 + (Math.random() - 0.5) * 0.01
    h.price = Math.round(h.price * delta * 100) / 100
  }
  portfolio.updatedAt = Date.now()
  return portfolio
}

export function updateHolding(
  symbol: string,
  patch: Partial<Pick<Holding, "shares" | "price" | "cost">>,
): Portfolio {
  const h = portfolio.holdings.find((x) => x.symbol === symbol)
  if (h) Object.assign(h, patch)
  portfolio.updatedAt = Date.now()
  return portfolio
}
