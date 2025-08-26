'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { AlertTriangle, TrendingUp, TrendingDown, Eye, Loader2 } from 'lucide-react';
import { 
  TradingLogEntry, 
  TradingLogsResponse, 
  PriceComparison, 
  PositionInfo 
} from '@/types/btcdom2';

interface PriceComparisonTableProps {
  marketDataTimestamp: string;
  positions: PositionInfo[];
  className?: string;
}

export function PriceComparisonTable({ 
  marketDataTimestamp, 
  positions,
  className = ""
}: PriceComparisonTableProps) {
  const [tradingLogs, setTradingLogs] = useState<TradingLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [priceComparisons, setPriceComparisons] = useState<PriceComparison[]>([]);

  // 工具函数：格式化时间（使用UTC+0时区）
  const formatPeriodTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
  };

  // 仅在开发环境显示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // 获取交易日志数据
  useEffect(() => {
    const fetchTradingLogs = async () => {
      if (!marketDataTimestamp) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/btcdom2/trading-logs?marketDataTimestamp=${encodeURIComponent(marketDataTimestamp)}`);
        const data: TradingLogsResponse = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        if (data.success) {
          setTradingLogs(data.data || []);
        } else {
          throw new Error(data.error || '获取交易日志失败');
        }
      } catch (err: any) {
        console.error('获取交易日志失败:', err);
        setError(err.message || '获取交易日志失败');
        setTradingLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTradingLogs();
  }, [marketDataTimestamp]);

  // 处理价格对比计算
  useEffect(() => {
    if (!tradingLogs.length || !positions.length) {
      setPriceComparisons([]);
      return;
    }

    const comparisons: PriceComparison[] = [];

    // 标准化symbol名称 (去掉USDT后缀)
    const normalizeSymbol = (symbol: string) => {
      return symbol.replace('USDT', '').toUpperCase();
    };

    positions.forEach(position => {
      const positionSymbol = normalizeSymbol(position.symbol);
      
      // 查找对应的交易日志
      const relevantLogs = tradingLogs.filter(log => {
        const logSymbol = normalizeSymbol(log.symbol);
        return logSymbol === positionSymbol && log.status === 'SUCCESS';
      });

      if (relevantLogs.length === 0) return;

      // 按时间排序交易日志
      const sortedLogs = relevantLogs.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // 判断持仓状态：isSoldOut === true 表示完全平仓
      const isClosed = position.isSoldOut === true;
      
      // 判断当期交易类型：buy=买入/加仓，sell=卖出/减仓，hold=持仓不变
      const tradingType = position.periodTradingType;
      
      // 根据持仓方向和交易类型判断是开仓还是平仓操作
      // 对于做多（LONG）：buy=开仓，sell=平仓
      // 对于做空（SHORT）：sell=开仓，buy=平仓
      const isClosingTrade = isClosed || 
        (position.side === 'LONG' && tradingType === 'sell') ||
        (position.side === 'SHORT' && tradingType === 'buy');
      
      let comparison: PriceComparison;

      if (isClosingTrade) {
        // 平仓或减仓操作：显示平仓价格
        const liveExitPrice = sortedLogs[0]?.price;
        const backtestExitPrice = position.periodTradingPrice || position.currentPrice;

        // 计算平仓价差
        const exitPriceDiff = backtestExitPrice && liveExitPrice 
          ? backtestExitPrice - liveExitPrice : undefined;
        const exitPriceDiffPercent = backtestExitPrice && liveExitPrice && liveExitPrice > 0
          ? ((backtestExitPrice - liveExitPrice) / liveExitPrice) * 100 : undefined;

        comparison = {
          symbol: position.symbol,
          status: isClosed ? 'closed' : 'holding',
          position: position,
          backtest: {
            entryPrice: undefined,
            exitPrice: backtestExitPrice,
          },
          live: {
            entryPrice: undefined,
            exitPrice: liveExitPrice,
          },
          differences: {
            entryPriceDiff: undefined,
            entryPriceDiffPercent: undefined,
            exitPriceDiff,
            exitPriceDiffPercent,
          },
        };
      } else {
        // 开仓或加仓操作：显示开仓价格
        const liveEntryPrice = sortedLogs[0]?.price;
        const backtestEntryPrice = position.periodTradingPrice || position.entryPrice;

        // 计算开仓价差
        const entryPriceDiff = backtestEntryPrice && liveEntryPrice 
          ? backtestEntryPrice - liveEntryPrice : undefined;
        const entryPriceDiffPercent = backtestEntryPrice && liveEntryPrice && liveEntryPrice > 0
          ? ((backtestEntryPrice - liveEntryPrice) / liveEntryPrice) * 100 : undefined;

        comparison = {
          symbol: position.symbol,
          status: 'holding',
          position: position,
          backtest: {
            entryPrice: backtestEntryPrice,
            exitPrice: undefined,
          },
          live: {
            entryPrice: liveEntryPrice,
            exitPrice: undefined,
          },
          differences: {
            entryPriceDiff,
            entryPriceDiffPercent,
            exitPriceDiff: undefined,
            exitPriceDiffPercent: undefined,
          },
        };
      }

      comparisons.push(comparison);
    });

    setPriceComparisons(comparisons);
  }, [tradingLogs, positions]);

  // 格式化价格
  const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === null) return '--';
    return `$${price.toFixed(6)}`;
  };

  // 格式化价差
  const formatPriceDiff = (diff: number | undefined, percent: number | undefined, position: PositionInfo, isEntry: boolean) => {
    if (diff === undefined || percent === undefined) return '--';
    
    let displayDiff = diff;
    let displayPercent = percent;
    
    // 对于做空，调整显示逻辑
    if (position.side === 'SHORT') {
      // 对于做空，我们希望实盘价格有利的情况显示为正数
      if (isEntry) {
        // 开仓：实盘开仓价高有利，所以当diff < 0时，显示为正数
        displayDiff = -diff;
        displayPercent = -percent;
      } else {
        // 平仓：实盘平仓价低有利，所以当diff > 0时，显示为正数（保持原样）
        // displayDiff = diff; // 保持原样
      }
    }
    
    const diffStr = displayDiff > 0 ? `+$${Math.abs(displayDiff).toFixed(6)}` : `-$${Math.abs(displayDiff).toFixed(6)}`;
    const percentStr = displayPercent > 0 ? `+${displayPercent.toFixed(3)}%` : `${displayPercent.toFixed(3)}%`;
    
    return `${diffStr} (${percentStr})`;
  };

  // 获取价差颜色 - 基于显示值判断颜色
  const getDiffColor = (diff: number | undefined, position: PositionInfo, isEntry: boolean) => {
    if (diff === undefined || diff === null) return 'text-gray-400 dark:text-gray-500';
    if (Math.abs(diff) < 0.000001) return 'text-gray-600 dark:text-gray-400'; // 基本相等
    
    let displayDiff = diff;
    
    // 对于做空，调整显示逻辑 - 与formatPriceDiff保持一致
    if (position.side === 'SHORT' && isEntry) {
      displayDiff = -diff;
    }
    
    // 根据调整后的显示值判断颜色：正数绿色，负数红色
    return displayDiff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className={`mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 ${className}`}>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-green-600" />
          <span className="font-medium text-green-800 dark:text-green-200">正在加载价格对比数据...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 ${className}`}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="font-medium text-red-800 dark:text-red-200">价格对比数据加载失败</span>
        </div>
        <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
      </div>
    );
  }

  if (!priceComparisons.length) {
    return (
      <div className={`mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 ${className}`}>
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-yellow-600" />
          <span className="font-medium text-yellow-800 dark:text-yellow-200">暂无价格对比数据</span>
        </div>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
          未找到对应时间段的实盘交易数据，或持仓列表为空
        </p>
      </div>
    );
  }

  return (
    <div className={`mt-4 ${className}`}>
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="w-4 h-4 text-green-600" />
            回测 vs 实盘价格对比
            <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
              仅开发环境可见
            </Badge>
          </CardTitle>
          <p className="text-xs text-green-700 dark:text-green-300">
            对比回测开平仓价格与实盘交易价格，帮助验证策略执行准确性
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">标的</TableHead>
                  <TableHead className="w-16">状态</TableHead>
                  <TableHead className="text-right">回测开仓价</TableHead>
                  <TableHead className="text-right">实盘开仓价</TableHead>
                  <TableHead className="text-right">开仓价差</TableHead>
                  <TableHead className="text-right">回测平仓价</TableHead>
                  <TableHead className="text-right">实盘平仓价</TableHead>
                  <TableHead className="text-right">平仓价差</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceComparisons.map((comparison, index) => (
                  <TableRow key={`${comparison.symbol}-${index}`}>
                    <TableCell className="font-medium">{comparison.symbol}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={comparison.status === 'holding' ? "default" : "secondary"}
                        className={`text-xs px-2 py-1 ${
                          comparison.status === 'holding' 
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' 
                            : 'bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        {comparison.status === 'holding' ? '持仓中' : '已平仓'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPrice(comparison.backtest.entryPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPrice(comparison.live.entryPrice)}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${getDiffColor(comparison.differences.entryPriceDiff, comparison.position, true)}`}>
                      {formatPriceDiff(comparison.differences.entryPriceDiff, comparison.differences.entryPriceDiffPercent, comparison.position, true)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPrice(comparison.backtest.exitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPrice(comparison.live.exitPrice)}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${getDiffColor(comparison.differences.exitPriceDiff, comparison.position, false)}`}>
                      {formatPriceDiff(comparison.differences.exitPriceDiff, comparison.differences.exitPriceDiffPercent, comparison.position, false)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* 汇总统计 */}
          <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span>对比标的数:</span>
                <span className="ml-1 font-medium">{priceComparisons.length}</span>
              </div>
              <div>
                <span className="text-green-600 dark:text-green-400">持仓中:</span>
                <span className="ml-1 font-medium text-green-600 dark:text-green-400">
                  {priceComparisons.filter(c => c.status === 'holding').length}
                </span>
              </div>
              <div>
                <span>已平仓:</span>
                <span className="ml-1 font-medium text-gray-600 dark:text-gray-400">
                  {priceComparisons.filter(c => c.status === 'closed').length}
                </span>
              </div>
              <div>
                <span>实盘交易记录:</span>
                <span className="ml-1 font-medium">{tradingLogs.length}</span>
              </div>
              <div>
                <span>数据时间:</span>
                <span className="ml-1 font-medium">{formatPeriodTime(marketDataTimestamp)}</span>
              </div>
            </div>
            {priceComparisons.length > 0 && (
              <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded"></div>
                    <span>持仓中：显示开仓价格对比</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-100 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded"></div>
                    <span>已平仓：显示平仓价格对比</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}