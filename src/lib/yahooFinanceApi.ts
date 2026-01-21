// src/lib/yahooFinanceApi.ts
import YahooFinance from "yahoo-finance2"
import { Price } from "./price"

const yahooFinance = new YahooFinance()

// タイムアウト付きPromiseラッパー
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// カスタムエラークラス
export class YahooFinanceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = "YahooFinanceError"
  }
}

// 検索結果の型
export type StockSearchResult = {
  symbol: string
  name: string
  exchange?: string
  type?: string
}

// 財務指標の型
export interface StockStats {
  returnOnEquity: number
  marketCap: number
  revenue: number
  totalCash: number
  operatingCashflow: number
  per: number  // PER
  pbr: number  // PBR
  roa: number  // ROA
  equityRatio: number  // 自己資本比率
  eps: number  // EPS
}

// スクリーニング結果の型（時価総額を追加）
export interface ScreeningResult {
  marketCap: string  // 時価総額を追加
  roe: string
  psr: string
  cashRich: string
  positiveCF: string
  per: string
  pbr: string
  roa: string
  equityRatio: string
  eps: string
}

/**
 * シンボル検索
 * キーワードに基づいて株式シンボルを検索
 */
export async function searchSymbols(
  keywords: string
): Promise<StockSearchResult[]> {
  // キーワードが空の場合は空配列を返す
  if (!keywords.trim()) {
    return []
  }

  try {
    console.log("🔍 Searching for:", keywords)

    const results: any = await withTimeout(
      yahooFinance.search(keywords, {
        quotesCount: 10,
        newsCount: 0,
      }),
      8000 // 8秒タイムアウト
    )
    console.log("✅ Search results:", results.quotes?.length || 0)

    // 検索結果を整形して返す
    return (results.quotes || [])
      .filter((quote: any) => quote.symbol && quote.shortname)
      .map((quote: any) => ({
        symbol: quote.symbol,
        name: quote.shortname || quote.longname || quote.symbol,
        exchange: quote.exchange,
        type: quote.quoteType,
      }))
  } catch (error) {
    console.error("❌ Search error:", error)
    // エラーが発生しても空配列を返す（ユーザー体験を損なわないため）
    return []
  }
}

/**
 * 日足データ取得
 * 過去3年分の日足データを取得
 */
export async function fetchDailyPrices(symbol: string): Promise<Price[]> {
  try {
    console.log(`📊 Fetching daily prices for ${symbol}`)

    const now = new Date()
    const past = new Date()
    past.setFullYear(past.getFullYear() - 3)

    const result: any = await withTimeout(
      yahooFinance.historical(symbol, {
        period1: past,
        period2: now,
        interval: "1d",
      }),
      15000 // 15秒タイムアウト
    )

    if (!result || result.length === 0) {
      throw new YahooFinanceError(
        `No data available for symbol: ${symbol}`,
        "NO_DATA"
      )
    }

    const prices: Price[] = result.map((item: any) => ({
      symbol,
      date: item.date.toISOString().split("T")[0],
      price: item.close,
    }))

    console.log(`✅ Fetched ${prices.length} prices for ${symbol}`)
    return prices
  } catch (error) {
    if (error instanceof YahooFinanceError) {
      throw error
    }

    throw new YahooFinanceError(
      `Failed to fetch prices for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
      "FETCH_ERROR"
    )
  }
}

/**
 * 財務指標取得
 * ROE、時価総額、売上高などの財務データを取得
 */
export async function fetchStockStats(symbol: string): Promise<StockStats> {
  try {
    console.log(`📈 Fetching stats for ${symbol}`)

    const quote: any = await withTimeout(
      yahooFinance.quoteSummary(symbol, {
        modules: ["financialData", "defaultKeyStatistics", "summaryDetail"],
      }),
      15000 // 15秒タイムアウト
    )

    if (!quote) {
      throw new YahooFinanceError(
        `No quote data available for ${symbol}`,
        "NO_DATA"
      )
    }

    console.log('🔍 Available fields:')
    console.log('financialData keys:', Object.keys(quote.financialData || {}))
    console.log('defaultKeyStatistics keys:', Object.keys(quote.defaultKeyStatistics || {}))
    console.log('summaryDetail keys:', Object.keys(quote.summaryDetail || {}))

    const financialData = quote.financialData || {}
    const keyStats = quote.defaultKeyStatistics || {}
    const summaryDetail = quote.summaryDetail || {}

    // 自己資本比率の計算
    const debtToEquityRaw = financialData.debtToEquity || 0
    const calculatedEquityRatio = debtToEquityRaw > 0 
      ? (1 / (1 + debtToEquityRaw / 100)) * 100 
      : 100

    const stats: StockStats = {
      returnOnEquity: financialData.returnOnEquity || 0,
      marketCap: summaryDetail.marketCap || 0,
      revenue: financialData.totalRevenue || 0,
      totalCash: financialData.totalCash || 0,
      operatingCashflow: financialData.operatingCashflow || 0,
      per: summaryDetail.trailingPE || 0,
      pbr: keyStats.priceToBook || 0,
      roa: financialData.returnOnAssets || 0,
      equityRatio: calculatedEquityRatio,
      eps: keyStats.trailingEps || 0,
    }

    console.log(`✅ Fetched stats for ${symbol}`)
    return stats
  } catch (error) {
    throw new YahooFinanceError(
      `Failed to fetch stats for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
      "FETCH_STATS_ERROR"
    )
  }
}

