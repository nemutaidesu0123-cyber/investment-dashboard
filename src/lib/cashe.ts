import { NextResponse } from "next/server";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5分

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    console.log(`✅ Cache hit for ${key} (age: ${Math.round(age / 1000)}s)`);
    return entry.data;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    console.log(`💾 Cached ${key}`);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const apiCache = new SimpleCache();

// screen.ts での使い方
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  // キャッシュチェック
  const cacheKey = `screening_${symbol}`;
  const cached = apiCache.get(cacheKey);
  if (cached) {
    console.log(`🎯 Returning cached data for ${symbol}`);
    return NextResponse.json(cached);
  }

  try {
    // データ取得（既存のロジック）
    const result = { /* ... */ };
    
    // キャッシュに保存
    apiCache.set(cacheKey, result);
    
    return NextResponse.json(result);
  } catch (error) {
    // エラーハンドリング
  }
}