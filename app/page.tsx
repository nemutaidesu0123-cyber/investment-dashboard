// app/page.tsx
"use client"

import { useEffect, useState } from "react"
import { calculateStats, Price, pricesToChartData } from "../src/lib/price"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { StockSearchResult } from "@/src/lib/searchApi"

type Timeframe = "1min" | "5min" | "15min" | "30min" | "60min" | "daily" | "weekly" | "monthly"

type SectorRankings = {
  lastUpdated: string
  rankings: {
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
}

export default function Home() {
  const [prices, setPrices] = useState<Price[]>([])
  const [timeframe, setTimeframe] = useState<Timeframe>("daily") 
  const [symbol, setSymbol] = useState("AAPL")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [candidates, setCandidates] = useState<StockSearchResult[]>([])
  const [sectorData, setSectorData] = useState<SectorRankings | null>(null)
  // 統計を計算
  const stats = calculateStats(prices)

    // セクターデータ読み込み
  useEffect(() => {
    fetch('/sector-data.json')
      .then(res => res.json())
      .then(data => setSectorData(data))
      .catch(err => console.error('セクターデータ読み込みエラー:', err))
  }, [])

  useEffect(() => {
    // 入力が止まってから500ms後に実行
    const timer = setTimeout(() => {
      // 検索処理
      // リクエストを送信
      fetch(`/api/search?keywords=${encodeURIComponent(inputValue)}`)
      // APIのレスポンスをjsonに変換
      .then(res => res.json())
      // 取得したデータを状態にセット
      .then(data => setCandidates(data))
      .catch(err => {
        console.error("Search error:", err)
        setCandidates([])
      })
    }, 500)

    // クリーンアップ（次の入力があったらキャンセル）
    return () => clearTimeout(timer)
  }, [inputValue])

    // 候補を選択
  const handleSelect = (item: StockSearchResult) => {
    setSymbol(item.symbol)
    setInputValue(item.symbol)
    setCandidates([]) // プルダウンを閉じる
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    
    fetch(`/api/prices?symbol=${symbol}&timeframe=${timeframe}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error: ${res.status}`)
        }
        return res.json()
      })
      .then((data: Price[]) => {
        setPrices(data)
      })
      .catch((err) => {
        console.error("Failed to fetch prices:", err)
        setError("データの取得に失敗しました")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [timeframe, symbol]) // symbolも依存配列に追加
  // チャート用データに変換
  const chartData = pricesToChartData(prices)

  return (
    <main style={{ padding: 40 }}>
      <h1>{symbol} 株価チャート</h1>
      
      {/* 検索ボックス */}
      <div style={{ position: 'relative'}}>
        ティッカー・銘柄名：
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          style={{
            padding: '8px',
            fontSize: '16px',
            border: '1px solid #ccc',  // ← 常に枠線を表示
            borderRadius: '4px',
            width: '120px',
            marginLeft: 8
          }}
        />
        
        {/* プルダウン */}
        {candidates.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #000000',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1000
          }}>
            {candidates.map((item) => (
              <div
                key={item.symbol}
                onClick={() => handleSelect(item)}
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #000000',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#05ff6d'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
              >
                <strong>{item.symbol}</strong> - {item.name}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 16 }}>
          <input
            type="radio"
            value="daily"
            checked={timeframe === "daily"}
            onChange={() => setTimeframe("daily")}
            disabled={loading}
          />
          日足 (過去100日)
        </label>

        <label style={{ marginRight: 16 }}>
          <input
            type="radio"
            value="weekly"
            checked={timeframe === "weekly"}
            onChange={() => setTimeframe("weekly")}
            disabled={loading}
          />
          週足 (過去20週)
        </label>

        <label>
          <input
            type="radio"
            value="monthly"
            checked={timeframe === "monthly"}
            onChange={() => setTimeframe("monthly")}
            disabled={loading}
          />
          月足 (過去6ヶ月)
        </label>
      </div>

      {loading && <p>読み込み中...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      
      {!loading && !error && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="y" 
              stroke="#8884d8"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      
      {!loading && !error && chartData.length === 0 && (
        <p>データがありません</p>
      )}
        
      {/* 統計情報（新規） */}
      {stats && (
        <div style={{ marginTop: 20, padding: 20, backgroundColor: '#f5f5f5' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>過去100日間の統計</h3>
          <p style={{marginLeft: '8px' }}>最高価格: ${stats.maxPrice.toFixed(2)} ({stats.maxPriceDate})</p>
          <p style={{marginLeft: '8px' }}>最安価格: ${stats.minPrice.toFixed(2)} ({stats.minPriceDate})</p>
          <p style={{marginLeft: '8px' }}>変動幅: ${stats.priceRange.toFixed(2)} ({stats.priceRangePercent.toFixed(2)}%)</p>
        </div>
      )}

      {sectorData && (
        <div style={{ marginTop: 40 }}>
          <h2>セクターランキング</h2>
          <p style={{ fontSize: 12, color: '#666' }}>
            最終更新: {new Date(sectorData.lastUpdated).toLocaleString('ja-JP')}
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* 1日前比 */}
            <div>
              <h3>1日前比</h3>
              <h4 style={{ color: 'green' }}>上昇TOP5</h4>
              <ul>
                {sectorData.rankings["1day"].rising.map((item, i) => (
                  <li key={i}>
                    {item.sector}: <span style={{ color: 'green' }}>+{item.change.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
              <h4 style={{ color: 'red' }}>下落TOP5</h4>
              <ul>
                {sectorData.rankings["1day"].falling.map((item, i) => (
                  <li key={i}>
                    {item.sector}: <span style={{ color: 'red' }}>{item.change.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 1週間前比 */}
            <div>
              <h3>1週間前比</h3>
              <h4 style={{ color: 'green' }}>上昇TOP5</h4>
              <ul>
                {sectorData.rankings["1week"].rising.map((item, i) => (
                  <li key={i}>
                    {item.sector}: <span style={{ color: 'green' }}>+{item.change.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
              <h4 style={{ color: 'red' }}>下落TOP5</h4>
              <ul>
                {sectorData.rankings["1week"].falling.map((item, i) => (
                  <li key={i}>
                    {item.sector}: <span style={{ color: 'red' }}>{item.change.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 1ヶ月前比 */}
            <div>
              <h3>1ヶ月前比</h3>
              <h4 style={{ color: 'green' }}>上昇TOP5</h4>
              <ul>
                {sectorData.rankings["1month"].rising.map((item, i) => (
                  <li key={i}>
                    {item.sector}: <span style={{ color: 'green' }}>+{item.change.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
              <h4 style={{ color: 'red' }}>下落TOP5</h4>
              <ul>
                {sectorData.rankings["1month"].falling.map((item, i) => (
                  <li key={i}>
                    {item.sector}: <span style={{ color: 'red' }}>{item.change.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}