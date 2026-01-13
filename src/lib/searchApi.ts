// src/lib/searchApi.ts（新規ファイル）
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY

// 検索結果の型を定義
export type StockSearchResult = {
  symbol: string
  name: string
}

// キーワードに基づいてシンボルを検索する非同期関数を定義
export async function searchSymbols(keywords: string): Promise<StockSearchResult[]> {
  
  // キーワードが空の場合は空配列を返す（先頭・末尾の空白を除去してチェック）
  if (!keywords.trim()) {
    return []
  }
  // APIリクエストのURLを構築
  const url =
    "https://www.alphavantage.co/query" +
    `?function=SYMBOL_SEARCH` +
    `&keywords=${encodeURIComponent(keywords)}` +
    `&apikey=${API_KEY}`

  console.log("🔍 Searching for:", keywords)
  // APIリクエストを送信
  try {
    // urlに対してHTTPリクエストを送信しレスポンスを取得(awaitを使用して非同期処理を待機)
    const res = await fetch(url)
    // レスポンスのボディをJSON形式で解析
    const json = await res.json()

    console.log("🔍 Search response:", json)

    // Informationフィールドがあれば有料機能、有料かどうかの判定
    if (json["Information"]) {
      console.log("❌ Premium feature:", json["Information"])
      return []
    }
    // ベストマッチの配列をJSON形式に変換して取得（ベストマッチは検索結果の配列が格納されるフィールド）
    const matches = json["bestMatches"] || []
    
    // マッチした各シンボルについて、StockSearchResult型のオブジェクトに変換して配列で返す
    return matches.map((match: any) => ({
      // matchオブジェクトからシンボルと名前を抽出してStockSearchResult型のオブジェクトを作成
      symbol: match["1. symbol"],
      name: match["2. name"],
    }))
  // エラーハンドリング
  } catch (error) {
    // エラーが発生した場合、エラーメッセージをコンソールログに出力
    // （errorは自由に名前を変えられる。tryブロック内で発生したエラーオブジェクトを受け取るために自動生成される）
    console.error("Search error:", error)
    // 空の配列を返す
    return []
  }
}