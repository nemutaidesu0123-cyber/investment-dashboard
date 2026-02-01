// app/api/prices/route.ts
import { NextRequest, NextResponse } from "next/server"
import YahooFinance from "yahoo-finance2"
import { Price, toMonthly, toWeekly } from "@/src/lib/price"

const yahooFinance = new YahooFinance()

// カスタムエラークラス
class YahooFinanceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = "YahooFinanceError"
  }
}

// 🆕 日本株判定関数
function isJapaneseStock(symbol: string): boolean {
  // .T (東証), .JP (その他日本市場) で終わる、または4桁数字のみ
  return symbol.endsWith('.T') || 
         symbol.endsWith('.JP') ||
         /^\d{4}$/.test(symbol)
}

// 🆕 日本株のティッカー正規化
function normalizeJapaneseSymbol(symbol: string): string {
  // 4桁数字のみの場合は .T を追加（東証プライム）
  if (/^\d{4}$/.test(symbol)) {
    return `${symbol}.T`
  }
  return symbol
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  let symbol = searchParams.get("symbol")
  const timeframe = searchParams.get("timeframe") ?? "daily"
  
  if (!symbol) {
    console.error("❌ Missing symbol parameter")
    return NextResponse.json(
      { error: "symbol is required" },
      { status: 400 }
    )
  }

  // 🆕 日本株の場合はシンボルを正規化
  const isJP = isJapaneseStock(symbol)
  if (isJP) {
    symbol = normalizeJapaneseSymbol(symbol)
    console.log(`🇯🇵 Japanese stock detected: ${symbol}`)
  } else {
    console.log(`🇺🇸 US stock detected: ${symbol}`)
  }

  console.log("📊 API Request:", { symbol, timeframe, region: isJP ? 'JP' : 'US' })

  try {
    console.log(`📈 Fetching prices for ${symbol}...`)
    
    // Yahoo Financeから過去3年分のデータを取得
    const now = new Date()
    const past = new Date()
    past.setFullYear(past.getFullYear() - 3)

    const result: any = await yahooFinance.historical(symbol, {
      period1: past,
      period2: now,
      interval: "1d",
    })

    if (!result || result.length === 0) {
      throw new YahooFinanceError(
        `No data available for symbol: ${symbol}`,
        "NO_DATA"
      )
    }

    // Yahoo Financeのデータを統一フォーマットに変換
    const allPrices: Price[] = result.map((item: any) => ({
      symbol,
      date: item.date.toISOString().split("T")[0],
      price: item.close,
    }))

    console.log(`✅ Total prices: ${allPrices.length}`)

    // timeframeごとに変換
    let finalResult: Price[]
    switch (timeframe) {
      case "weekly":
        finalResult = toWeekly(allPrices)
        console.log(`📈 Weekly points: ${finalResult.length}`)
        break
      case "monthly":
        finalResult = toMonthly(allPrices)
        console.log(`📈 Monthly points: ${finalResult.length}`)
        break
      default:
        finalResult = allPrices
    }

    return NextResponse.json(finalResult)
  } catch (error) {
    console.error("❌ API Error:", error)
    
    if (error instanceof YahooFinanceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "RATE_LIMIT" ? 429 : 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    )
  }
}