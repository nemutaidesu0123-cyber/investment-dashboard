// src/lib/asset.ts
export type AssetType =
  | "US_STOCK"
  | "JP_STOCK"
  | "CRYPTO"
  | "GOLD"

export type Currency = "USD" | "JPY"

export type Asset = {
  symbol: string // ティッカー名
  name: string // 銘柄名
  assetType: AssetType // 資産タイプ
  currency: Currency // 通貨
}