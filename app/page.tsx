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

// スクリーニング条件の日本語ラベルと評価基準（時価総額を追加）
const screeningLabels: Record<string, { 
  label: string; 
  unit: string;
  criteria: string;
}> = {
  marketCap: {
    label: '時価総額',
    unit: 'B',
    criteria: '◎100-500億 ○50-1000億 △10-50億 ×範囲外'
  },
  roe: {
    label: 'ROE（自己資本利益率）',
    unit: '%',
    criteria: '◎15%超 ○10%超 △5%超 ×5%以下'
  },
  psr: {
    label: 'PSR（株価売上高倍率）',
    unit: '倍',
    criteria: '◎1倍未満 ○2倍未満 △3倍未満 ×3倍以上'
  },
  cashRich: {
    label: 'キャッシュリッチ度',
    unit: '%',
    criteria: '◎50%超 ○20%超 △10%超 ×10%以下'
  },
  positiveCF: {
    label: '営業キャッシュフロー',
    unit: '%',
    criteria: '◎プラス ○-10%以内 △-20%以内 ×-20%超'
  },
  per: {
    label: 'PER（株価収益率）',
    unit: '倍',
    criteria: '◎15倍以下 ○20倍以下 △30倍以下 ×30倍超'
  },
  pbr: {
    label: 'PBR（株価純資産倍率）',
    unit: '倍',
    criteria: '◎1倍未満 ○2倍未満 △3倍未満 ×3倍以上'
  },
  roa: {
    label: 'ROA（総資産利益率）',
    unit: '%',
    criteria: '◎5%以上 ○3%以上 △1%以上 ×1%未満'
  },
  equityRatio: {
    label: '自己資本比率',
    unit: '%',
    criteria: '◎60%以上 ○40%以上 △20%以上 ×20%未満'
  },
  eps: {
    label: 'EPS（1株当たり利益）',
    unit: 'ドル',
    criteria: '◎1ドル以上 ○0.5ドル以上 △0.1ドル以上 ×0.1ドル未満'
  }
}

// データの型定義（完全版）
interface ScreeningData {
  maxPrice: number;
  minPrice: number;
  volatility: string;
  screeningResults: Record<string, string>;
  actualValues: Record<string, number>;
  longTermSuitability: string;
  tenbaggerPotential: {
    rating: string;
    score: number;
    details: string[];
  };
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
  const [data, setData] = useState<ScreeningData | null>(null);

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

    // クリーンアップ(次の入力があったらキャンセル)
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

// useEffectでデータ取得する部分（型を更新）
useEffect(() => {
  if (!symbol) return;

  console.log('🔍 Fetching screening data for:', symbol);
  const fetchScreeningData = async () => {
    try {
      const url = `/api/screen?symbol=${symbol}`;
      console.log('📡 Request URL:', url);
      const response = await fetch(url);
      console.log('📥 Response status:', response.status);
      const result: ScreeningData = await response.json();
      console.log('✅ Fetched screening data for', symbol, ':', result);
      setData(result);
    } catch (error) {
      console.error('❌ Error fetching screening data:', error);
    }
  };

  fetchScreeningData();
}, [symbol]);

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

