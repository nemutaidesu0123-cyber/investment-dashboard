import { NextResponse } from 'next/server';
import { fetchDailyPrices, fetchStockStats, screenStocks } from '@/src/lib/yahooFinanceApi';

// 🆕 日本株判定関数
function isJapaneseStock(symbol: string): boolean {
  return symbol.endsWith('.T') || 
         symbol.endsWith('.JP') ||
         /^\d{4}$/.test(symbol);
}

async function getExchangeRate(): Promise<number> {
  try {
    const yahooFinance = await import('yahoo-finance2');
    const quote = await yahooFinance.default.quote('JPY=X') as any;
    return quote.regularMarketPrice || 150;
  } catch (error) {
    console.warn('⚠️ 為替レート取得失敗、デフォルト値150円を使用');
    return 150;
  }
}

async function getCompanyName(symbol: string): Promise<string | undefined> {
  try {
    const yahooFinance = await import('yahoo-finance2');
    const quote = await yahooFinance.default.quoteSummary(symbol) as any;
    return quote.longName || quote.shortName;
  } catch {
    return undefined;
  }
}

// 🆕 通貨に応じたスクリーニング基準（日本円版）
function getScreeningCriteriaJP() {
  return {
    marketCap: {
      excellent: { min: 100e9, max: 1000e9 },      // 1000億〜1兆円
      good: { min: 50e9, max: 2000e9 },            // 500億〜2兆円
      normal: { min: 10e9, max: 50e9 },            // 100億〜500億円
    },
    eps: {
      excellent: 100,   // 100円以上
      good: 50,         // 50円以上
      normal: 10,       // 10円以上
    },
  };
}

// 長期保有適性を判定
function evaluateLongTermSuitability(
  screeningResults: Record<string, string>,
  actualValues: Record<string, number>
): string {
  const excellentCount = Object.values(screeningResults).filter(v => v === '◎').length;
  const goodOrBetterCount = Object.values(screeningResults).filter(v => v === '◎' || v === '〇').length;
  const normalCount = Object.values(screeningResults).filter(v => v === '△').length;
  
  const criticalItems = ['positiveCF', 'equityRatio'];
  const hasCriticalFailure = criticalItems.some(key => screeningResults[key] === '×');
  
  if (hasCriticalFailure) {
    return '×';
  }
  
  if (goodOrBetterCount >= 5 && excellentCount >= 2) {
    return '◎';
  }
  
  if (goodOrBetterCount >= 3 || normalCount >= 4) {
    return '〇';
  }
  
  return '△';
}

// 売上成長率（CAGR）を計算
async function calculateRevenueCAGR(
  symbol: string
): Promise<{ cagr: number; recentGrowth: number } | null> {
  try {
    const { default: YahooFinance } = await import('yahoo-finance2');
    const yahooFinance = new YahooFinance();

    const financials = await yahooFinance.quoteSummary(symbol, {
      modules: ['incomeStatementHistory']
    }) as any;

    const incomeStatements =
      financials?.incomeStatementHistory?.incomeStatementHistory;

    if (!incomeStatements || incomeStatements.length < 2) {
      console.warn('⚠️ 売上成長率計算: 十分なデータがありません');
      return null;
    }

    const sorted = [...incomeStatements].sort(
      (a, b) =>
        new Date(a.endDate).getTime() -
        new Date(b.endDate).getTime()
    );

    const oldest = sorted[0].totalRevenue;
    const latest = sorted[sorted.length - 1].totalRevenue;
    const years = sorted.length - 1;

    const cagr =
      (Math.pow(latest / oldest, 1 / years) - 1) * 100;

    const prev = sorted[sorted.length - 2].totalRevenue;
    const recentGrowth =
      ((latest - prev) / prev) * 100;

    return { cagr, recentGrowth };
  } catch (error) {
    console.error('❌ 売上成長率の計算エラー:', error);
    return null;
  }
}

