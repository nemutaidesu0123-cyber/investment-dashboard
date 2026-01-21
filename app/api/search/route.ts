// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server"
import YahooFinance from "yahoo-finance2"

const yahooFinance = new YahooFinance()

// 検索結果の型
type StockSearchResult = {
  symbol: string
  name: string
  exchange?: string
  type?: string
}

// HTTP の GET リクエストを処理する非同期関数を定義
export async function GET(request: NextRequest) {
  // リクエストのURLから検索パラメータを取得
  const { searchParams } = new URL(request.url)
  // 検索パラメータの中から'keywords'の値を取得、存在しない場合は空文字列を使用
  const keywords = searchParams.get("keywords") || ""

  // キーワードが空の場合は空配列を返す
  if (!keywords.trim()) {
    return NextResponse.json([])
  }

  try {
    console.log("🔍 Searching for:", keywords)

    // Yahoo Financeで検索を実行
    const results: any = await yahooFinance.search(keywords, {
      quotesCount: 10,
      newsCount: 0,
    })

    console.log("✅ Search results:", results.quotes?.length || 0)

    // 検索結果を整形
    const stockResults: StockSearchResult[] = (results.quotes || [])
      .filter((quote: any) => quote.symbol && quote.shortname)
      .map((quote: any) => ({
        symbol: quote.symbol,
        name: quote.shortname || quote.longname || quote.symbol,
        exchange: quote.exchange,
        type: quote.quoteType,
      }))

    // 取得した結果をJSON形式でHTTPレスポンスとして返す
    return NextResponse.json(stockResults)
  } catch (error) {
    console.error("❌ Search error:", error)
    // エラーが発生しても空配列を返す（ユーザー体験を損なわないため）
    return NextResponse.json([])
  }
}