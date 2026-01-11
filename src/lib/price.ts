// src/lib/price.ts
export type Currency = "USD" | "JPY"

export type Price = {
  symbol: string // ティッカー名
  price: number // 価格
  date: string // 取得日時
}

export type ChartPoint = {
  x: string  // 日付
  y: number  // 価格
}

export function pricesToChartData(prices: Price[]): ChartPoint[] {
  // 日付順に並べる
  const sorted = [...prices].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  // 必要な形にする
  return sorted.map((p) => ({
    x: p.date,
    y: p.price,
  }))
}

export function toWeekly(prices: Price[]): Price[] {
  const map = new Map<string, Price[]>()

  for (const p of prices) {
    const d = parseDate(p.date)
    const key = getWeekKey(d)

    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(p)
  }

  return Array.from(map.values()).map(group => {
    // 日付順に並べて「最後」を取る
    const sorted = group.sort(
      (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
    )

    return sorted[sorted.length - 1]
  })
}

export function toMonthly(prices: Price[]): Price[] {
  const map = new Map<string, Price[]>()

  for (const p of prices) {
    const d = parseDate(p.date)
    const key = getMonthKey(d)

    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(p)
  }

  return Array.from(map.values()).map(group => {
    const sorted = group.sort(
      (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
    )

    return sorted[sorted.length - 1]
  })
}

function parseDate(date: string): Date {
  // "YYYY-MM-DD" 専用
  return new Date(date + "T00:00:00")
}

function getWeekKey(date: Date): string {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = (day + 6) % 7 // Mon=0
  d.setDate(d.getDate() - diff)

  return d.toISOString().slice(0, 10) // 週の月曜
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}