// 🆕 テンバガー適性判定（改善版：ピラミッド型分散を実現）
function evaluateTenbaggerPotential(
  actualValues: Record<string, number>,
  screeningResults: Record<string, string>,
  revenueGrowth: { cagr: number; recentGrowth: number } | null,
  isJP: boolean,
  priceStats: { minPrice: number; maxPrice: number; currentPrice: number }
): { rating: string; score: number; details: string[] } {
  let score = 0;
  const details: string[] = [];
  
  // 1. 売上成長率（40点：CAGR 30点 + 加速度10点）
  if (revenueGrowth) {
    const cagr = revenueGrowth.cagr;
    const recent = revenueGrowth.recentGrowth;
    
    // 🆕 CAGR閾値を緩和（35%以上で満点）
    if (cagr >= 35) {
      score += 30;
      details.push(`✅ 売上CAGR: ${cagr.toFixed(1)}% (超高成長)`);
    } else if (cagr >= 25) {
      score += 22;
      details.push(`✅ 売上CAGR: ${cagr.toFixed(1)}% (高成長)`);
    } else if (cagr >= 15) {
      score += 12;
      details.push(`〇 売上CAGR: ${cagr.toFixed(1)}% (成長中)`);
    } else if (cagr >= 8) {
      score += 4;
      details.push(`△ 売上CAGR: ${cagr.toFixed(1)}% (緩やかな成長)`);
    } else {
      score += 1;
      details.push(`× 売上CAGR: ${cagr.toFixed(1)}% (成長不足)`);
    }
    
    // 🆕 成長加速度（-5点に緩和）
    if (recent >= cagr + 10) {
      score += 10;
      details.push(`✅ 直近成長: ${recent.toFixed(1)}% (加速中！)`);
    } else if (recent >= cagr) {
      score += 5;
      details.push(`〇 直近成長: ${recent.toFixed(1)}% (維持)`);
    } else if (recent >= cagr - 15) {
      score += 0;
      details.push(`△ 直近成長: ${recent.toFixed(1)}% (やや鈍化)`);
    } else {
      score -= 10; // 🆕 -10から-5に緩和
      details.push(`× 直近成長: ${recent.toFixed(1)}% (減速)`);
    }
  } else {
    details.push(`× 売上成長率: データなし`);
  }
  
  // 2. 時価総額（20点）
  const marketCap = actualValues.marketCap;
  if (isJP) {
    const oku = marketCap / 1e8;
    // 🆕 100億〜3000億を最高点に（より広く）
    if (oku >= 100 && oku <= 3000) {
      score += 20;
      details.push(`✅ 時価総額: ${oku.toFixed(0)}億円 (最大の伸びしろ)`);
    } else if (oku >= 3000 && oku <= 10000) {
      score += 15;
      details.push(`〇 時価総額: ${(oku/10000).toFixed(2)}兆円 (十分な伸びしろ)`);
    } else if (oku >= 10000 && oku <= 50000) {
      score += 8;
      details.push(`△ 時価総額: ${(oku/10000).toFixed(2)}兆円 (限定的)`);
    } else if (oku > 50000) {
      score -= 8;
      details.push(`× 時価総額: ${(oku/10000).toFixed(2)}兆円 (大きすぎる)`);
    } else {
      score -= 3;
      details.push(`△ 時価総額: ${oku.toFixed(0)}億円 (極小)`);
    }
  } else {
    const billion = marketCap / 1e9;
    // 🆕 1億〜150億ドルを最高点に
    if (billion >= 0.1 && billion <= 15) {
      score += 20;
      details.push(`✅ 時価総額: $${billion.toFixed(1)}B (最大の伸びしろ)`);
    } else if (billion >= 15 && billion <= 200) {
      score += 15;
      details.push(`〇 時価総額: $${billion.toFixed(1)}B (十分な伸びしろ)`);
    } else if (billion >= 200 && billion <= 1000) {
      score += 8;
      details.push(`△ 時価総額: $${billion.toFixed(1)}B (限定的)`);
    } else if (billion > 1000) {
      score -= 12;
      details.push(`× 時価総額: $${billion.toFixed(1)}B (大きすぎる)`);
    } else {
      score -= 3;
      details.push(`△ 時価総額: $${billion.toFixed(1)}B (極小)`);
    }
  }
  
  // 3. 株価位置（15点）🆕 52週安値との比較に変更
  // priceStats.minPriceは既に過去100日だが、ここでは52週想定
  const priceMultiple = priceStats.currentPrice / priceStats.minPrice;
  if (priceMultiple < 1.8) {
    score += 15;
    details.push(`✅ 株価位置: 安値から${priceMultiple.toFixed(2)}倍 (上昇余地大)`);
  } else if (priceMultiple < 3.0) {
    score += 10;
    details.push(`〇 株価位置: 安値から${priceMultiple.toFixed(2)}倍 (上昇中)`);
  } else if (priceMultiple < 5.0) {
    score += 5;
    details.push(`△ 株価位置: 安値から${priceMultiple.toFixed(2)}倍 (上昇済み)`);
  } else {
    score -= 2;
    details.push(`× 株価位置: 安値から${priceMultiple.toFixed(2)}倍 (割高)`);
  }
  
  // 4. 収益性（15点）
  const roe = actualValues.roe;
  if (roe >= 20) {
    score += 10;
    details.push(`✅ ROE: ${roe.toFixed(1)}% (超高収益)`);
  } else if (roe >= 15) {
    score += 7;
    details.push(`〇 ROE: ${roe.toFixed(1)}% (高収益)`);
  } else if (roe >= 10) {
    score += 4;
    details.push(`△ ROE: ${roe.toFixed(1)}% (普通)`);
  } else if (roe >= 0) {
    score += 1;
    details.push(`△ ROE: ${roe.toFixed(1)}% (低い)`);
  } else {
    // 🆕 成長企業の赤字を許容（テック系救済）
    score += 0;
    details.push(`△ ROE: ${roe.toFixed(1)}% (赤字だが成長期)`);
  }
  
  // 🆕 営業CFマージン（%に統一）
  const cfMargin = actualValues.positiveCF; // これは既に%のはず
  if (cfMargin >= 15) {
    score += 5;
    details.push(`✅ 営業CFマージン: ${cfMargin.toFixed(1)}%`);
  } else if (cfMargin >= 5) {
    score += 3;
  } else if (cfMargin >= 0) {
    score += 1;
  }
  
  // 5. PERバリュエーション（10点）
  const per = actualValues.per;
  if (per > 0 && per <= 25) {
    score += 10;
    details.push(`✅ PER: ${per.toFixed(1)}倍 (割安)`);
  } else if (per <= 50) {
    score += 5;
    details.push(`〇 PER: ${per.toFixed(1)}倍 (適正)`);
  } else if (per <= 100) {
    score += 2;
    details.push(`△ PER: ${per.toFixed(1)}倍 (やや高い)`);
  } else if (per <= 200) {
    score -= 2;
    details.push(`△ PER: ${per.toFixed(1)}倍 (高い)`);
  } else {
    score -= 5;
    details.push(`× PER: ${per.toFixed(1)}倍 (バブル)`);
  }
  
  // 評価（🆕 閾値を調整）
  let rating: string;
  if (score >= 60) {
    rating = '◎';
  } else if (score >= 40) {
    rating = '〇';
  } else if (score >= 25) {
    rating = '△';
  } else {
    rating = '×';
  }
  
  return { rating, score, details };
}

