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

// Price配列をチャート用データに変換する関数
export function pricesToChartData(prices: Price[]): ChartPoint[] {
  // 日付順に並べる
  // (a,b)にはPrice[]のdateが入り、aがbより前なら負の値、後なら正の値、同じなら0を返す比較関数
  // 負の値（a - b < 0）: a を b の前に配置。
  // 正の値（a - b > 0）: b を a の前に配置。
  // 0: 並び順を変更しない。
  const sorted = [...prices].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  // 必要な形にする（sortedから日付と価格を抽出）
  return sorted.map((p) => ({
    x: p.date,
    y: p.price,
  }))
}

// 日足データを週足データに変換する関数
export function toWeekly(prices: Price[]): Price[] {
  // 週ごとに価格をグループ化
  const map = new Map<string, Price[]>()

  // 価格データをループ
  for (const p of prices) {
    // 日付を解析
    const d = parseDate(p.date)
    // 取得した日付の週のキー（月曜日の日付）を取得
    const key = getWeekKey(d)

    // キーが存在しなければ初期化
    if (!map.has(key)) {
      map.set(key, [])
    }
    // 価格データを追加
    map.get(key)!.push(p)
  }

  // 各週の最後の価格データを取得して配列で返す
  return Array.from(map.values()).map(group => {
    // 日付順に並べて「最後」を取る
    const sorted = group.sort(
      (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
    )

    return sorted[sorted.length - 1]
  })
}

// 日足データを月足データに変換する関数
export function toMonthly(prices: Price[]): Price[] {
  // 月ごとに価格をグループ化
  const map = new Map<string, Price[]>()

  // 価格データをループ  
  for (const p of prices) {
    // 日付を解析
    const d = parseDate(p.date)
    // 取得した日付の月のキー（YYYY-MM）を取得
    const key = getMonthKey(d)

    // キーが存在しなければ初期化
    if (!map.has(key)) {
      map.set(key, [])
    }
    // 価格データを追加
    map.get(key)!.push(p)
  }
  // 各月の最後の価格データを取得して配列で返す
  return Array.from(map.values()).map(group => {
    const sorted = group.sort(
      (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
    )
    // 月の最後の日のデータを返す
    return sorted[sorted.length - 1]
  })
}

function parseDate(date: string): Date {
  // "YYYY-MM-DD" 専用
  return new Date(date + "T00:00:00")
}

// 週のキーを取得する関数（その週の月曜日の日付文字列を返す）
function getWeekKey(date: Date): string {
  // その日の曜日を取得（0=日曜, 1=月曜, ..., 6=土曜）
  const d = new Date(date)
  // 月曜日に移動
  const day = d.getDay() // 0=Sun
  // (day + 6) % 7 で Mon=0, Tue=1, ..., Sun=6 に変換
  // 月曜日を基準にしたインデックスを計算:
  const diff = (day + 6) % 7 // Mon=0
  // 月曜日の日付に設定
  d.setDate(d.getDate() - diff)

  // "YYYY-MM-DD" 形式で返す
  return d.toISOString().slice(0, 10) // 週の月曜
}

function getMonthKey(date: Date): string {
  // 日付の年と月を取得し、月のインデックスに1を足して人間が認識している月に変換してpadで2桁に整形してリターン（YYYY-MM）
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

// 価格データから統計を計算
export function calculateStats(prices: Price[]) {
  // 価格データがなければnullを返す
  if (prices.length === 0) {
    return null
  }

  // Price配列から価格のみの配列を抽出
  const priceValues = prices.map(p => p.price)
  // 最高価格、最安価格、変動幅、変動幅の割合を計算
  const maxPrice = Math.max(...priceValues)
  const minPrice = Math.min(...priceValues)
  const priceRange = maxPrice - minPrice
  const priceRangePercent = (priceRange / maxPrice) * 100

  // prices配列から最高価格のPriceオブジェクトと最安価格のPriceオブジェクトを取得
  const maxPriceItem = prices.reduce((max, current) => {
    return current.price > max.price ? current : max
  })
  const minPriceItem = prices.reduce((min, current) => {
    return current.price < min.price ? current : min
  })

  return {
    maxPrice,
    maxPriceDate: maxPriceItem.date,
    minPrice,
    minPriceDate: minPriceItem.date,
    priceRange,
    priceRangePercent
  }
}