        {/* スクリーニング結果セクション */}
        {data && (
          <>
            {/* 既存のスクリーニング結果テーブル */}
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
                ✅ 財務指標スクリーニング
              </h2>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                    <th style={{
                      borderBottom: '2px solid #667eea',
                      padding: '12px 16px',
                      textAlign: 'left',
                      color: '#333',
                      fontWeight: 600,
                      fontSize: '14px',
                      width: '35%',
                    }}>
                      条件
                    </th>
                    <th style={{
                      borderBottom: '2px solid #667eea',
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: '#333',
                      fontWeight: 600,
                      fontSize: '14px',
                      width: '25%',
                    }}>
                      取得データ
                    </th>
                    <th style={{
                      borderBottom: '2px solid #667eea',
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: '#333',
                      fontWeight: 600,
                      fontSize: '14px',
                      width: '15%',
                    }}>
                      評価
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.screeningResults).map(([key, value], index) => {
                    const info = screeningLabels[key]
                    if (!info) return null
                    
                    let actualValue = data.actualValues?.[key]
                    
                    // 時価総額は10億ドル単位で表示
                    if (key === 'marketCap' && actualValue !== undefined) {
                      actualValue = actualValue / 1e9
                    }
                    
                    return (
                      <tr key={key} style={{
                        background: index % 2 === 0 ? 'white' : '#f8f9ff',
                      }}>
                        <td style={{
                          borderBottom: '1px solid #e0e0e0',
                          padding: '12px 16px',
                        }}>
                          <div style={{
                            color: '#333',
                            fontSize: '14px',
                            fontWeight: 500,
                            marginBottom: '4px',
                          }}>
                            {info.label}
                          </div>
                          <div style={{
                            color: '#666',
                            fontSize: '11px',
                            lineHeight: '1.3',
                          }}>
                            {info.criteria}
                          </div>
                        </td>
                        <td style={{
                          borderBottom: '1px solid #e0e0e0',
                          padding: '12px 16px',
                          textAlign: 'center',
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#444',
                        }}>
                          {actualValue !== undefined 
                            ? `${actualValue.toFixed(2)}${info.unit}`
                            : '-'}
                        </td>
                        <td style={{
                          borderBottom: '1px solid #e0e0e0',
                          padding: '12px 16px',
                          textAlign: 'center',
                          fontSize: '20px',
                          fontWeight: 700,
                          color: value === '◎' ? '#27ae60' 
                              : value === '○' || value === '〇' ? '#3498db' 
                              : value === '△' ? '#f39c12' 
                              : '#e74c3c',
                        }}>
                          {value}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 総合判定セクション */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
              marginBottom: '20px',
            }}>
              {/* 長期保有適性 */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                textAlign: 'center',
              }}>
                <h3 style={{
                  fontSize: '18px',
                  marginBottom: '16px',
                  color: '#333',
                }}>
                  📊 長期保有適性
                </h3>
                <div style={{
                  fontSize: '48px',
                  fontWeight: 700,
                  marginBottom: '12px',
                  color: data.longTermSuitability === '◎' ? '#27ae60'
                      : data.longTermSuitability === '○' || data.longTermSuitability === '〇' ? '#3498db'
                      : data.longTermSuitability === '△' ? '#f39c12'
                      : '#e74c3c',
                }}>
                  {data.longTermSuitability}
                </div>
                <p style={{
                  fontSize: '13px',
                  color: '#666',
                  lineHeight: '1.6',
                }}>
                  {data.longTermSuitability === '◎' 
                    ? '財務健全性が高く、長期保有に適しています' 
                    : data.longTermSuitability === '○' || data.longTermSuitability === '〇'
                    ? 'まあまあの財務状態です'
                    : data.longTermSuitability === '△'
                    ? 'やや不安な要素があります'
                    : '致命的な弱点があります'}
                </p>
              </div>

              {/* テンバガー適性 */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                textAlign: 'center',
              }}>
                <h3 style={{
                  fontSize: '18px',
                  marginBottom: '16px',
                  color: '#333',
                }}>
                  🚀 テンバガー適性
                </h3>
                <div style={{
                  fontSize: '48px',
                  fontWeight: 700,
                  marginBottom: '8px',
                  color: data.tenbaggerPotential.rating === '◎' ? '#27ae60'
                      : data.tenbaggerPotential.rating === '○' || data.tenbaggerPotential.rating === '〇' ? '#3498db'
                      : data.tenbaggerPotential.rating === '△' ? '#f39c12'
                      : '#e74c3c',
                }}>
                  {data.tenbaggerPotential.rating}
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#667eea',
                  marginBottom: '12px',
                }}>
                  スコア: {data.tenbaggerPotential.score}/100
                </div>
                <p style={{
                  fontSize: '13px',
                  color: '#666',
                  lineHeight: '1.6',
                }}>
                  {data.tenbaggerPotential.rating === '◎'
                    ? '10倍株の条件を高いレベルで満たしています'
                    : data.tenbaggerPotential.rating === '○' || data.tenbaggerPotential.rating === '〇'
                    ? '10倍株の可能性があります'
                    : data.tenbaggerPotential.rating === '△'
                    ? '一部条件を満たしていますが要検討'
                    : 'テンバガー条件を満たしていません'}
                </p>
              </div>
            </div>

            {/* テンバガー詳細分析 */}
            {/* <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '20px',
              padding: '24px',
              marginBottom: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            }}>
              <h3 style={{
                fontSize: '18px',
                marginBottom: '16px',
                color: '#333',
              }}>
                🔍 テンバガー条件詳細チェック
              </h3>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                {data.tenbaggerPotential.details.map((detail, index) => {
                  const isPositive = detail.startsWith('✅')
                  const isNeutral = detail.startsWith('○') || detail.startsWith('△')
                  const isNegative = detail.startsWith('×')
                  
                  return (
                    <div
                      key={index}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: isPositive ? '#e8f5e9'
                          : isNeutral ? '#fff3e0'
                          : '#ffebee',
                        borderLeft: `4px solid ${
                          isPositive ? '#27ae60'
                          : isNeutral ? '#f39c12'
                          : '#e74c3c'
                        }`,
                        fontSize: '14px',
                        color: '#333',
                      }}
                    >
                      {detail}
                    </div>
                  )
                })}
              </div>
            </div> */}
          </>
        )}

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