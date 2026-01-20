import YahooFinance from "yahoo-finance2"
import { Price } from './price'

const yf = new YahooFinance()

export class YahooFinanceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'YahooFinanceError'
  }
}

export async function fetchDailyPrices(symbol: string): Promise<Price[]> {
  try {
    const now = new Date()
    const past = new Date()
    past.setFullYear(past.getFullYear() - 3) // 5 years ago

    const result: any = await yf.historical(symbol, {
      period1: past,
      period2: now,
      interval: '1d',
    })

    if (!result || result.length === 0) {
      throw new YahooFinanceError(`No data for ${symbol}`, 'NO_DATA')
    }

    const prices: Price[] = result.map((item: any) => ({
      symbol,
      date: item.date.toISOString().split('T')[0],
      price: item.close,
    }))

    console.log(`✅ Fetched ${prices.length} prices for ${symbol}`)
    return prices

  } catch (error) {
    throw new YahooFinanceError(
      `Failed to fetch ${symbol}: ${error}`,
      'FETCH_ERROR'
    )
  }
}