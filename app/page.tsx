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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {/* ヘッダー */}
        <header style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}>
          <h1 style={{
            fontSize: 'clamp(24px, 5vw, 36px)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
            fontWeight: 700,
          }}>
            📈 銘柄分析チャート
          </h1>
        </header>

        {/* 検索セクション */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 600,
              color: '#333',
              fontSize: '14px',
            }}>
              ティッカー・銘柄名
            </label>
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="例: AAPL, Tesla"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                outline: 'none',
                transition: 'all 0.3s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
            
            {candidates.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                marginTop: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              }}>
                {candidates.map((item) => (
                  <div
                    key={item.symbol}
                    onClick={() => handleSelect(item)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <strong style={{ color: '#667eea' }}>{item.symbol}</strong>
                    <span style={{ color: '#666', marginLeft: '8px' }}>{item.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* タイムフレーム選択 */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            {[
              { value: 'daily', label: '日足' },
              { value: 'weekly', label: '週足' },
              { value: 'monthly', label: '月足' },
            ].map(({ value, label }) => (
              <label
                key={value}
                style={{
                  flex: '1 1 auto',
                  minWidth: '100px',
                  position: 'relative',
                }}
              >
                <input
                  type="radio"
                  value={value}
                  checked={timeframe === value}
                  onChange={() => setTimeframe(value as Timeframe)}
                  disabled={loading}
                  style={{ display: 'none' }}
                />
                <div style={{
                  padding: '12px',
                  textAlign: 'center',
                  borderRadius: '12px',
                  border: `2px solid ${timeframe === value ? '#667eea' : '#e0e0e0'}`,
                  background: timeframe === value ? '#667eea' : 'white',
                  color: timeframe === value ? 'white' : '#333',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  fontWeight: 600,
                  opacity: loading ? 0.5 : 1,
                }}>
                  {label}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* チャートセクション */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{
            fontSize: 'clamp(20px, 4vw, 28px)',
            marginBottom: '20px',
            color: '#333',
          }}>
            {symbol} 株価チャート
          </h2>

          {loading && <p style={{ textAlign: 'center', color: '#667eea' }}>読み込み中...</p>}
          {error && <p style={{ color: '#e74c3c', textAlign: 'center' }}>{error}</p>}
          
          {!loading && !error && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="x" stroke="#666" />
                <YAxis domain={['auto', 'auto']} stroke="#666" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="y" 
                  stroke="#667eea"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          
          {!loading && !error && chartData.length === 0 && (
            <p style={{ textAlign: 'center', color: '#999' }}>データがありません</p>
          )}

          {/* 統計情報 */}
          {stats && (
            <div style={{
              marginTop: '24px',
              padding: '20px',
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              borderRadius: '16px',
            }}>
              <h3 style={{ fontSize: '18px', marginBottom: '16px', color: '#333' }}>
                📊 過去100日間の統計
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
              }}>
                <div>
                  <div style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>最高価格</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#27ae60' }}>
                    ${stats.maxPrice.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{stats.maxPriceDate}</div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>最安価格</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#e74c3c' }}>
                    ${stats.minPrice.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{stats.minPriceDate}</div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>変動幅</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#667eea' }}>
                    ${stats.priceRange.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {stats.priceRangePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* セクターランキング */}
        {sectorData && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{
              fontSize: 'clamp(20px, 4vw, 28px)',
              marginBottom: '8px',
              color: '#333',
            }}>
              🔥 セクターランキング
            </h2>
            <p style={{ fontSize: '12px', color: '#999', marginBottom: '24px' }}>
              最終更新: {new Date(sectorData.lastUpdated).toLocaleString('ja-JP')}
            </p>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
            }}>
              {['1day', '1week', '1month'].map((period) => (
                <div key={period}>
                  <h3 style={{ fontSize: '18px', marginBottom: '16px', color: '#333' }}>
                    {period === '1day' ? '📅 1日前比' : period === '1week' ? '📊 1週間前比' : '📈 1ヶ月前比'}
                  </h3>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '14px', color: '#27ae60', marginBottom: '8px' }}>
                      ⬆️ 上昇TOP5
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {sectorData.rankings[period as keyof typeof sectorData.rankings].rising.map((item, i) => (
                        <li key={i} style={{
                          padding: '8px 12px',
                          background: i % 2 === 0 ? '#f8fff8' : 'white',
                          borderRadius: '8px',
                          marginBottom: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}>
                          <span style={{ fontSize: '14px' }}>{item.sector}</span>
                          <span style={{ color: '#27ae60', fontWeight: 600 }}>
                            +{item.change.toFixed(2)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '14px', color: '#e74c3c', marginBottom: '8px' }}>
                      ⬇️ 下落TOP5
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {sectorData.rankings[period as keyof typeof sectorData.rankings].falling.map((item, i) => (
                        <li key={i} style={{
                          padding: '8px 12px',
                          background: i % 2 === 0 ? '#fff8f8' : 'white',
                          borderRadius: '8px',
                          marginBottom: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}>
                          <span style={{ fontSize: '14px' }}>{item.sector}</span>
                          <span style={{ color: '#e74c3c', fontWeight: 600 }}>
                            {item.change.toFixed(2)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}