// 🆕 日本株のティッカーを正規化（.T付きに統一）
function normalizeJapaneseSymbol(symbol: string): string {
  if (/^\d{4}$/.test(symbol)) {
    return `${symbol}.T`;
  }
  return symbol;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  const isJP = isJapaneseStock(symbol);
  if (isJP) {
    symbol = normalizeJapaneseSymbol(symbol);
  }
  
  console.log(`🔍 Fetching data for ${symbol} (${isJP ? '🇯🇵 JP' : '🇺🇸 US'})`);

  try {
    // 🆕 fetchFinancialDataOptimized と get52WeekData を削除
    const [prices, stats, exchangeRate, companyName] = await Promise.allSettled([
      fetchDailyPrices(symbol),
      fetchStockStats(symbol),
      isJP ? getExchangeRate() : Promise.resolve(1),
      getCompanyName(symbol),
    ]);

    if (prices.status === 'rejected') {
      throw new Error(`価格データ取得失敗: ${prices.reason}`);
    }
    if (stats.status === 'rejected') {
      throw new Error(`財務データ取得失敗: ${stats.reason}`);
    }

    const pricesValue = prices.value;
    const statsValue = stats.value;
    const maxPrice = Math.max(...pricesValue.map((p) => p.price));
    const minPrice = Math.min(...pricesValue.map((p) => p.price));
    const volatility = (((maxPrice - minPrice) / minPrice) * 100).toFixed(2);
    const rate = exchangeRate.status === 'fulfilled' ? exchangeRate.value : 150;
    const name = companyName.status === 'fulfilled' ? companyName.value : undefined;

    // 🆕 revenueGrowthはstatsから直接取得
    // Yahoo Financeの revenueGrowth は直近の年次成長率（小数）
    const revenueGrowthRaw = statsValue.revenueGrowth;
    const revenueGrowth = revenueGrowthRaw
      ? {
          cagr: revenueGrowthRaw * 100,       // 直近成長率をCAGRとして使用（過去データなし）
          recentGrowth: revenueGrowthRaw * 100 // 同じ値（区別できないが正直なところ）
        }
      : null;

    // 🆕 52週安値はstatsから直接取得
    const currentPrice = pricesValue[pricesValue.length - 1]?.price || maxPrice;
    const week52Low = statsValue.fiftyTwoWeekLow || minPrice;
    const week52High = statsValue.fiftyTwoWeekHigh || maxPrice;

    const needsConversion = isJP && statsValue.marketCap < 1e11;
    
    console.log(`💱 Currency detection: marketCap=${statsValue.marketCap}, needsConversion=${needsConversion}`);

    const screeningResultsArray = screenStocks(
      [statsValue], 
      isJP ? 'JPY' : 'USD'
    );
    
    const screeningResults: Record<string, string> = {
      marketCap: screeningResultsArray[0].marketCap,
      roe: screeningResultsArray[0].roe,
      psr: screeningResultsArray[0].psr,
      cashRich: screeningResultsArray[0].cashRich,
      positiveCF: screeningResultsArray[0].positiveCF,
      per: screeningResultsArray[0].per,
      pbr: screeningResultsArray[0].pbr,
      roa: screeningResultsArray[0].roa,
      equityRatio: screeningResultsArray[0].equityRatio,
      eps: screeningResultsArray[0].eps,
    };

    const actualValues = {
      roe: statsValue.returnOnEquity * 100 || 0,
      psr: statsValue.revenue > 0 ? statsValue.marketCap / statsValue.revenue : 0,
      cashRich: statsValue.marketCap > 0 ? (statsValue.totalCash / statsValue.marketCap) * 100 : 0,
      positiveCF: statsValue.marketCap > 0 ? (statsValue.operatingCashflow / statsValue.marketCap) * 100 : 0,
      per: statsValue.per || 0,
      pbr: statsValue.pbr || 0,
      roa: statsValue.roa * 100 || 0,
      equityRatio: statsValue.equityRatio || 0,
      eps: needsConversion ? (statsValue.eps || 0) * rate : (statsValue.eps || 0),
      marketCap: needsConversion ? (statsValue.marketCap || 0) * rate : (statsValue.marketCap || 0),
    };

    console.log(`📊 Debug Info:`, {
      symbol,
      revenueGrowth,
      week52Low,
      week52High,
      currentPrice,
      priceMultiple: (currentPrice / week52Low).toFixed(2),
      marketCap: actualValues.marketCap,
      roe: actualValues.roe,
      per: actualValues.per
    });

    const longTermSuitability = evaluateLongTermSuitability(screeningResults, actualValues);
    const tenbaggerPotential = evaluateTenbaggerPotential(
      actualValues, 
      screeningResults, 
      revenueGrowth, 
      isJP,
      {
        minPrice: week52Low,
        maxPrice: week52High,
        currentPrice: currentPrice
      }
    );

    return NextResponse.json({
      maxPrice,
      minPrice,
      volatility,
      screeningResults,
      actualValues,
      longTermSuitability,
      tenbaggerPotential,
      currency: isJP ? 'JPY' : 'USD',
      exchangeRate: isJP && needsConversion ? rate : undefined,
      companyName: name,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error in /api/screen:', errorMessage);
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: 'Yahoo Finance APIへのアクセスに失敗しました。しばらく待ってから再試行してください。'
      },
      { status: 500 }
    );
  }
}

