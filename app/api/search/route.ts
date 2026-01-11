// app/api/search/route.ts（新規ファイル）
import { NextRequest, NextResponse } from "next/server"
import { searchSymbols } from "@/src/lib/searchApi"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keywords = searchParams.get("keywords") || ""

  const results = await searchSymbols(keywords)
  return NextResponse.json(results)
}