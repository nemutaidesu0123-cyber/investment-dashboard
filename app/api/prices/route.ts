// app/api/prices/route.ts
import { NextRequest, NextResponse } from "next/server"
import { fetchDailyPrices, PriceApiError } from "@/src/lib/priceApi"
import { Price, toMonthly, toWeekly } from "@/src/lib/price"

type IntradayInterval = "1min" | "5min" | "15min" | "30min" | "60min"
const intradayIntervals = ["1min", "5min", "15min", "30min", "60min"]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get("symbol")
  const timeframe = searchParams.get("timeframe") ?? "daily"
  console.log("API Request:", { symbol, timeframe }) // デバッグログ

  if (!symbol) {
    console.error("Missing symbol parameter")
    return NextResponse.json(
      { error: "symbol is required" },
      { status: 400 }
    )
  }

  try {
    console.log(`Fetching prices for ${symbol}...`)
    
    // 期間でフィルタリング
    const fromDate = calcFromDate(timeframe)
    console.log(`Filtering from date: ${fromDate.toISOString()}`)
    // timeframeごとに変換
    let result: Price[]
    
    // if (intradayIntervals.includes(timeframe)) {
      // 分足の場合の処理（有料のためコメントアウト）
      // result = await fetchIntraDayPrices(symbol, timeframe as IntradayInterval)
    // } else {
      const allPrices = await fetchDailyPrices(symbol)
      console.log(`Received ${allPrices.length} prices`)
      const filteredPrices = allPrices.filter((p) => {
        return new Date(p.date) >= fromDate
      })
      console.log(`After filtering: ${filteredPrices.length} prices`)
      switch (timeframe) {
        case "weekly":
          result = toWeekly(filteredPrices)
          console.log(`After weekly conversion: ${result.length} prices`)
          break
        case "monthly":
          result = toMonthly(filteredPrices)
          console.log(`After monthly conversion: ${result.length} prices`)
          break
        default:
          result = filteredPrices
      }
   // } 

    return NextResponse.json(result)
  } catch (error) {
    console.error("API Error:", error)
    
    if (error instanceof PriceApiError) {
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

function calcFromDate(timeframe: string): Date {
  const now = new Date()

  switch (timeframe) {
    case "daily":
      now.setMonth(now.getMonth() - 3)
      return now

    case "weekly":
      now.setFullYear(now.getFullYear() - 1)
      return now

    case "monthly":
      now.setFullYear(now.getFullYear() - 3)
      return now

    default:
      now.setMonth(now.getMonth() - 3)
      return now
  }
}