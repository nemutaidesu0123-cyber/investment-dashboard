import { NextResponse } from 'next/server';
import { fetchDailyPrices, fetchStockStats, screenStocks } from '@/src/lib/yahooFinanceApi';

// 長期保有適性を判定
function evaluateLongTermSuitability(
  screeningResults: Record<string, string>,
  actualValues: Record<string, number>
): string {
  // ◎と○の数をカウント
  const excellentCount = Object.values(screeningResults).filter(v => v === '◎').length;
  const goodOrBetterCount = Object.values(screeningResults).filter(v => v === '◎' || v === '○' || v === '〇').length;
  
  // 絶対×になってはいけない項目（収益性・キャッシュフロー・財務安定性）
  const criticalItems = ['positiveCF', 'equityRatio'];
  const hasCriticalFailure = criticalItems.some(key => screeningResults[key] === '×');
  
  // 判定ロジック
  if (hasCriticalFailure) {
    return '×'; // 致命的な弱点あり
  }
  
  if (goodOrBetterCount >= 2 && excellentCount >= 1) {
    return '◎'; // 長期保有に適している
  }
  
  if (goodOrBetterCount >= 2) {
    return '○'; // まあまあ
  }
  
  return '△'; // やや不安
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

// テンバガー適性を判定（スコアリング方式）
function evaluateTenbaggerPotential(
  actualValues: Record<string, number>,
  screeningResults: Record<string, string>,
  revenueGrowth: { cagr: number; recentGrowth: number } | null
): { rating: string; score: number; details: string[] } {
  let score = 0;
  const details: string[] = [];
  const maxScore = 100;
  
  // 1. 売上成長率（CAGR 30%以上が理想）- 配点30点（最重要！）
  if (revenueGrowth) {
    if (revenueGrowth.cagr >= 30) {
      score += 30;
      details.push(`✅ 売上CAGR: ${revenueGrowth.cagr.toFixed(1)}% (超高成長)`);
    } else if (revenueGrowth.cagr >= 20) {
      score += 20;
      details.push(`○ 売上CAGR: ${revenueGrowth.cagr.toFixed(1)}% (高成長)`);
    } else if (revenueGrowth.cagr >= 10) {
      score += 10;
      details.push(`△ 売上CAGR: ${revenueGrowth.cagr.toFixed(1)}% (まあまあ)`);
    } else {
      details.push(`× 売上CAGR: ${revenueGrowth.cagr.toFixed(1)}% (低成長)`);
    }
    
    // 直近1年の成長鈍化チェック（重要！）
    if (revenueGrowth.recentGrowth >= 20) {
      score += 10;
      details.push(`✅ 直近成長率: ${revenueGrowth.recentGrowth.toFixed(1)}% (加速中)`);
    } else if (revenueGrowth.recentGrowth >= 10) {
      score += 5;
      details.push(`○ 直近成長率: ${revenueGrowth.recentGrowth.toFixed(1)}% (維持)`);
    } else {
      details.push(`× 直近成長率: ${revenueGrowth.recentGrowth.toFixed(1)}% (鈍化懸念)`);
    }
  } else {
    details.push(`× 売上成長率: データ取得不可`);
  }
  
  // 2. 時価総額（100-500億円が理想）- 配点20点
  const marketCapInBillions = actualValues.marketCap / 1e9;
  if (marketCapInBillions >= 10 && marketCapInBillions <= 50) {
    score += 20;
    details.push(`✅ 時価総額: ${marketCapInBillions.toFixed(1)}B (最適レンジ)`);
  } else if (marketCapInBillions >= 5 && marketCapInBillions <= 100) {
    score += 12;
    details.push(`○ 時価総額: ${marketCapInBillions.toFixed(1)}B (許容範囲)`);
  } else {
    details.push(`× 時価総額: ${marketCapInBillions.toFixed(1)}B (範囲外)`);
  }
  
  // 3. ROE 15%以上（収益性）- 配点15点
  if (actualValues.roe >= 15) {
    score += 15;
    details.push(`✅ ROE: ${actualValues.roe.toFixed(1)}% (高収益)`);
  } else if (actualValues.roe >= 10) {
    score += 10;
    details.push(`○ ROE: ${actualValues.roe.toFixed(1)}% (まあまあ)`);
  } else {
    details.push(`× ROE: ${actualValues.roe.toFixed(1)}% (低い)`);
  }
  
  // 4. PER 100倍以下（過度なバブルではない）- 配点10点
  if (actualValues.per > 0 && actualValues.per <= 100) {
    score += 10;
    details.push(`✅ PER: ${actualValues.per.toFixed(1)}倍 (適正範囲)`);
  } else if (actualValues.per > 100) {
    score += 3;
    details.push(`△ PER: ${actualValues.per.toFixed(1)}倍 (やや高い)`);
  } else {
    details.push(`× PER: 赤字または異常値`);
  }
  
  // 5. 営業キャッシュフローがプラス（健全性）- 配点15点
  if (actualValues.positiveCF > 0) {
    score += 15;
    details.push(`✅ 営業CF: プラス (健全)`);
  } else {
    details.push(`× 営業CF: マイナス (資金繰り懸念)`);
  }
  
  // 6. 自己資本比率40%以上（財務安定性）- 配点10点
  if (actualValues.equityRatio >= 40) {
    score += 10;
    details.push(`✅ 自己資本比率: ${actualValues.equityRatio.toFixed(1)}% (安定)`);
  } else if (actualValues.equityRatio >= 20) {
    score += 5;
    details.push(`△ 自己資本比率: ${actualValues.equityRatio.toFixed(1)}% (やや低い)`);
  } else {
    details.push(`× 自己資本比率: ${actualValues.equityRatio.toFixed(1)}% (低い)`);
  }
  
  // スコアに応じて評価を返す
  let rating: string;
  if (score >= 80) {
    rating = '◎'; // 超有望
  } else if (score >= 60) {
    rating = '○'; // 有望
  } else if (score >= 40) {
    rating = '△'; // 検討の余地あり
  } else {
    rating = '×'; // 不適
  }
  
  return { rating, score, details };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    // Fetch price data
    const prices = await fetchDailyPrices(symbol);
    const maxPrice = Math.max(...prices.map((p) => p.price));
    const minPrice = Math.min(...prices.map((p) => p.price));
    const volatility = (((maxPrice - minPrice) / minPrice) * 100).toFixed(2);

    // Fetch real financial data
    const stats = await fetchStockStats(symbol);
    
    const stockStats = [{
      ...stats,
    }];

    console.log('📊 Stock stats for', symbol, ':', stockStats[0]);

    const screeningResultsArray = screenStocks(stockStats);
    
    // ScreeningResult型をRecord<string, string>に変換
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

    // 実際の値を計算
    const actualValues = {
      roe: stats.returnOnEquity,
      psr: stats.marketCap / stats.revenue,
      cashRich: (stats.totalCash / stats.marketCap) * 100,
      positiveCF: (stats.operatingCashflow / stats.marketCap) * 100,
      per: stats.per,
      pbr: stats.pbr,
      roa: stats.roa,
      equityRatio: stats.equityRatio,
      eps: stats.eps,
      marketCap: stats.marketCap, // 時価総額を追加
    };

    console.log('📈 Actual values:', actualValues);

    // 売上成長率を計算
    const revenueGrowth = await calculateRevenueCAGR(symbol);

    // 長期保有適性を判定
    const longTermSuitability = evaluateLongTermSuitability(
      screeningResults,
      actualValues
    );

    // テンバガー適性を判定
    const tenbaggerPotential = evaluateTenbaggerPotential(
      actualValues,
      screeningResults,
      revenueGrowth
    );

    return NextResponse.json({
      maxPrice,
      minPrice,
      volatility,
      screeningResults,
      actualValues,
      longTermSuitability,
      tenbaggerPotential,
    });
  } catch (error) {
    console.error('❌ Error fetching screening data:', error);
    return NextResponse.json({ error: (error as any).message }, { status: 500 });
  }
}