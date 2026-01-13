// app/api/search/route.ts（新規ファイル）
import { NextRequest, NextResponse } from "next/server"
import { searchSymbols } from "@/src/lib/searchApi"

// HTTP の GET リクエストを処理する非同期関数を定義
export async function GET(request: NextRequest) {
  // リクエストのURLから検索パラメータを取得
  const { searchParams } = new URL(request.url)
  // 検索パラメータの中から'keywords'の値を取得、存在しない場合は空文字列を使用
  const keywords = searchParams.get("keywords") || ""

  // searchSymbols関数を呼び出して、キーワードに基づく検索結果を取得
  const results = await searchSymbols(keywords)
  // 取得した結果をJSON形式でHTTPレスポンスとして返す
  return NextResponse.json(results)
}