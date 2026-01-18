import 'dotenv/config'

import { SECTOR_STOCKS } from '../src/lib/sectorStocks'
import { fetchDailyPrices } from '../src/lib/yahooFinanceApi'
import fs from 'fs'

const monthsdatacount = 20

type SectorAverage = {
  sector: string
  change1d: number
  change1w: number
  change1m: number
}

type Rankings = {
  "1day": {
    rising: Array<{ sector: string, change: number }>
    falling: Array<{ sector: string, change: number }>
  }
  "1week": {
    rising: Array<{ sector: string, change: number }>
    falling: Array<{ sector: string, change: number }>
  }
  "1month": {
    rising: Array<{ sector: string, change: number }>
    falling: Array<{ sector: string, change: number }>
  }
}

// 騰落率を計算
function calcChange(current: number, past: number): number {
  return ((current - past) / past) * 100
}

// 1銘柄の騰落率を取得
async function getStockChanges(symbol: string) {
  console.log(`取得中: ${symbol}`)
  
  try{
  // 1. データ取得
    const prices = await fetchDailyPrices(symbol)
    
    // 2. 日付順にソート（新しい順）
    prices.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
    
    // 3. データ数チェック
    if (prices.length < monthsdatacount +1 ) {
        console.log(`${symbol}: データ不足`)
        return null
    }
    
    // 4. 必要な価格を取得
    const latest = prices[0]  // 最新価格
    const day1 = prices[1]    // 1日前
    const week1 = prices[5]   // 5営業日前（1週間）
    const month1 = prices[20] // 20営業日前（1ヶ月）
    
    // 5. 騰落率を計算
    const change1d = calcChange(latest.price, day1.price)
    const change1w = calcChange(latest.price, week1.price)
    const change1m = calcChange(latest.price, month1.price)
    // 残りを埋める
    
    // 6. 結果を返す
    return {
        symbol,
        change1d,
        change1w,
        change1m
    }
  } catch (error) {
    console.log(`${symbol}: スキップ (${error instanceof Error ? error.message : 'エラー'})`)
    return null
  }

}

function createRankings(sectorAverages: SectorAverage[]): Rankings {
  // 1日前比
  // 降順（大きい順）にソート
  sectorAverages.sort((a, b) => b.change1d - a.change1d)

  // 昇順（小さい順）にソート
  sectorAverages.sort((a, b) => a.change1d - b.change1d)

  const copy = [...sectorAverages]

  // 1日前比の上昇TOP5
  const sorted1dRising = [...sectorAverages].sort((a, b) => b.change1d - a.change1d)
  const top5Rising1d = sorted1dRising.slice(0, 5)

  // 1日前比の下落TOP5
  const sorted1dFalling = [...sectorAverages].sort((a, b) => a.change1d - b.change1d)
  const top5Falling1d = sorted1dFalling.slice(0, 5)

  // 1週間前比
  const sorted1wRising = [...sectorAverages].sort((a, b) => b.change1w - a.change1w)
  const top5Rising1w = sorted1wRising.slice(0,5)
  
  const sorted1wFalling = [...sectorAverages].sort((a, b) => a.change1w - b.change1w)
  const top5Falling1w = sorted1wFalling.slice(0, 5)

  // 1ヶ月前比
  const sorted1mRising = [...sectorAverages].sort((a, b) => b.change1m - a.change1m)
  const top5Rising1m = sorted1mRising.slice(0,5)
  
  const sorted1mFalling = [...sectorAverages].sort((a, b) => a.change1m - b.change1m)
  const top5Falling1m = sorted1mFalling.slice(0, 5)
  
  return {
    "1day": {
      rising: sorted1dRising.slice(0, 5).map(s => ({ 
        sector: s.sector, 
        change: s.change1d 
      })),
      falling: sorted1dFalling.slice(0, 5).map(s => ({ 
        sector: s.sector, 
        change: s.change1d 
      }))
    },
    "1week": {
      rising: sorted1wRising.slice(0, 5).map(s => ({ 
        sector: s.sector, 
        change: s.change1w 
      })),
      falling: sorted1wFalling.slice(0, 5).map(s => ({ 
        sector: s.sector, 
        change: s.change1w 
      }))
    },
    "1month": {
      rising: sorted1mRising.slice(0, 5).map(s => ({ 
        sector: s.sector, 
        change: s.change1m 
      })),
      falling: sorted1mFalling.slice(0, 5).map(s => ({ 
        sector: s.sector, 
        change: s.change1m 
      }))
    }
  }
}