/**
 * 銘柄スクリーニング
 * 財務指標に基づいて銘柄を評価（時価総額評価を追加）
 */
export function screenStocks(stats: StockStats[]): ScreeningResult[] {
  return stats.map((stock) => {
    // 時価総額の評価（10億ドル = 1B = 約1300億円）
    const marketCapInBillions = stock.marketCap / 1e9;
    const marketCap =
      marketCapInBillions >= 10 && marketCapInBillions <= 100
        ? "◎"  // 100-500億ドル（理想的なテンバガーレンジ）
        : marketCapInBillions >= 5 && marketCapInBillions <= 200
          ? "○"  // 50-1000億ドル（許容範囲）
          : marketCapInBillions >= 1 && marketCapInBillions < 5
            ? "△"  // 10-50億ドル（小型株、リスク高）
            : "×"; // それ以外（大型すぎるor小さすぎる）

    // ROE（自己資本利益率）の評価
    const roe =
      stock.returnOnEquity > 15
        ? "◎"
        : stock.returnOnEquity > 10
          ? "〇"
          : stock.returnOnEquity > 5
            ? "△"
            : "×"

    // PSR（株価売上高倍率）の評価
    const psr =
      stock.marketCap / stock.revenue < 1
        ? "◎"
        : stock.marketCap / stock.revenue < 2
          ? "〇"
          : stock.marketCap / stock.revenue < 3
            ? "△"
            : "×"

    // キャッシュリッチ度の評価
    const cashRich =
      stock.totalCash > stock.marketCap * 0.4
        ? "◎"
        : stock.totalCash > stock.marketCap * 0.2
          ? "〇"
          : stock.totalCash > stock.marketCap * 0.1
            ? "△"
            : "×"

    // 営業キャッシュフローの評価
    const positiveCF =
      stock.operatingCashflow > 0
        ? "◎"
        : stock.operatingCashflow > -0.1 * stock.marketCap
          ? "〇"
          : stock.operatingCashflow > -0.2 * stock.marketCap
            ? "△"
            : "×"

    // PER（株価収益率）の評価
    const per =
      stock.per > 0 && stock.per <= 15
        ? "◎"
        : stock.per > 15 && stock.per <= 20
          ? "〇"
          : stock.per > 20 && stock.per <= 30
            ? "△"
            : "×"

    // PBR（株価純資産倍率）の評価
    const pbr =
      stock.pbr > 0 && stock.pbr < 1
        ? "◎"
        : stock.pbr >= 1 && stock.pbr < 2
          ? "〇"
          : stock.pbr >= 2 && stock.pbr < 3
            ? "△"
            : "×"

    // ROA（総資産利益率）の評価
    const roa =
      stock.roa >= 5
        ? "◎"
        : stock.roa >= 3
          ? "〇"
          : stock.roa >= 1
            ? "△"
            : "×"

    // 自己資本比率の評価
    const equityRatio =
      stock.equityRatio >= 60
        ? "◎"
        : stock.equityRatio >= 40
          ? "〇"
          : stock.equityRatio >= 20
            ? "△"
            : "×"

    // EPS（1株当たり利益）の評価
    const eps =
      stock.eps >= 1
        ? "◎"
        : stock.eps >= 0.5
          ? "〇"
          : stock.eps >= 0.1
            ? "△"
            : "×"

    return {
      marketCap, // 時価総額を追加
      roe,
      psr,
      cashRich,
      positiveCF,
      per,
      pbr,
      roa,
      equityRatio,
      eps,
    }
  })
}