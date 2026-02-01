// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server"
import YahooFinance from "yahoo-finance2"

const yahooFinance = new YahooFinance()

// 🆕 検索結果の型（拡張版）
export type StockSearchResult = {
  symbol: string
  name: string
  nameJa?: string        // 日本語企業名
  exchange?: string
  type?: string
  region: 'US' | 'JP'    // 地域判定
  market?: string        // 市場名（東証プライム等）
}

// 🆕 日本株判定関数
function isJapaneseStock(symbol: string): boolean {
  return symbol.endsWith('.T') || 
         symbol.endsWith('.JP') ||
         /^\d{4}$/.test(symbol);
}

// 🆕 市場名を取得
function getMarketName(exchange?: string): string | undefined {
  if (!exchange) return undefined;
  
  const marketMap: Record<string, string> = {
    'JPX': '東証',
    'TYO': '東証',
    'TSE': '東証',
    'FGI': 'TOKYO PRO',
    'OSA': '大阪',
    'NGO': '名古屋',
    'SPR': '札幌',
    'FKO': '福岡',
  };
  
  return marketMap[exchange] || exchange;
}

// 🆕 日本語企業名を抽出（Yahoo Financeの結果から）
function extractJapaneseName(longname?: string, shortname?: string): string | undefined {
  // longnameに日本語が含まれている場合
  if (longname && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(longname)) {
    return longname;
  }
  // shortnameに日本語が含まれている場合
  if (shortname && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(shortname)) {
    return shortname;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keywords = searchParams.get("keywords") || ""

  if (!keywords.trim()) {
    return NextResponse.json([])
  }

  try {
    console.log("🔍 Searching for:", keywords)

    // Yahoo Financeで検索を実行
    const results: any = await yahooFinance.search(keywords, {
      quotesCount: 15,  // 🆕 検索数を増やして日本株もヒットしやすく
      newsCount: 0,
    })

    console.log("✅ Search results:", results.quotes?.length || 0)

    // 🆕 検索結果を整形（日本株対応）
    const stockResults: StockSearchResult[] = (results.quotes || [])
      .filter((quote: any) => {
        // 株式（EQUITY）のみフィルタ
        return quote.symbol && 
               quote.shortname && 
               (quote.quoteType === 'EQUITY' || quote.typeDisp === 'Equity');
      })
      .map((quote: any) => {
        const symbol = quote.symbol;
        const isJP = isJapaneseStock(symbol);
        const nameJa = extractJapaneseName(quote.longname, quote.shortname);
        
        return {
          symbol: symbol,
          name: quote.longname || quote.shortname || symbol,
          nameJa: isJP ? nameJa : undefined,
          exchange: quote.exchange,
          type: quote.quoteType,
          region: isJP ? 'JP' : 'US',
          market: isJP ? getMarketName(quote.exchange) : undefined,
        };
      })
      // 🆕 日本株を優先的に表示（キーワードが数字の場合）
      .sort((a: { region: string }, b: { region: string }) => {
        if (/^\d+/.test(keywords)) {
          // 数字検索の場合は日本株を上位に
          if (a.region === 'JP' && b.region !== 'JP') return -1;
          if (a.region !== 'JP' && b.region === 'JP') return 1;
        }
        return 0;
      });

    console.log("📊 Filtered results:", stockResults.length, {
      JP: stockResults.filter(r => r.region === 'JP').length,
      US: stockResults.filter(r => r.region === 'US').length,
    });

    return NextResponse.json(stockResults)
  } catch (error) {
    console.error("❌ Search error:", error)
    return NextResponse.json([])
  }
}