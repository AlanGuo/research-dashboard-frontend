"use client"

import { useEffect, useState } from "react"
import { CryptoIcon } from "./crypto-icons"

// 定义加密货币价格数据类型
interface CryptoPriceData {
  symbol: string
  name: string
  currentPrice: number
  dayChange: number // 24小时变动百分比
  weekChange: number // 7天变动百分比
  lastUpdated: string
}

export function MarketReference() {
  const [cryptoData, setCryptoData] = useState<CryptoPriceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCryptoPrices() {
      try {
        setLoading(true)
        setError(null) // 重置错误状态
        
        // 使用相对路径，让Next.js处理API基础URL
        // 并行获取BTC、SOL和SUI的价格数据
        const [btcResponse, solResponse, suiResponse] = await Promise.all([
          fetch('/api/price/btcusdt'),
          fetch('/api/price/solusdt'),
          fetch('/api/price/suiusdt')
        ])
        
        // 检查每个响应的状态
        const responses = [btcResponse, solResponse, suiResponse]
        const failedResponses = responses.filter(res => !res.ok)
        
        if (failedResponses.length > 0) {
          const statusCodes = failedResponses.map(res => res.status).join(', ')
          throw new Error(`API请求失败，状态码: ${statusCodes}`)
        }
        
        // 解析JSON响应
        const [btcData, solData, suiData] = await Promise.all([
          btcResponse.json(),
          solResponse.json(),
          suiResponse.json()
        ])
        
        // 检查API响应是否成功
        const apiResponses = [btcData, solData, suiData]
        const failedApiResponses = apiResponses.filter(res => !res.success)
        
        if (failedApiResponses.length > 0) {
          const errors = failedApiResponses.map(res => res.error).join('; ')
          throw new Error(`API返回错误: ${errors}`)
        }
        
        // 转换数据格式
        const formattedData: CryptoPriceData[] = [
          {
            symbol: 'BTC',
            name: '比特币',
            currentPrice: btcData.data.price,
            dayChange: btcData.data.priceChange24h,
            weekChange: btcData.data.priceChange7d,
            lastUpdated: btcData.data.lastUpdated
          },
          {
            symbol: 'SOL',
            name: 'Solana',
            currentPrice: solData.data.price,
            dayChange: solData.data.priceChange24h,
            weekChange: solData.data.priceChange7d,
            lastUpdated: solData.data.lastUpdated
          },
          {
            symbol: 'SUI',
            name: 'Sui',
            currentPrice: suiData.data.price,
            dayChange: suiData.data.priceChange24h,
            weekChange: suiData.data.priceChange7d,
            lastUpdated: suiData.data.lastUpdated
          }
        ]
        
        setCryptoData(formattedData)
        setLoading(false)
      } catch (err) {
        console.error('获取加密货币价格数据失败:', err)
        setError(err instanceof Error ? err.message : '未知错误')
        setLoading(false)
      }
    }
    
    fetchCryptoPrices()
  }, [])
  
  // 格式化价格变动，添加+/-符号和颜色类
  const formatPriceChange = (change: number | undefined | null) => {
    if (change === undefined || change === null) return '-'
    const prefix = change >= 0 ? '+' : ''
    return `${prefix}${change.toFixed(2)}%`
  }
  
  // 获取价格变动的CSS类
  const getPriceChangeClass = (change: number | undefined | null) => {
    if (change === undefined || change === null) return 'text-gray-500'
    return change >= 0 ? 'text-green-500' : 'text-red-500'
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">市场参考</h2>
      <div className="mt-2">
        {loading ? (
          <div className="flex justify-center py-4 space-y-2">
            <div className="h-5 w-5 border-t-2 border-blue-500 rounded-full animate-spin"></div>
            <p className="text-sm text-muted-foreground ml-2">加载市场数据中...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            <p className="font-bold">获取数据失败</p>
            <p className="text-xs mt-1">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs"
            >
              刷新页面
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cryptoData.map((crypto) => (
              <div key={crypto.symbol} className="p-3 border rounded-lg hover:shadow-md transition-shadow duration-200">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <CryptoIcon symbol={crypto.symbol} size={20} />
                    <div className="font-medium">{crypto.name} ({crypto.symbol})</div>
                  </div>
                  <div className="text-lg font-bold">
                    ${crypto.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: crypto.currentPrice < 10 ? 4 : 2 })}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
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
              </div>
            ))}
          </div>
        )}
        <div className="text-xs text-muted-foreground text-right mt-2 flex justify-end items-center gap-1">
          {!loading && !error && cryptoData.length > 0 && (
            <>
              <span>最后更新: {new Date(cryptoData[0].lastUpdated).toLocaleString()}</span>
              <button 
                onClick={() => window.location.reload()} 
                className="ml-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="刷新数据"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6"></path>
                  <path d="M3 12a9 9 0 0 1 15-6.7l3-3.3"></path>
                  <path d="M3 22v-6h6"></path>
                  <path d="M21 12a9 9 0 0 1-15 6.7l-3 3.3"></path>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
