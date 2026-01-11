// src/lib/searchApi.ts（新規ファイル）
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY

export type StockSearchResult = {
  symbol: string
  name: string
}

export async function searchSymbols(keywords: string): Promise<StockSearchResult[]> {
  if (!keywords.trim()) {
    return []
  }

  const url =
    "https://www.alphavantage.co/query" +
    `?function=SYMBOL_SEARCH` +
    `&keywords=${encodeURIComponent(keywords)}` +
    `&apikey=${API_KEY}`

  console.log("🔍 Searching for:", keywords)

  try {
    const res = await fetch(url)
    const json = await res.json()

    console.log("🔍 Search response:", json)

    // Informationフィールドがあれば有料機能
    if (json["Information"]) {
      console.log("❌ Premium feature:", json["Information"])
      return []
    }

    const matches = json["bestMatches"] || []
    
    return matches.map((match: any) => ({
      symbol: match["1. symbol"],
      name: match["2. name"],
    }))
  } catch (error) {
    console.error("Search error:", error)
    return []
  }
}