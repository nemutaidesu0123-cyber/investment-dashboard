// src/lib/priceApi.ts
import { Price } from "./price"

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY!

// Alpha Vantageのレスポンス型
type AlphaVantageResponse = {
  "Time Series (Daily)"?: {
    [date: string]: {
      "1. open": string
      "2. high": string
      "3. low": string
      "4. close": string
      "5. volume": string
    }
  }
  [key: string]: any
  "Error Message"?: string
  "Note"?: string // レート制限のメッセージ
}
// カスタムエラークラス
export class PriceApiError extends Error {
  // エラーコードをオプションで追加
  constructor(message: string, public code?: string) {
    super(message)
    this.name = "PriceApiError"
  }
}

// 日足データを取得する非同期関数
export async function fetchDailyPrices(symbol: string): Promise<Price[]> {
  // APIキーの存在チェック
  if (!API_KEY) {
    throw new PriceApiError("API key is not configured")
  }

  const url =
    "https://www.alphavantage.co/query" +
    `?function=TIME_SERIES_DAILY` +
    `&symbol=${encodeURIComponent(symbol)}` + // URLエンコード追加
    `&apikey=${API_KEY}`

  try {
    // APIリクエストを送信
    const res = await fetch(url)
    
    // HTTPステータスコードのチェック
    if (!res.ok) {
      throw new PriceApiError(
        `HTTP error: ${res.status} ${res.statusText}`,
        "HTTP_ERROR"
      )
    }

    // レスポンスをJSON形式で解析
    const json: AlphaVantageResponse = await res.json()

    // エラーメッセージのチェック
    if (json["Error Message"]) {
      throw new PriceApiError(
        `Invalid symbol: ${symbol}`,
        "INVALID_SYMBOL"
      )
    }

    // レート制限のチェック
    if (json["Note"]) {
      throw new PriceApiError(
        "API rate limit reached",
        "RATE_LIMIT"
      )
    }

    // 日足データの取得
    const series = json["Time Series (Daily)"]
    
    // データが存在しない場合のエラーハンドリング
    if (!series) {
      throw new PriceApiError(
        `No data available for symbol: ${symbol}`,
        "NO_DATA"
      )
    }

    // 価格データの配列を作成
    // Object.keys(series)で日付の配列を取得し、日付ごとにmapでPriceオブジェクトに変換
    const prices: Price[] = Object.keys(series).map((date) => ({
      symbol,
      date,
      price: Number(series[date]["4. close"]), // その日の終値をNmber型に変換して使用
    }))
    // 作成した価格データの配列を返す
    return prices
  } catch (error) {
    // 既にPriceApiErrorの場合はそのままスロー
    if (error instanceof PriceApiError) {
      throw error
    }
    // その他のエラーはFETCH_ERRORとしてラップしてスロー
    throw new PriceApiError(
      `Failed to fetch prices: ${error instanceof Error ? error.message : String(error)}`,
      "FETCH_ERROR"
    )
  }
}

// 分足データは有料のためコメントアウト
// export async function fetchIntraDayPrices(symbol: string, interval: "1min" | "5min" | "15min" | "30min" | "60min"): Promise<Price[]> {
//   if (!API_KEY) {
//     throw new PriceApiError("API key is not configured")
//   }

//   const key = `Time Series (${interval})`

//   const url =
//     "https://www.alphavantage.co/query" +
//     `?function=TIME_SERIES_INTRADAY` +
//     `&symbol=${encodeURIComponent(symbol)}` + // URLエンコード追加
//     `&interval=${interval}` +
//     `&apikey=${API_KEY}`

//   try {
//     const res = await fetch(url)
    
//     if (!res.ok) {
//       throw new PriceApiError(
//         `HTTP error: ${res.status} ${res.statusText}`,
//         "HTTP_ERROR"
//       )
//     }

//     const json: AlphaVantageResponse = await res.json()

//     console.log("🔍 Intraday API Response keys:", Object.keys(json))
//     console.log("🔍 Looking for key:", key)
//     console.log("🔍 First 500 chars:", JSON.stringify(json).substring(0, 500))

//     // エラーメッセージのチェック
//     if (json["Error Message"]) {
//       throw new PriceApiError(
//         `Invalid symbol: ${symbol}`,
//         "INVALID_SYMBOL"
//       )
//     }

//     // レート制限のチェック
//     if (json["Note"]) {
//       throw new PriceApiError(
//         "API rate limit reached",
//         "RATE_LIMIT"
//       )
//     }

//     const series = json[key]
    
//     if (!series) {
//       throw new PriceApiError(
//         `No data available for symbol: ${symbol}`,
//         "NO_DATA"
//       )
//     }

//     const prices: Price[] = Object.keys(series).map((date) => ({
//       symbol,
//       date,
//       price: Number(series[date]["4. close"]),
//     }))

//     return prices
//   } catch (error) {
//     if (error instanceof PriceApiError) {
//       throw error
//     }
    
//     throw new PriceApiError(
//       `Failed to fetch prices: ${error instanceof Error ? error.message : String(error)}`,
//       "FETCH_ERROR"
//     )
//   }
// }