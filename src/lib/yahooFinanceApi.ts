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
  symbol: string
  returnOnEquity: number
  marketCap: number
  revenue: number
  totalCash: number
  operatingCashflow: number
  per: number
  pbr: number
  roa: number
  equityRatio: number
  eps: number
  // 🆕 追加
  fiftyTwoWeekLow: number
  fiftyTwoWeekHigh: number
  revenueGrowth: number  // Yahoo Financeの直近成長率
  earningsGrowth: number
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
      symbol: symbol,
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
      // 🆕 追加
      fiftyTwoWeekLow: summaryDetail.fiftyTwoWeekLow || 0,
      fiftyTwoWeekHigh: summaryDetail.fiftyTwoWeekHigh || 0,
      revenueGrowth: financialData.revenueGrowth || 0,
      earningsGrowth: financialData.earningsGrowth || 0,
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

// 🆕 スクリーニング関数に通貨パラメータを追加
export function screenStocks(
  stats: StockStats[], 
  currency: 'USD' | 'JPY' = 'USD'
): ScreeningResult[] {
  return stats.map((stat) => {
    const isJPY = currency === 'JPY';
    
    // 時価総額（円建ての場合は億円単位で判定）
    const marketCap = stat.marketCap;
    let marketCapRating: string;
    
  if (isJPY) {
    // 日本円：500億〜5兆円が理想（テンバガー候補レンジ）
    const marketCapInOku = marketCap / 1e8;
    if (marketCapInOku >= 5000 && marketCapInOku <= 50000) {
      marketCapRating = '◎';
    } else if (marketCapInOku >= 1000 && marketCapInOku <= 150000) {
      marketCapRating = '〇';
    } else if (marketCapInOku >= 500 && marketCapInOku <= 1000) {
      marketCapRating = '△';
    } else {
      marketCapRating = '×';
    }
  } else {
    // 米ドル：50億〜500億ドルが理想
    const marketCapInBillion = marketCap / 1e9;
    if (marketCapInBillion >= 50 && marketCapInBillion <= 500) {
      marketCapRating = '◎';
    } else if (marketCapInBillion >= 10 && marketCapInBillion <= 1000) {
      marketCapRating = '〇';
    } else if (marketCapInBillion >= 5 && marketCapInBillion <= 10) {
      marketCapRating = '△';
    } else {
      marketCapRating = '×';
    }
  }

    // ROE
    const roe = (stat.returnOnEquity || 0) * 100;
    const roeRating = roe >= 15 ? '◎' : roe >= 10 ? '〇' : roe >= 5 ? '△' : '×';

    // PSR
    const psr = stat.revenue > 0 ? stat.marketCap / stat.revenue : 0;
    const psrRating = psr < 1 ? '◎' : psr < 2 ? '〇' : psr < 3 ? '△' : '×';

    // キャッシュリッチ度
    const cashRich = stat.marketCap > 0 ? (stat.totalCash / stat.marketCap) * 100 : 0;
    const cashRichRating = cashRich > 50 ? '◎' : cashRich > 20 ? '〇' : cashRich > 10 ? '△' : '×';

    // 営業CF
    const positiveCF = stat.marketCap > 0 ? (stat.operatingCashflow / stat.marketCap) * 100 : 0;
    const positiveCFRating = positiveCF > 0 ? '◎' : positiveCF > -10 ? '〇' : positiveCF > -20 ? '△' : '×';

    // PER
    const per = stat.per || 0;
    const perRating = per > 0 && per <= 15 ? '◎' : per <= 20 ? '〇' : per <= 30 ? '△' : '×';

    // PBR
    const pbr = stat.pbr || 0;
    const pbrRating = pbr < 1 ? '◎' : pbr < 2 ? '〇' : pbr < 3 ? '△' : '×';

    // ROA
    const roa = (stat.roa || 0) * 100;
    const roaRating = roa >= 8 ? '◎' : roa >= 5 ? '〇' : roa >= 3 ? '△' : '×';

    // 自己資本比率
    const equityRatio = stat.equityRatio || 0;
    const equityRatioRating = equityRatio >= 60 ? '◎' : equityRatio >= 40 ? '〇' : equityRatio >= 20 ? '△' : '×';

    // 🆕 EPS（通貨対応）
    const eps = stat.eps || 0;
    let epsRating: string;
    
    if (isJPY) {
      // 日本円：100円以上が理想
      epsRating = eps >= 100 ? '◎' : eps >= 50 ? '〇' : eps >= 10 ? '△' : '×';
    } else {
      // 米ドル：1ドル以上が理想
      epsRating = eps >= 1 ? '◎' : eps >= 0.5 ? '〇' : eps >= 0.1 ? '△' : '×';
    }

    return {
      symbol: stat.symbol,
      marketCap: marketCapRating,
      roe: roeRating,
      psr: psrRating,
      cashRich: cashRichRating,
      positiveCF: positiveCFRating,
      per: perRating,
      pbr: pbrRating,
      roa: roaRating,
      equityRatio: equityRatioRating,
      eps: epsRating,
    };
  });
}