"use client"

import { useEffect, useState } from "react"
import { AssetIcon } from "./asset-icons"
import { Skeleton } from "./ui/skeleton"
import { Card, CardContent } from "./ui/card"

// 定义加密货币价格数据类型
interface CryptoPriceData {
  symbol: string
  currentPrice: number
  dayChange: number | null // 24小时变动百分比
  weekChange: number | null // 7天变动百分比
  lastUpdated: string
  error?: string // 添加错误字段，用于标记获取失败的资产
}

interface MarketReferenceProps {
  comparisonAssets?: string[];
}

export function MarketReference({ comparisonAssets = [] }: MarketReferenceProps) {
  const [cryptoData, setCryptoData] = useState<CryptoPriceData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchCryptoPrices() {
      try {
        setLoading(true)
        
        // 使用传入的比较资产列表，如果为空则使用默认列表
        const assetsToFetch = comparisonAssets;
        // 为每个资产单独获取数据，这样一个失败不会影响其他的
        const results = await Promise.all(
          assetsToFetch.map(async (asset) => {
            const symbol = asset.toUpperCase();
            const apiSymbol = asset.toLowerCase();
            
            try {
              // 获取资产数据
              const response = await fetch(`/api/price/${apiSymbol}`);
              
              // 检查响应状态
              if (!response.ok) {
                throw new Error(`API请求失败，状态码: ${response.status}`);
              }
              
              // 解析JSON响应
              const data = await response.json();
              
              // 检查API响应是否成功
              if (!data.success) {
                throw new Error(data.error || '未知错误');
              }
              
              // 返回格式化的数据
              return {
                symbol: symbol,
                currentPrice: data.data.price,
                dayChange: data.data.priceChange24h,
                weekChange: data.data.priceChange7d,
                lastUpdated: data.data.lastUpdated
              };
            } catch (err) {
              console.error(`获取${symbol}数据失败:`, err);
              
              // 返回带有错误信息的数据对象
              return {
                symbol: symbol,
                currentPrice: 0,
                dayChange: null,
                weekChange: null,
                lastUpdated: new Date().toISOString(),
                error: err instanceof Error ? err.message : '未知错误'
              };
            }
          })
        );
        
        setCryptoData(results);
        setLoading(false);
      } catch (err) {
        console.error('获取市场数据失败:', err);
        setLoading(false);
      }
    }
    if (!loading && comparisonAssets.length > 0) {
      fetchCryptoPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonAssets])
  
  // 格式化价格变动，添加+/-符号和颜色类
  const formatPriceChange = (change: number | undefined | null) => {
    if (change === undefined || change === null) return '-'
    const prefix = change >= 0 ? '+' : ''
    return `${prefix}${change.toFixed(2)}%`
  }
  
  // 获取价格变动的CSS类
  const getPriceChangeClass = (change: number | undefined | null) => {
    if (change === undefined || change === null) return 'text-muted-foreground'
    return change >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {!cryptoData.length && [...Array(comparisonAssets.length)].map((_, i) => (
            <Card key={i} className="bg-card">
              <CardContent className="p-2">
                <Skeleton className="h-6 w-16 md:w-24 mb-1" />
                <Skeleton className="h-4 w-full mt-1" />
              </CardContent>
            </Card>
          ))}
          {cryptoData.length > 0 && cryptoData.map((crypto) => (
            <div key={crypto.symbol} className="p-2 border rounded-lg hover:shadow-sm transition-shadow duration-200 bg-card text-card-foreground">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <AssetIcon symbol={crypto.symbol} size={16} />
                  <div className="font-medium text-sm">{crypto.symbol}</div>
                </div>
                {crypto.error ? (
                  <div className="text-xs text-red-500 dark:text-red-400 font-medium">
                    获取失败
                  </div>
                ) : (
                  <div className="text-base font-bold">
                    ${crypto.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: crypto.currentPrice < 10 ? 4 : 2 })}
                  </div>
                )}
              </div>
              {!crypto.error && (
                <div className="flex justify-between text-xs mt-1">
                  <div>
                    <span className="text-muted-foreground">24h: </span>
                    <span className={getPriceChangeClass(crypto.dayChange)}>
                      {formatPriceChange(crypto.dayChange)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">7d: </span>
                    <span className={getPriceChangeClass(crypto.weekChange)}>
                      {formatPriceChange(crypto.weekChange)}
                    </span>
                  </div>
                </div>
              )}
              {crypto.error && (
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="truncate" title={crypto.error}>数据暂时不可用</span>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
