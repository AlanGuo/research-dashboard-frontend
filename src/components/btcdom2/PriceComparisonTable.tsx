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
import { AlertTriangle, Eye, Loader2 } from 'lucide-react';
import { 
  TradingLogEntry, 
  TradingLogsResponse, 
  PriceComparison, 
  PositionInfo,
  PnlDifferenceCalculation,
  TotalPnlDifferenceSummary,
  BTCDOM2BacktestResult
} from '@/types/btcdom2';

interface PriceComparisonTableProps {
  marketDataTimestamp: string;
  positions: PositionInfo[];
  className?: string;
  backtestResult?: BTCDOM2BacktestResult; // 完整回测结果，用于全期数盈亏汇总
}

export function PriceComparisonTable({ 
  marketDataTimestamp, 
  positions,
  className = "",
  backtestResult
}: PriceComparisonTableProps) {
  const [tradingLogs, setTradingLogs] = useState<TradingLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [priceComparisons, setPriceComparisons] = useState<PriceComparison[]>([]);
  const [totalPnlSummary, setTotalPnlSummary] = useState<TotalPnlDifferenceSummary | null>(null);
  const [totalTradingLogs, setTotalTradingLogs] = useState<TradingLogEntry[]>([]);
  const [totalLoading, setTotalLoading] = useState<boolean>(false);

  // 工具函数：格式化时间（使用UTC+0时区）
  const formatPeriodTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
  };

  // 计算盈亏差异
  const calculatePnlDifference = (
    position: PositionInfo,
    backtestEntryPrice?: number,
    liveEntryPrice?: number,
    backtestExitPrice?: number,
    liveExitPrice?: number,
    isClosingTrade: boolean = false
  ): PnlDifferenceCalculation => {
    let entryPnlDiff: number | undefined;
    let exitPnlDiff: number | undefined;
    let hasValidData = false;
    let calculationNote = '';

    const quantity = position.quantity;
    const side = position.side;

    // 计算开仓盈亏差异
    if (backtestEntryPrice !== undefined && liveEntryPrice !== undefined && !isClosingTrade) {
      if (side === 'LONG') {
        // 做多：实盘开仓价低于回测价格有利（节省成本）
        entryPnlDiff = (liveEntryPrice - backtestEntryPrice) * quantity * -1;
      } else {
        // 做空：实盘开仓价高于回测价格有利（获得更高卖价）
        entryPnlDiff = (liveEntryPrice - backtestEntryPrice) * quantity;
      }
      hasValidData = true;
      calculationNote += `开仓差异: ${side === 'LONG' ? '做多' : '做空'} ${quantity.toFixed(6)}个 `;
    }

    // 计算平仓盈亏差异
    if (backtestExitPrice !== undefined && liveExitPrice !== undefined && isClosingTrade) {
      if (side === 'LONG') {
        // 做多：实盘平仓价高于回测价格有利（获得更高卖价）
        exitPnlDiff = (liveExitPrice - backtestExitPrice) * quantity;
      } else {
        // 做空：实盘平仓价低于回测价格有利（以更低价格回购）
        exitPnlDiff = (backtestExitPrice - liveExitPrice) * quantity;
      }
      hasValidData = true;
      calculationNote += `平仓差异: ${side === 'LONG' ? '做多' : '做空'} ${quantity.toFixed(6)}个 `;
    }

    const totalPnlDiff = (entryPnlDiff || 0) + (exitPnlDiff || 0);

    return {
      entryPnlDiff,
      exitPnlDiff,
      totalPnlDiff,
      hasValidData,
      calculationNote: calculationNote || '无可计算数据'
    };
  };

  // 获取交易日志数据
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
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
      } catch (err: unknown) {
        console.error('获取交易日志失败:', err);
        const errorMessage = err instanceof Error ? err.message : '获取交易日志失败';
        setError(errorMessage);
        setTradingLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTradingLogs();
  }, [marketDataTimestamp]);

  // 获取全期数交易日志数据（用于全期盈亏汇总）
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const fetchTotalTradingLogs = async () => {
      if (!backtestResult || !backtestResult.snapshots.length) {
        setTotalTradingLogs([]);
        setTotalPnlSummary(null);
        return;
      }

      setTotalLoading(true);

      try {
        const firstSnapshot = backtestResult.snapshots[0];
        const lastSnapshot = backtestResult.snapshots[backtestResult.snapshots.length - 1];
        
        const response = await fetch(`/api/btcdom2/trading-logs?startTimestamp=${encodeURIComponent(firstSnapshot.timestamp)}&endTimestamp=${encodeURIComponent(lastSnapshot.timestamp)}`);
        const data: TradingLogsResponse = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        if (data.success) {
          setTotalTradingLogs(data.data || []);
        } else {
          throw new Error(data.error || '获取全期交易日志失败');
        }
      } catch (err: unknown) {
        console.error('获取全期交易日志失败:', err);
        setTotalTradingLogs([]);
        setTotalPnlSummary(null);
      } finally {
        setTotalLoading(false);
      }
    };

    fetchTotalTradingLogs();
  }, [backtestResult]);

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
          relevantLog: sortedLogs[0],
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
          pnlDifference: calculatePnlDifference(
            position,
            undefined,
            undefined,
            backtestExitPrice,
            liveExitPrice,
            true
          ),
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
          relevantLog: sortedLogs[0],
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
          pnlDifference: calculatePnlDifference(
            position,
            backtestEntryPrice,
            liveEntryPrice,
            undefined,
            undefined,
            false
          ),
        };
      }

      comparisons.push(comparison);
    });

    setPriceComparisons(comparisons);
  }, [tradingLogs, positions]);

  // 计算全期数盈亏差异汇总
  useEffect(() => {
    if (!backtestResult || !backtestResult.snapshots.length || !totalTradingLogs.length) {
      setTotalPnlSummary(null);
      return;
    }

    const snapshots = backtestResult.snapshots;
    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];

    // 按标的和时间戳创建交易日志查找索引
    const tradingLogIndex = new Map<string, Map<string, TradingLogEntry[]>>();
    
    // 标准化symbol名称 (去掉USDT后缀)
    const normalizeSymbol = (symbol: string) => {
      return symbol.replace('USDT', '').toUpperCase();
    };

    totalTradingLogs.forEach(log => {
      const normalizedSymbol = normalizeSymbol(log.symbol);
      const timestamp = new Date(log.timestamp).toISOString();
      
      if (!tradingLogIndex.has(normalizedSymbol)) {
        tradingLogIndex.set(normalizedSymbol, new Map());
      }
      
      const symbolLogs = tradingLogIndex.get(normalizedSymbol)!;
      if (!symbolLogs.has(timestamp)) {
        symbolLogs.set(timestamp, []);
      }
      
      symbolLogs.get(timestamp)!.push(log);
    });

    // 初始化汇总数据
    const summary: TotalPnlDifferenceSummary = {
      btcLongPnlDiff: 0,
      altShortPnlDiff: 0,
      totalPnlDiff: 0,
      totalPeriods: snapshots.length,
      validCalculations: 0,
      totalCalculations: 0,
      periodRange: {
        startPeriod: 1,
        endPeriod: snapshots.length,
        startTimestamp: firstSnapshot.timestamp,
        endTimestamp: lastSnapshot.timestamp
      },
      breakdown: {
        btcLong: {
          entryPnlDiff: 0,
          exitPnlDiff: 0,
          totalTransactions: 0
        },
        altShort: {
          entryPnlDiff: 0,
          exitPnlDiff: 0,
          totalTransactions: 0
        }
      }
    };

    // 遍历所有快照计算盈亏差异
    snapshots.forEach((snapshot, snapshotIndex) => {
      const allPositions = [
        ...(snapshot.btcPosition ? [snapshot.btcPosition] : []),
        ...snapshot.shortPositions,
        ...(snapshot.soldPositions || [])
      ];

      allPositions.forEach(position => {
        summary.totalCalculations++;
        
        // 防止重复计算：soldPositions中的BTC可能已经在前面的快照中计算过
        // 只有当这是该持仓的最终处理快照时才计算
        const positionSymbol = normalizeSymbol(position.symbol);
        const isBtcPosition = positionSymbol === 'BTC';
        
        // 对于soldPositions，检查是否是重复计算
        if (snapshot.soldPositions && snapshot.soldPositions.includes(position)) {
          // 这是一个已卖出的持仓，检查它是否在之前的快照中已经作为已卖出持仓计算过
          let shouldSkip = false;
          
          // 检查前面的快照是否已经包含这个已卖出的持仓
          for (let i = 0; i < snapshotIndex; i++) {
            const prevSnapshot = snapshots[i];
            
            // 只检查前面快照的soldPositions中是否有相同symbol的已卖出持仓
            if (prevSnapshot.soldPositions) {
              const prevSoldPosition = prevSnapshot.soldPositions.find(prevPos => 
                normalizeSymbol(prevPos.symbol) === positionSymbol
              );
              
              if (prevSoldPosition) {
                shouldSkip = true;
                break;
              }
            }
          }
          
          if (shouldSkip) {
            return; // 跳过重复计算
          }
        }
        
        // 查找对应的交易日志
        const symbolLogs = tradingLogIndex.get(positionSymbol);
        if (!symbolLogs) return;

        // 获取该symbol的所有交易记录
        const allLogsForSymbol: TradingLogEntry[] = [];
        for (const logs of symbolLogs.values()) {
          allLogsForSymbol.push(...logs.filter(log => log.status === 'SUCCESS'));
        }

        if (allLogsForSymbol.length === 0) return;

        // 按时间排序所有交易记录
        const sortedLogs = allLogsForSymbol.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // 根据期数和交易类型找到对应的交易记录
        let relevantLog = sortedLogs[0]; // 默认使用第一条记录
        
        // 如果有periodTradingPrice，尝试匹配最接近的价格
        if (position.periodTradingPrice) {
          const targetPrice = position.periodTradingPrice;
          relevantLog = sortedLogs.reduce((closest, current) => {
            const closestDiff = Math.abs(closest.price - targetPrice);
            const currentDiff = Math.abs(current.price - targetPrice);
            return currentDiff < closestDiff ? current : closest;
          });
        }

        // 判断持仓状态和交易类型
        const isClosed = position.isSoldOut === true;
        const tradingType = position.periodTradingType;
        
        const isClosingTrade = isClosed || 
          (position.side === 'LONG' && tradingType === 'sell') ||
          (position.side === 'SHORT' && tradingType === 'buy');

        let pnlDiff = 0;
        let isValidCalculation = false;

        // 计算交易数量（与当期汇总逻辑完全一致）
        let tradingQuantity = 0;
        
        // 优先使用预计算的 tradingQuantity 字段
        if (position.tradingQuantity !== undefined) {
          tradingQuantity = Math.abs(position.tradingQuantity);
        } else {
          // 回退到交易日志的实际数量
          tradingQuantity = relevantLog?.quantity || 0;
          
          // 如果交易日志数量也没有，再回退到计算逻辑
          if (tradingQuantity === 0) {
            if (isClosingTrade) {
              // 平仓：计算平仓数量
              if (position.quantityChange?.previousQuantity && (position.quantityChange?.type === 'sold' || position.quantityChange?.type === 'decrease')) {
                tradingQuantity = position.quantityChange.previousQuantity - position.quantity;
              } else if (position.quantityChange?.type === 'sold') {
                tradingQuantity = position.quantity;
              }
            } else {
              // 开仓：计算开仓数量
              if (tradingType === 'buy' || tradingType === 'sell' || position.quantityChange?.type === 'new') {
                tradingQuantity = position.quantity;
              } else if (position.quantityChange?.type === 'increase' && position.quantityChange.previousQuantity) {
                tradingQuantity = position.quantity - position.quantityChange.previousQuantity;
              }
            }
          }
        }

        if (isClosingTrade) {
          // 平仓操作
          const liveExitPrice = relevantLog?.price;
          const backtestExitPrice = position.periodTradingPrice || position.currentPrice;

          if (liveExitPrice !== undefined && backtestExitPrice !== undefined) {
            // 计算价格差异
            const priceDiff = backtestExitPrice - liveExitPrice;
            // 计算金额差异（使用实际交易数量）
            let realDiffAmount = priceDiff * Math.abs(tradingQuantity);
            // 平仓：对于BTC做多调整符号，与当期汇总逻辑一致
            if (isBtcPosition && position.side === 'LONG') {
              realDiffAmount = -realDiffAmount;
            }
            pnlDiff = realDiffAmount;
            isValidCalculation = true;
          }
        } else {
          // 开仓操作
          const liveEntryPrice = relevantLog?.price;
          const backtestEntryPrice = position.periodTradingPrice || position.entryPrice;

          if (liveEntryPrice !== undefined && backtestEntryPrice !== undefined) {
            // 计算价格差异
            const priceDiff = backtestEntryPrice - liveEntryPrice;
            // 计算金额差异（使用实际交易数量）
            let realDiffAmount = priceDiff * Math.abs(tradingQuantity);
            // 开仓：对于做空调整符号，与当期汇总逻辑一致
            if (position.side === 'SHORT') {
              realDiffAmount = -realDiffAmount;
            }
            pnlDiff = realDiffAmount;
            isValidCalculation = true;
          }
        }

        if (isValidCalculation) {
          summary.validCalculations++;
          summary.totalPnlDiff += pnlDiff;

          // 添加调试信息（仅在开发环境）
          if (process.env.NODE_ENV === 'development' && isBtcPosition) {
            const priceInfo = isClosingTrade 
              ? `回测平仓价: ${position.periodTradingPrice || position.currentPrice}, 实盘平仓价: ${relevantLog?.price}` 
              : `回测开仓价: ${position.periodTradingPrice || position.entryPrice}, 实盘开仓价: ${relevantLog?.price}`;
            
            // 添加详细的数量计算信息
            const quantityInfo = position.quantityChange ? 
              `quantityChange: {type: ${position.quantityChange.type}, previousQuantity: ${position.quantityChange.previousQuantity}, currentQuantity: ${position.quantity}}` :
              `quantityChange: null, currentQuantity: ${position.quantity}`;
              
            console.log(`[全期数BTC调试] 期数${snapshotIndex + 1}: ${position.symbol}, 交易类型: ${isClosingTrade ? '平仓' : '开仓'}, 持仓方向: ${position.side}, 数量: ${tradingQuantity}, ${priceInfo}, 盈亏差异: $${pnlDiff.toFixed(2)}, 是否已卖出: ${position.isSoldOut}, 交易类型: ${position.periodTradingType}`);
            console.log(`[全期数BTC数量调试] 期数${snapshotIndex + 1}: ${quantityInfo}, 计算出的交易数量: ${tradingQuantity}`);
          }

          // 添加ALT做空调试信息
          if (process.env.NODE_ENV === 'development' && !isBtcPosition && position.side === 'SHORT') {
            const priceInfo = isClosingTrade 
              ? `回测平仓价: ${position.periodTradingPrice || position.currentPrice}, 实盘平仓价: ${relevantLog?.price}` 
              : `回测开仓价: ${position.periodTradingPrice || position.entryPrice}, 实盘开仓价: ${relevantLog?.price}`;
            
            const quantityInfo = position.quantityChange ? 
              `quantityChange: {type: ${position.quantityChange.type}, previousQuantity: ${position.quantityChange.previousQuantity}, currentQuantity: ${position.quantity}}` :
              `quantityChange: null, currentQuantity: ${position.quantity}`;
              
            console.log(`[全期数ALT调试] 期数${snapshotIndex + 1}: ${position.symbol}, 交易类型: ${isClosingTrade ? '平仓' : '开仓'}, 持仓方向: ${position.side}, 数量: ${tradingQuantity}, ${priceInfo}, 盈亏差异: $${pnlDiff.toFixed(2)}, 是否已卖出: ${position.isSoldOut}, 交易类型: ${position.periodTradingType}`);
            console.log(`[全期数ALT数量调试] 期数${snapshotIndex + 1}: ${quantityInfo}, 计算出的交易数量: ${tradingQuantity}, 实盘交易数量: ${relevantLog?.quantity}`);
          }

          if (isBtcPosition) {
            summary.btcLongPnlDiff += pnlDiff;
            summary.breakdown.btcLong.totalTransactions++;
            
            if (isClosingTrade) {
              summary.breakdown.btcLong.exitPnlDiff += pnlDiff;
            } else {
              summary.breakdown.btcLong.entryPnlDiff += pnlDiff;
            }
          } else {
            summary.altShortPnlDiff += pnlDiff;
            summary.breakdown.altShort.totalTransactions++;
            
            if (isClosingTrade) {
              summary.breakdown.altShort.exitPnlDiff += pnlDiff;
            } else {
              summary.breakdown.altShort.entryPnlDiff += pnlDiff;
            }
          }
        }
      });
    });

    // 添加全期数汇总调试信息
    if (process.env.NODE_ENV === 'development') {
      console.log(`[全期数BTC汇总] 总差异: $${summary.btcLongPnlDiff.toFixed(2)}, 开仓: $${summary.breakdown.btcLong.entryPnlDiff.toFixed(2)}, 平仓: $${summary.breakdown.btcLong.exitPnlDiff.toFixed(2)}, 交易次数: ${summary.breakdown.btcLong.totalTransactions}`);
      console.log(`[全期数总汇总] BTC交易差异: $${summary.btcLongPnlDiff.toFixed(2)}, ALT做空差异: $${summary.altShortPnlDiff.toFixed(2)}, 总盈亏差异: $${summary.totalPnlDiff.toFixed(2)}`);
    }

    setTotalPnlSummary(summary);
  }, [backtestResult, totalTradingLogs]);

  // 格式化价格
  const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === null) return '--';
    return `$${price.toFixed(6)}`;
  };

  // 格式化盈亏金额
  const formatPnlAmount = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '--';
    const sign = amount >= 0 ? '+' : '';
    return `${sign}$${amount.toFixed(2)}`;
  };

  // 获取盈亏金额颜色
  const getPnlColor = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return 'text-gray-400 dark:text-gray-500';
    if (Math.abs(amount) < 0.01) return 'text-gray-600 dark:text-gray-400';
    return amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  // 仅在开发环境显示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // 格式化价差金额（考虑价格和数量差异）
  const formatPriceDiffAmount = (diff: number | undefined, percent: number | undefined, position: PositionInfo, isEntry: boolean, relevantLog?: any) => {
    if (diff === undefined || percent === undefined) return '--';
    
    // 获取回测价格
    const backtestPrice = isEntry 
      ? (position.periodTradingPrice || position.entryPrice)
      : (position.periodTradingPrice || position.currentPrice);
    
    // 获取实盘价格
    const livePrice = relevantLog?.price;
    
    if (!backtestPrice || !livePrice) return '--';
    
    // 获取交易数量
    let tradingQuantity = 0;
    
    // 优先使用预计算的 tradingQuantity 字段
    if (position.tradingQuantity !== undefined) {
      tradingQuantity = Math.abs(position.tradingQuantity);
    } else {
      // 回退到交易日志的实际数量
      tradingQuantity = relevantLog?.quantity || 0;
      
      // 如果交易日志数量也没有，再回退到计算逻辑
      if (tradingQuantity === 0) {
        const tradingType = position.periodTradingType;
        const quantityChange = position.quantityChange;
        
        if (isEntry) {
          // 开仓/加仓：使用当期交易的数量
          if (tradingType === 'buy' || tradingType === 'sell' || quantityChange?.type === 'new') {
            tradingQuantity = position.quantity;
          } else if (quantityChange?.type === 'increase' && quantityChange.previousQuantity) {
            tradingQuantity = position.quantity - quantityChange.previousQuantity;
          }
        } else {
          // 平仓/减仓：使用平仓的数量
          if (quantityChange?.previousQuantity && (quantityChange?.type === 'sold' || quantityChange?.type === 'decrease')) {
            tradingQuantity = quantityChange.previousQuantity - position.quantity;
          } else if (quantityChange?.type === 'sold') {
            tradingQuantity = position.quantity;
          }
        }
      }
    }
    
    // 使用统一的交易数量（实盘和回测应该使用相同的数量）
    const usedQuantity = tradingQuantity;
    
    // 计算金额差异：回测金额 - 实盘金额
    const backtestAmount = backtestPrice * usedQuantity;
    const liveAmount = livePrice * usedQuantity;
    let realDiffAmount = backtestAmount - liveAmount;
    
    // 根据交易类型调整符号逻辑
    if (position.side === 'LONG') {
      if (!isEntry) {
        // 做多平仓：实盘收入更多为正（有利），更少为负（不利）
        realDiffAmount = -realDiffAmount;
      } else {
        // 做多开仓：实盘花费更少为正（有利），更多为负（不利）
        // realDiffAmount 保持原样
      }
    } else if (position.side === 'SHORT') {
      if (isEntry) {
        // 做空开仓：实盘收入更多为正（有利），更少为负（不利）
        realDiffAmount = -realDiffAmount;
      } else {
        // 做空平仓：实盘花费更少为正（有利），更多为负（不利）
        // realDiffAmount 保持原样
      }
    }
    
    // 计算百分比（基于实盘金额）
    const displayPercent = liveAmount > 0 ? (realDiffAmount / liveAmount) * 100 : 0;
    
    const diffStr = realDiffAmount > 0 ? `+$${Math.abs(realDiffAmount).toFixed(2)}` : `-$${Math.abs(realDiffAmount).toFixed(2)}`;
    const percentStr = displayPercent > 0 ? `+${displayPercent.toFixed(3)}%` : `${displayPercent.toFixed(3)}%`;
    
    return (
      <div>
        <div className="font-medium">{diffStr}</div>
        <div className="text-xs opacity-75">({percentStr})</div>
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-500 mt-1">
            回测: {usedQuantity.toFixed(4)}@${backtestPrice.toFixed(6)} = ${backtestAmount.toFixed(2)}<br/>
            实盘: {usedQuantity.toFixed(4)}@${livePrice.toFixed(6)} = ${liveAmount.toFixed(2)}
          </div>
        )}
      </div>
    );
  };

  // 获取价差金额颜色 - 基于真实金额差异判断颜色
  const getDiffAmountColor = (diff: number | undefined, position: PositionInfo, isEntry: boolean) => {
    if (diff === undefined || diff === null) return 'text-gray-400 dark:text-gray-500';
    
    // 获取统一的交易数量
    let tradingQuantity = 0;
    
    // 优先使用预计算的 tradingQuantity 字段
    if (position.tradingQuantity !== undefined) {
      tradingQuantity = Math.abs(position.tradingQuantity);
    } else {
      // 回退逻辑：使用原来的计算方式
      const tradingType = position.periodTradingType;
      const quantityChange = position.quantityChange;
      
      if (isEntry) {
        // 开仓/加仓：使用当期交易的数量
        if (tradingType === 'buy' || tradingType === 'sell' || quantityChange?.type === 'new') {
          tradingQuantity = position.quantity;
        } else if (quantityChange?.type === 'increase' && quantityChange.previousQuantity) {
          tradingQuantity = position.quantity - quantityChange.previousQuantity;
        }
      } else {
        // 平仓/减仓：使用平仓的数量
        if (quantityChange?.previousQuantity && (quantityChange?.type === 'sold' || quantityChange?.type === 'decrease')) {
          tradingQuantity = quantityChange.previousQuantity - position.quantity;
        } else if (quantityChange?.type === 'sold') {
          tradingQuantity = position.quantity;
        }
      }
    }
    
    // 计算真实价差金额
    let realDiffAmount = diff * Math.abs(tradingQuantity);
    
    // 对于做多和做空，调整显示逻辑使其符合直觉
    if (position.side === 'LONG') {
      // 对于做多，实盘价格高有利
      if (!isEntry) {
        // 平仓：实盘平仓价高有利，当diff > 0（回测价高于实盘）时显示为负数（损失）
        realDiffAmount = -realDiffAmount;
      }
      // 开仓时保持原样：实盘开仓价低有利，diff > 0时显示正数（有利）
    } else if (position.side === 'SHORT' && isEntry) {
      // 对于做空，开仓时调整显示逻辑
      realDiffAmount = -realDiffAmount;
    }
    
    if (Math.abs(realDiffAmount) < 0.01) return 'text-gray-600 dark:text-gray-400'; // 基本相等
    
    // 根据调整后的真实金额判断颜色：正数绿色，负数红色
    return realDiffAmount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  // 计算开仓和平仓金额差异汇总
  const calculateSummaryAmounts = () => {
    let totalEntryDiffAmount = 0;
    let totalExitDiffAmount = 0;
    
    // 标准化symbol名称 (去掉USDT后缀)
    const normalizeSymbol = (symbol: string) => {
      return symbol.replace('USDT', '').toUpperCase();
    };

    priceComparisons.forEach(comparison => {
      const position = comparison.position;
      const tradingType = position.periodTradingType;
      const quantityChange = position.quantityChange;

      // 计算开仓金额差异
      if (comparison.differences.entryPriceDiff !== undefined) {
        let tradingQuantity = 0;
        
        // 优先使用预计算的 tradingQuantity 字段
        if (position.tradingQuantity !== undefined) {
          tradingQuantity = Math.abs(position.tradingQuantity);
        } else {
          // 回退到交易日志的实际数量
          const relevantLog = comparison.relevantLog;
          tradingQuantity = relevantLog?.quantity || 0;
          
          // 如果交易日志数量也没有，再回退到计算逻辑
          if (tradingQuantity === 0) {
            if (tradingType === 'buy' || tradingType === 'sell' || quantityChange?.type === 'new') {
              tradingQuantity = position.quantity;
            } else if (quantityChange?.type === 'increase' && quantityChange.previousQuantity) {
              tradingQuantity = position.quantity - quantityChange.previousQuantity;
            }
          }
        }

        let realDiffAmount = comparison.differences.entryPriceDiff * Math.abs(tradingQuantity);
        if (position.side === 'SHORT') {
          realDiffAmount = -realDiffAmount;
        }
        
        totalEntryDiffAmount += realDiffAmount;
      }

      // 计算平仓金额差异
      if (comparison.differences.exitPriceDiff !== undefined) {
        let tradingQuantity = 0;
        
        // 优先使用预计算的 tradingQuantity 字段
        if (position.tradingQuantity !== undefined) {
          tradingQuantity = Math.abs(position.tradingQuantity);
        } else {
          // 回退到交易日志的实际数量
          const relevantLog = comparison.relevantLog;
          tradingQuantity = relevantLog?.quantity || 0;
          
          // 如果交易日志数量也没有，再回退到计算逻辑
          if (tradingQuantity === 0) {
            if (quantityChange?.previousQuantity && (quantityChange?.type === 'sold' || quantityChange?.type === 'decrease')) {
              tradingQuantity = quantityChange.previousQuantity - position.quantity;
            } else if (quantityChange?.type === 'sold') {
              tradingQuantity = position.quantity;
            }
          }
        }

        let realDiffAmount = comparison.differences.exitPriceDiff * Math.abs(tradingQuantity);
        // 平仓逻辑：对于做多，调整显示逻辑
        if (position.side === 'LONG') {
          realDiffAmount = -realDiffAmount;
        }
        
        totalExitDiffAmount += realDiffAmount;
      }
    });

    // 添加当期汇总调试信息
    if (process.env.NODE_ENV === 'development') {
      const btcEntryDiff = priceComparisons.filter(c => normalizeSymbol(c.position.symbol) === 'BTC' && c.differences.entryPriceDiff !== undefined)
        .reduce((sum, c) => {
          const pos = c.position;
          const qty = pos.periodTradingType === 'buy' || pos.periodTradingType === 'sell' || pos.quantityChange?.type === 'new' ? pos.quantity : 
                      pos.quantityChange?.type === 'increase' && pos.quantityChange.previousQuantity ? pos.quantity - pos.quantityChange.previousQuantity : 0;
          let amt = c.differences.entryPriceDiff! * Math.abs(qty);
          if (pos.side === 'SHORT') amt = -amt;
          return sum + amt;
        }, 0);
      
      const btcExitDiff = priceComparisons.filter(c => normalizeSymbol(c.position.symbol) === 'BTC' && c.differences.exitPriceDiff !== undefined)
        .reduce((sum, c) => {
          const pos = c.position;
          const qty = pos.quantityChange?.previousQuantity && (pos.quantityChange?.type === 'sold' || pos.quantityChange?.type === 'decrease') ? 
                      pos.quantityChange.previousQuantity - pos.quantity : pos.quantityChange?.type === 'sold' ? pos.quantity : 0;
          let amt = c.differences.exitPriceDiff! * Math.abs(qty);
          if (pos.side === 'LONG') amt = -amt;
          return sum + amt;
        }, 0);
        
      console.log(`[当期BTC汇总] 开仓差异: $${btcEntryDiff.toFixed(2)}, 平仓差异: $${btcExitDiff.toFixed(2)}, 总计: $${(btcEntryDiff + btcExitDiff).toFixed(2)}`);
      console.log(`[当期总汇总] 总开仓差异: $${totalEntryDiffAmount.toFixed(2)}, 总平仓差异: $${totalExitDiffAmount.toFixed(2)}, 总计: $${(totalEntryDiffAmount + totalExitDiffAmount).toFixed(2)}`);
    }

    return { totalEntryDiffAmount, totalExitDiffAmount };
  };

  // 格式化汇总金额
  const formatSummaryAmount = (amount: number) => {
    if (Math.abs(amount) < 0.01) return '$0.00';
    const sign = amount > 0 ? '+' : '';
    return `${sign}$${amount.toFixed(2)}`;
  };

  // 获取汇总金额颜色
  const getSummaryAmountColor = (amount: number) => {
    if (Math.abs(amount) < 0.01) return 'text-gray-600 dark:text-gray-400';
    return amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
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
                  <TableHead className="text-right">交易数量</TableHead>
                  <TableHead className="text-right">回测开仓价</TableHead>
                  <TableHead className="text-right">实盘开仓价</TableHead>
                  <TableHead className="text-right">开仓金额差异</TableHead>
                  <TableHead className="text-right">回测平仓价</TableHead>
                  <TableHead className="text-right">实盘平仓价</TableHead>
                  <TableHead className="text-right">平仓金额差异</TableHead>
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
                      {(() => {
                        const position = comparison.position;
                        const tradingType = position.periodTradingType;
                        const quantityChange = position.quantityChange;
                        const isShort = position.side === 'SHORT';
                        
                        // 计算交易变化数量
                        let changeQuantity = 0;
                        let sign = '';
                        let colorClass = 'text-gray-600 dark:text-gray-400';
                        let operation = '';
                        
                        // 判断交易操作类型
                        if (isShort) {
                          // 做空交易
                          if (tradingType === 'sell' || quantityChange?.type === 'new' || quantityChange?.type === 'increase') {
                            // 做空开仓/加仓：卖出操作
                            if (quantityChange?.type === 'increase' && quantityChange.previousQuantity) {
                              changeQuantity = position.quantity - quantityChange.previousQuantity;
                            } else {
                              changeQuantity = position.quantity;
                            }
                            sign = '-';
                            colorClass = 'text-red-600 dark:text-red-400';
                            operation = quantityChange?.type === 'increase' ? '做空加仓' : '做空开仓';
                          } else if (tradingType === 'buy' || quantityChange?.type === 'sold' || quantityChange?.type === 'decrease') {
                            // 做空平仓/减仓：买入操作
                            if (quantityChange?.previousQuantity) {
                              changeQuantity = quantityChange.previousQuantity - position.quantity;
                            } else {
                              changeQuantity = position.quantity;
                            }
                            sign = '+';
                            colorClass = 'text-green-600 dark:text-green-400';
                            operation = quantityChange?.type === 'decrease' ? '做空减仓' : '做空平仓';
                          } else {
                            // 持仓不变或其他情况
                            return <span className="text-gray-400 dark:text-gray-500">持仓不变</span>;
                          }
                        } else {
                          // 做多交易
                          if (tradingType === 'buy' || quantityChange?.type === 'new' || quantityChange?.type === 'increase') {
                            // 做多开仓/加仓：买入操作
                            if (quantityChange?.type === 'increase' && quantityChange.previousQuantity) {
                              changeQuantity = position.quantity - quantityChange.previousQuantity;
                            } else {
                              changeQuantity = position.quantity;
                            }
                            sign = '+';
                            colorClass = 'text-green-600 dark:text-green-400';
                            operation = quantityChange?.type === 'increase' ? '做多加仓' : '做多开仓';
                          } else if (tradingType === 'sell' || quantityChange?.type === 'sold' || quantityChange?.type === 'decrease') {
                            // 做多平仓/减仓：卖出操作
                            if (quantityChange?.previousQuantity) {
                              changeQuantity = quantityChange.previousQuantity - position.quantity;
                            } else {
                              changeQuantity = position.quantity;
                            }
                            sign = '-';
                            colorClass = 'text-red-600 dark:text-red-400';
                            operation = quantityChange?.type === 'decrease' ? '做多减仓' : '做多平仓';
                          } else {
                            // 持仓不变或其他情况
                            return <span className="text-gray-400 dark:text-gray-500">持仓不变</span>;
                          }
                        }
                        
                        const formattedQuantity = changeQuantity.toLocaleString(undefined, {
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4
                        });
                        
                        return (
                          <span className={colorClass} title={operation}>
                            {sign}{formattedQuantity}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPrice(comparison.backtest.entryPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPrice(comparison.live.entryPrice)}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${getDiffAmountColor(comparison.differences.entryPriceDiff, comparison.position, true)}`}>
                      {formatPriceDiffAmount(comparison.differences.entryPriceDiff, comparison.differences.entryPriceDiffPercent, comparison.position, true, comparison.relevantLog)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPrice(comparison.backtest.exitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPrice(comparison.live.exitPrice)}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${getDiffAmountColor(comparison.differences.exitPriceDiff, comparison.position, false)}`}>
                      {formatPriceDiffAmount(comparison.differences.exitPriceDiff, comparison.differences.exitPriceDiffPercent, comparison.position, false, comparison.relevantLog)}
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* 汇总行 */}
                {priceComparisons.length > 0 && (() => {
                  const { totalEntryDiffAmount, totalExitDiffAmount } = calculateSummaryAmounts();
                  return (
                    <TableRow className="border-t-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
                      <TableCell className="font-bold text-green-800 dark:text-green-200">汇总</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className={`text-right font-mono text-sm font-bold ${getSummaryAmountColor(totalEntryDiffAmount)}`}>
                        {formatSummaryAmount(totalEntryDiffAmount)}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className={`text-right font-mono text-sm font-bold ${getSummaryAmountColor(totalExitDiffAmount)}`}>
                        {formatSummaryAmount(totalExitDiffAmount)}
                      </TableCell>
                    </TableRow>
                  );
                })()}
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

            {/* 全期数盈亏差异汇总 */}
            {totalPnlSummary && totalPnlSummary.validCalculations > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-blue-300 dark:border-blue-700">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    全期数盈亏差异汇总
                  </h4>
                  {totalLoading && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  )}
                </div>
                
                {/* 总体汇总卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">BTC交易差异</div>
                    <div className={`text-lg font-mono font-bold ${getPnlColor(totalPnlSummary.btcLongPnlDiff)}`}>
                      {formatPnlAmount(totalPnlSummary.btcLongPnlDiff)}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {totalPnlSummary.breakdown.btcLong.totalTransactions} 次交易
                    </div>
                  </div>
                  
                  <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">ALT做空差异</div>
                    <div className={`text-lg font-mono font-bold ${getPnlColor(totalPnlSummary.altShortPnlDiff)}`}>
                      {formatPnlAmount(totalPnlSummary.altShortPnlDiff)}
                    </div>
                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      {totalPnlSummary.breakdown.altShort.totalTransactions} 次交易
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">总盈亏差异</div>
                    <div className={`text-lg font-mono font-bold ${getPnlColor(totalPnlSummary.totalPnlDiff)}`}>
                      {formatPnlAmount(totalPnlSummary.totalPnlDiff)}
                    </div>
                    <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      {totalPnlSummary.validCalculations}/{totalPnlSummary.totalCalculations} 有效计算
                    </div>
                  </div>
                </div>

                {/* 期数和统计信息 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg">
                  <div>
                    <span className="text-blue-600 dark:text-blue-400">分析期数:</span>
                    <span className="ml-1 font-medium text-blue-700 dark:text-blue-300">
                      {totalPnlSummary.totalPeriods} 期
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600 dark:text-blue-400">时间范围:</span>
                    <span className="ml-1 font-medium text-blue-700 dark:text-blue-300">
                      {formatPeriodTime(totalPnlSummary.periodRange.startTimestamp)} 至 {formatPeriodTime(totalPnlSummary.periodRange.endTimestamp)}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600 dark:text-blue-400">BTC交易:</span>
                    <span className="ml-1 font-medium text-blue-700 dark:text-blue-300">
                      开仓: {formatPnlAmount(totalPnlSummary.breakdown.btcLong.entryPnlDiff)} / 
                      平仓: {formatPnlAmount(totalPnlSummary.breakdown.btcLong.exitPnlDiff)}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600 dark:text-blue-400">ALT交易:</span>
                    <span className="ml-1 font-medium text-blue-700 dark:text-blue-300">
                      开仓: {formatPnlAmount(totalPnlSummary.breakdown.altShort.entryPnlDiff)} / 
                      平仓: {formatPnlAmount(totalPnlSummary.breakdown.altShort.exitPnlDiff)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                  <p>全期汇总说明：统计整个回测期间所有交易的价格差异对总收益的影响</p>
                </div>
              </div>
            )}
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