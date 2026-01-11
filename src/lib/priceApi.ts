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

export class PriceApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = "PriceApiError"
  }
}

export async function fetchDailyPrices(symbol: string): Promise<Price[]> {
  if (!API_KEY) {
    throw new PriceApiError("API key is not configured")
  }

  const url =
    "https://www.alphavantage.co/query" +
    `?function=TIME_SERIES_DAILY` +
    `&symbol=${encodeURIComponent(symbol)}` + // URLエンコード追加
    `&apikey=${API_KEY}`

  try {
    const res = await fetch(url)
    
    if (!res.ok) {
      throw new PriceApiError(
        `HTTP error: ${res.status} ${res.statusText}`,
        "HTTP_ERROR"
      )
    }

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

    const series = json["Time Series (Daily)"]
    
    if (!series) {
      throw new PriceApiError(
        `No data available for symbol: ${symbol}`,
        "NO_DATA"
      )
    }

    const prices: Price[] = Object.keys(series).map((date) => ({
      symbol,
      date,
      price: Number(series[date]["4. close"]),
    }))

    return prices
  } catch (error) {
    if (error instanceof PriceApiError) {
      throw error
    }
    
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