// メイン処理
async function main() {
  console.log("セクターデータ更新開始...")

  // デバッグ: APIキーチェック
  console.log("API_KEY:", process.env.ALPHA_VANTAGE_API_KEY ? "設定済み" : "未設定")
  console.log("API_KEY長さ:", process.env.ALPHA_VANTAGE_API_KEY?.length || 0)
  try{
  
    // 1. 全銘柄リストを作成
    const allSymbols = Object.values(SECTOR_STOCKS).flat() // flatを使って2次元配列を1次元に）
    
    // 2. 重複削除
    const uniqueSymbols = [...new Set(allSymbols)] // Setを使って重複を削除
    
    console.log(`全${uniqueSymbols.length}銘柄を処理します`)
    
    // 3. 各銘柄のデータ取得
    const results = []
    
    for (let i = 0; i < uniqueSymbols.length; i++) {
        const symbol = uniqueSymbols[i]
        
        // プログレス表示
        console.log(`処理中:${i+1} / ${uniqueSymbols.length}`)  // 「処理中: X / Y」を表示
        
        // データ取得
        const data = await getStockChanges(symbol)
        
        if (data) {
        results.push(data)
        }
        
        // レート制限対策
        if (i < uniqueSymbols.length - 1) {
            await sleep(20000)  // 20秒待つ
        }
    }
    
    console.log(`取得完了: ${results.length}銘柄`)
    
    console.log("セクター集計中...")
    
    // 1. 銘柄→セクターのマッピング作成
    const symbolToSector: { [symbol: string]: string } = {}
    for (const sector in SECTOR_STOCKS) {
        for (const symbol of SECTOR_STOCKS[sector]) {
            symbolToSector[symbol] = sector
        }
    }
    
    // 2. セクターデータの初期化
    const sectorData: { 
        [sector: string]: { 
        change1d: number[], 
        change1w: number[], 
        change1m: number[] 
        } 
    } = {}

        // 初期化
    for (const sector in SECTOR_STOCKS) {
        sectorData[sector] = {
            change1d: [],
            change1w: [],
            change1m: []
        }
    }

    // データを振り分け
    for (const result of results) {
        const sector = symbolToSector[result.symbol]
        
        if (sector) {
            sectorData[sector].change1d.push(result.change1d)
            sectorData[sector].change1w.push(result.change1w)
            sectorData[sector].change1m.push(result.change1m)
        }
    }
    
    // 4. 平均を計算
    function average(numbers: number[]): number {
        if (numbers.length === 0) return 0
        const sum = numbers.reduce((acc, n) => acc + n, 0)
        return sum / numbers.length
    }

    // セクターの平均騰落率
    const sectorAverages = []

    for (const sector in sectorData) {
        const avg1d = average(sectorData[sector].change1d)
        const avg1w = average(sectorData[sector].change1w)
        const avg1m = average(sectorData[sector].change1m)
    
        sectorAverages.push({
        sector,
        change1d: avg1d,
        change1w: avg1w,
        change1m: avg1m
        })
    }
    
    console.log(`セクター集計完了: ${sectorAverages.length}セクター`)
    
    console.log("ランキング作成中...")
    const rankings = createRankings(sectorAverages)
    
    console.log("1日前比 上昇TOP5:", rankings["1day"].rising)
    console.log("1日前比 下落TOP5:", rankings["1day"].falling)
    
    console.log("JSONファイル保存中...")
    
    // 1. 出力データを作成
    const output = {
        lastUpdated: new Date().toISOString(),// ここを埋める（現在日時のISO文字列）
        rankings: rankings
    }
    
    // 2. ファイルに保存
    // ここを埋める（fs.writeFileSync）
    fs.writeFileSync(
        'public/sector-data.json',
        JSON.stringify(output, null, 2)  // 整形して保存
    )
    
    console.log("保存完了: public/sector-data.json")
    console.log("更新完了！")
  } catch (error) {
    console.error("致命的エラー:", error)
    process.exit(1)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main()