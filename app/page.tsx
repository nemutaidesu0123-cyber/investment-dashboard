// app/page.tsx
"use client"

import { useEffect, useState } from "react"
import { Price, pricesToChartData } from "../src/lib/price"

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

export default function Home() {
  const [prices, setPrices] = useState<Price[]>([])
  const [timeframe, setTimeframe] = useState<Timeframe>("daily") 
  const [symbol, setSymbol] = useState("AAPL")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [candidates, setCandidates] = useState<StockSearchResult[]>([])

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
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
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
          週足 (過去15週)
        </label>

        <label>
          <input
            type="radio"
            value="monthly"
            checked={timeframe === "monthly"}
            onChange={() => setTimeframe("monthly")}
            disabled={loading}
          />
          月足 (過去3ヶ月)
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
    </main>
  )
}