async function fetchFinancialDataOptimized(symbol: string) {
  console.log(`🔍 [START] fetchFinancialDataOptimized for ${symbol}`);
  
  try {
    // 🆕 直接quoteSummaryを呼ぶ（インスタンス化不要）
    const yahooFinance = await import('yahoo-finance2');
    
    console.log(`📡 Calling quoteSummary for ${symbol}...`);
    
    const data = await yahooFinance.default.quoteSummary(symbol, {
      modules: [
        'incomeStatementHistory' // これだけでOK
      ]
    }) as any;
    
    console.log(`📦 quoteSummary response received for ${symbol}`);
    console.log(`📊 incomeStatementHistory exists:`, !!data?.incomeStatementHistory);
    
    const incomeStatements = data?.incomeStatementHistory?.incomeStatementHistory;
    
    console.log(`📊 Number of income statements:`, incomeStatements?.length || 0);
    
    if (!incomeStatements || incomeStatements.length < 2) {
      console.warn(`⚠️ Insufficient data: ${incomeStatements?.length || 0} statements found`);
      return null;
    }
    
    const sorted = [...incomeStatements].sort((a: any, b: any) => 
      new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    );
    
    console.log(`📈 Sorted statements (last 3):`, sorted.slice(-3).map((s: any) => ({
      date: s.endDate?.toISOString?.() || s.endDate,
      revenue: s.totalRevenue
    })));
    
    const oldestRevenue = sorted[0].totalRevenue;
    const latestRevenue = sorted[sorted.length - 1].totalRevenue;
    const years = sorted.length - 1;
    
    if (!oldestRevenue || !latestRevenue || oldestRevenue <= 0 || latestRevenue <= 0) {
      console.warn(`⚠️ Invalid revenue: oldest=${oldestRevenue}, latest=${latestRevenue}`);
      return null;
    }
    
    const cagr = (Math.pow(latestRevenue / oldestRevenue, 1 / years) - 1) * 100;
    
    let recentGrowth = 0;
    if (sorted.length >= 2) {
      const previousRevenue = sorted[sorted.length - 2].totalRevenue;
      if (previousRevenue > 0) {
        recentGrowth = ((latestRevenue - previousRevenue) / previousRevenue) * 100;
      }
    }
    
    const result = { cagr, recentGrowth };
    console.log(`✅ [SUCCESS] Growth calculated: CAGR=${cagr.toFixed(1)}%, Recent=${recentGrowth.toFixed(1)}%`);
    
    return result;
  } catch (error) {
    console.error(`❌ [ERROR] fetchFinancialDataOptimized failed:`, error);
    return null;
  }
}
// 🆕 52週データ取得関数（型アサーション追加）
async function get52WeekData(symbol: string) {
  try {
    // 🆕 直接historicalを呼ぶ
    const yahooFinance = await import('yahoo-finance2');
    
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    console.log(`📅 Fetching 52-week data for ${symbol}...`);
    
    const historicalData: any = await yahooFinance.default.historical(symbol, {
      period1: oneYearAgo,
      period2: now,
      interval: '1d',
    });
    
    if (!historicalData || historicalData.length === 0) {
      console.warn(`⚠️ No 52-week data for ${symbol}`);
      return null;
    }
    
    const low = Math.min(...historicalData.map((d: any) => d.low));
    const high = Math.max(...historicalData.map((d: any) => d.high));
    const current = historicalData[historicalData.length - 1].close;
    
    console.log(`📈 52-week: Low=${low.toFixed(2)}, High=${high.toFixed(2)}, Current=${current.toFixed(2)}, Multiple=${(current/low).toFixed(2)}x`);
    
    return { low, high, current };
  } catch (error) {
    console.error('❌ Error fetching 52-week data:', error);
    return null;
  }
}