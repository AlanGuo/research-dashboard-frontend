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
import { Eye, Loader2 } from 'lucide-react';
import { 
  PositionInfo,
  BTCDOM2BacktestResult,
  Btcdom2PositionHistory,
  PositionHistoryResponse,
  EnhancedComprehensivePriceComparison,
  EnhancedComprehensiveDifference,
  EnhancedComprehensiveDifferenceSummary
} from '@/types/btcdom2';
import { getConfigValue } from '@/config';

interface PriceComparisonTableProps {
  marketDataTimestamp: string;
  positions: PositionInfo[];
  className?: string;
  backtestResult?: BTCDOM2BacktestResult; // 完整回测结果，用于全期数盈亏汇总
  previousBalance?: number; // 上一期的资产总额，用于计算影响百分比
  initialCapital?: number; // 初始资金，默认5000
}

// 从配置文件获取默认初始资金
const DEFAULT_INITIAL_CAPITAL = getConfigValue('btcdom2.initialCapital', 5000);

export function PriceComparisonTable({ 
  marketDataTimestamp, 
  positions,
  className = "",
  backtestResult,
  previousBalance,
  initialCapital = DEFAULT_INITIAL_CAPITAL
}: PriceComparisonTableProps) {
  
  // 实盘持仓历史数据
  const [positionHistory, setPositionHistory] = useState<Btcdom2PositionHistory | null>(null);
  const [positionHistoryLoading, setPositionHistoryLoading] = useState<boolean>(false);
  
  // 综合对比数据
  const [enhancedComparisons, setEnhancedComparisons] = useState<EnhancedComprehensivePriceComparison[]>([]);
  const [enhancedSummary, setEnhancedSummary] = useState<EnhancedComprehensiveDifferenceSummary | null>(null);



  // 持仓级别的差异计算函数（不包含现金余额差异的重复计算）
  const calculatePositionLevelDifference = (
    position: PositionInfo,
    positionHistory: Btcdom2PositionHistory | null,
    accountLevelCashBalanceDiff: number,
    shouldIncludeCashDiff: boolean
  ): EnhancedComprehensiveDifference => {
    // 数据验证
    if (!position) {
      throw new Error('Position data is required for enhanced calculation');
    }

    const result: EnhancedComprehensiveDifference = {
      marketValueDiff: 0,
      executionDiff: 0,
      totalImpact: 0,
      holdingAmountDiff: 0,
      cashBalanceDiff: shouldIncludeCashDiff ? accountLevelCashBalanceDiff : 0, // 只有第一个币种承担现金余额差异
      
      // 持仓数量对比
      backtestHoldingQuantity: position.isSoldOut ? 0 : Math.max(0, position.quantity || 0),
      realHoldingQuantity: 0,
      holdingQuantityDiff: 0,
      holdingQuantityDiffPercent: 0,
      
      // 价格信息
      backtestMarketPrice: position.currentPrice > 0 ? position.currentPrice : undefined,
      realMarketPrice: undefined,
      holdingPriceDiff: undefined,
      holdingPriceDiffPercent: undefined,
      
      // 浮动盈亏信息
      backtestPnl: position.isSoldOut ? 0 : (position.pnl || 0),
      realUnrealizedPnl: 0,
      pnlDiff: 0,
      
      calculationType: 'simplified',
      calculationNote: '',
      hasValidData: false
    };

    // 1. 获取实盘持仓数量和价值
    const symbol = position.symbol;
    let realHoldingValue = 0; // 实盘持仓金额
    
    if (positionHistory && positionHistory.positions) {
      const positionSymbol = symbol.replace('USDT', '').toUpperCase();
      
      if (positionSymbol === 'BTC' && positionHistory.positions.btc) {
        result.realHoldingQuantity = positionHistory.positions.btc.quantity;
        realHoldingValue = positionHistory.positions.btc.value;
        result.realMarketPrice = positionHistory.positions.btc.avg_price;
        result.realUnrealizedPnl = positionHistory.positions.btc.unrealized_pnl;
      } else {
        // 在做空列表中查找
        const shortPosition = positionHistory.positions.shorts.find(
          short => short.symbol.replace('USDT', '').toUpperCase() === positionSymbol
        );
        result.realHoldingQuantity = shortPosition ? shortPosition.quantity : 0;
        realHoldingValue = shortPosition ? shortPosition.value : 0;
        result.realMarketPrice = shortPosition ? shortPosition.avg_price : undefined;
        result.realUnrealizedPnl = shortPosition ? shortPosition.unrealized_pnl : 0;
      }
    }

    // 2. 计算持仓数量差异
    // 实盘 - 回测：实盘多为正数（绿色），实盘少为负数（红色）
    result.holdingQuantityDiff = result.realHoldingQuantity - result.backtestHoldingQuantity;
    result.holdingQuantityDiffPercent = result.backtestHoldingQuantity > 0 
      ? (result.holdingQuantityDiff / result.backtestHoldingQuantity) * 100 
      : 0;

    // 2.1 计算持仓价格差异
    if (result.backtestMarketPrice !== undefined && result.realMarketPrice !== undefined) {
      // 实盘价格 - 回测价格：实盘价格高为正数，实盘价格低为负数
      result.holdingPriceDiff = result.realMarketPrice - result.backtestMarketPrice;
      result.holdingPriceDiffPercent = result.backtestMarketPrice > 0 
        ? (result.holdingPriceDiff / result.backtestMarketPrice) * 100 
        : 0;
    }

    // 3. 计算持仓金额差异
    // 对于已平仓的币种，回测持仓金额应该是0
    const backtestHoldingAmount = position.isSoldOut ? 0 : (position.amount || 0);
    result.holdingAmountDiff = realHoldingValue - backtestHoldingAmount;
    
    // 3.1 计算浮动盈亏差异（实盘 - 回测）
    result.pnlDiff = result.realUnrealizedPnl - result.backtestPnl;
    
    // 4. 简化计算：总影响 = 浮动盈亏差异 + (现金余额差异，仅第一个币种)
    result.marketValueDiff = result.pnlDiff;
    result.executionDiff = result.cashBalanceDiff;
    result.totalImpact = result.pnlDiff + result.cashBalanceDiff;
    
    // 5. 设置计算说明
    const cashNote = shouldIncludeCashDiff ? ` + 现金余额差异：$${result.cashBalanceDiff.toFixed(2)}` : '';
    result.calculationNote = `浮动盈亏差异：$${result.pnlDiff.toFixed(2)}${cashNote}`;
    result.hasValidData = true;
    
    return result;
  };




  // 获取实盘持仓历史数据
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const fetchPositionHistory = async () => {
      if (!marketDataTimestamp) return;

      setPositionHistoryLoading(true);

      try {
        const timestamp = new Date(marketDataTimestamp);
        const response = await fetch(
          `/api/btcdom2/position-history?endpoint=by-timestamp&marketDataTimestamp=${encodeURIComponent(timestamp.toISOString())}`
        );
        const data: PositionHistoryResponse = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        if (data.success && data.data) {
          // 由于使用by-timestamp端点，data应该是单个对象
          const positionData = Array.isArray(data.data) ? data.data[0] : data.data;
          setPositionHistory(positionData);
          console.log('获取到实盘持仓历史数据:', positionData);
        } else {
          console.warn('未找到对应时间的实盘持仓历史数据');
          setPositionHistory(null);
        }
      } catch (err: unknown) {
        console.error('获取实盘持仓历史数据失败:', err);
        setPositionHistory(null);
      } finally {
        setPositionHistoryLoading(false);
      }
    };

    fetchPositionHistory();
  }, [marketDataTimestamp]);


  // 处理综合价格对比计算
  useEffect(() => {
    if (!positions.length || !positionHistory) {
      setEnhancedComparisons([]);
      setEnhancedSummary(null);
      return;
    }

    // 1. 先计算账户级别的现金余额差异（只计算一次）
    let backtestCashBalance = 0;
    let realCashBalance = 0;
    
    // 获取实盘现金余额 - 使用统一账户余额
    if (positionHistory && positionHistory.positions) {
      // 优先使用统一账户余额，如果不存在则使用旧的分离余额
      if (positionHistory.positions.account_usdt_balance !== undefined) {
        realCashBalance = positionHistory.positions.account_usdt_balance;
      } else {
        // 向后兼容：如果没有统一余额，使用分离的余额
        const spotBalance = positionHistory.positions.spot_usdt_balance || 0;
        const futuresBalance = positionHistory.positions.futures_usdt_balance || 0;
        realCashBalance = spotBalance + futuresBalance;
      }
    }
    
    // 获取回测现金余额 - 从回测结果中找到对应时间点的快照
    if (backtestResult && backtestResult.snapshots) {
      const matchingSnapshot = backtestResult.snapshots.find(snapshot => 
        snapshot.timestamp === marketDataTimestamp
      );
      
      if (matchingSnapshot) {
        // 使用统一账户余额，如果不存在则回退到原来的计算方式
        backtestCashBalance = matchingSnapshot.account_usdt_balance;
      }
    }
    
    const accountLevelCashBalanceDiff = realCashBalance - backtestCashBalance;

    const enhancedComparisons: EnhancedComprehensivePriceComparison[] = [];

    positions.forEach((position, index) => {
      try {
        // 计算持仓级别的差异（不包含现金余额差异）
        const difference = calculatePositionLevelDifference(
          position,
          positionHistory,
          accountLevelCashBalanceDiff,
          index === 0 // 只有第一个币种承担现金余额差异
        );

        // 简化的持仓状态（由于计算逻辑简化，不再需要复杂分类）
        const status = position.isSoldOut ? 'full_close' : 'holding';

        enhancedComparisons.push({
          symbol: position.symbol,
          position,
          positionHistory,
          difference,
          status
        });
      } catch (error) {
        console.error(`计算${position.symbol}增强版综合差异时发生错误:`, error);
        
        // 创建错误占位符
        const errorDifference: EnhancedComprehensiveDifference = {
          marketValueDiff: 0,
          executionDiff: 0,
          totalImpact: 0,
          holdingAmountDiff: 0,
          cashBalanceDiff: index === 0 ? accountLevelCashBalanceDiff : 0, // 只有第一个币种显示
          backtestHoldingQuantity: position.quantity || 0,
          realHoldingQuantity: 0,
          holdingQuantityDiff: 0,
          holdingQuantityDiffPercent: 0,
          backtestMarketPrice: position.currentPrice,
          realMarketPrice: undefined,
          holdingPriceDiff: undefined,
          holdingPriceDiffPercent: undefined,
          backtestPnl: position.isSoldOut ? 0 : (position.pnl || 0),
          realUnrealizedPnl: 0,
          pnlDiff: 0,
          calculationType: 'none',
          calculationNote: `计算错误: ${error instanceof Error ? error.message : '未知错误'}`,
          hasValidData: false
        };

        enhancedComparisons.push({
          symbol: position.symbol,
          position,
          positionHistory,
          difference: errorDifference,
          status: 'holding'
        });
      }
    });

    // 计算增强版汇总统计
    const summary: EnhancedComprehensiveDifferenceSummary = {
      totalMarketValueDiff: 0,
      totalExecutionDiff: 0,
      totalImpact: 0,
      totalImpactPercent: 0,
      totalHoldingAmountDiff: 0,
      totalCashBalanceDiff: accountLevelCashBalanceDiff, // 使用账户级别的现金余额差异
      totalPnlDiff: 0, // 总浮动盈亏差异
      realCashBalance: realCashBalance, // 实盘统一账户余额
      backtestCashBalance: backtestCashBalance, // 回测统一账户余额
      holdingAmountImpactPercent: 0,
      cashBalanceImpactPercent: 0,
      byPositionType: {
        newPositions: 0,
        holdingPositions: 0,
        addPositions: 0,
        partialClosePositions: 0,
        fullClosePositions: 0
      },
      byCoinType: {
        btcImpact: 0,
        altImpact: 0
      },
      dataQuality: {
        totalComparisons: enhancedComparisons.length,
        validMarketPriceCount: 0,
        validPositionHistoryCount: 0,
        holdingQuantityMismatchCount: 0,
      },
      marketDataTimestamp,
      calculationTimestamp: new Date().toISOString()
    };

    enhancedComparisons.forEach(comparison => {
      const { difference, status, position } = comparison;
      
      // 累加差异 - 注意现金余额差异不重复累加
      summary.totalMarketValueDiff += difference.marketValueDiff;
      summary.totalExecutionDiff += difference.executionDiff;
      summary.totalImpact += difference.totalImpact;
      summary.totalHoldingAmountDiff += difference.holdingAmountDiff;
      summary.totalPnlDiff += difference.pnlDiff;
      
      // summary.totalCashBalanceDiff 已经在上面设置为账户级别的值

      // 按持仓类型统计
      switch (status) {
        case 'new_position':
          summary.byPositionType.newPositions++;
          break;
        case 'holding':
          summary.byPositionType.holdingPositions++;
          break;
        case 'add_position':
          summary.byPositionType.addPositions++;
          break;
        case 'partial_close':
          summary.byPositionType.partialClosePositions++;
          break;
        case 'full_close':
          summary.byPositionType.fullClosePositions++;
          break;
      }

      // 按币种类型统计
      const isBtc = position.symbol.replace('USDT', '').toUpperCase() === 'BTC';
      if (isBtc) {
        summary.byCoinType.btcImpact += difference.totalImpact;
      } else {
        summary.byCoinType.altImpact += difference.totalImpact;
      }

      // 数据质量统计
      if (difference.realMarketPrice !== undefined) {
        summary.dataQuality.validMarketPriceCount++;
      }
      if (comparison.positionHistory !== null) {
        summary.dataQuality.validPositionHistoryCount++;
      }
      if (Math.abs(difference.holdingQuantityDiff) > 0.000001) {
        summary.dataQuality.holdingQuantityMismatchCount++;
      }
    });

    // 重新计算总影响：浮动盈亏差异 + 现金余额差异
    summary.totalImpact = summary.totalPnlDiff + summary.totalCashBalanceDiff;
    
    // 计算总影响百分比
    const baseAmount = previousBalance || initialCapital;
    summary.totalImpactPercent = (summary.totalImpact / baseAmount) * 100;
    summary.holdingAmountImpactPercent = (summary.totalHoldingAmountDiff / baseAmount) * 100;
    summary.cashBalanceImpactPercent = (summary.totalCashBalanceDiff / baseAmount) * 100;

    setEnhancedComparisons(enhancedComparisons);
    setEnhancedSummary(summary);
  }, [positions, positionHistory, previousBalance, initialCapital, marketDataTimestamp, backtestResult]);


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








  // 新的格式化函数
  const formatQuantityDiff = (diff: number): string => {
    if (Math.abs(diff) < 0.000001) return '0';
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(6)}`;
  };

  const formatPriceDiff = (diff: number | undefined): string => {
    if (diff === undefined || diff === null) return '--';
    if (Math.abs(diff) < 0.000001) return '0';
    const sign = diff >= 0 ? '+' : '';
    return `${sign}$${diff.toFixed(4)}`;
  };

  const getQuantityDiffColor = (diff: number): string => {
    if (Math.abs(diff) < 0.000001) return 'text-gray-600 dark:text-gray-400';
    // 实盘多（正数）= 绿色，实盘少（负数）= 红色
    return diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const getPriceDiffColor = (diff: number | undefined, isBtc: boolean): string => {
    if (diff === undefined || diff === null) return 'text-gray-400 dark:text-gray-500';
    if (Math.abs(diff) < 0.000001) return 'text-gray-600 dark:text-gray-400';
    
    // diff = 实盘价格 - 回测价格
    // diff > 0 表示实盘价格更高，diff < 0 表示实盘价格更低
    
    if (isBtc) {
      // BTC做多：实盘价格低(diff < 0)是好事 = 绿色，实盘价格高(diff > 0)是坏事 = 红色
      return diff < 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    } else {
      // ALT做空：实盘价格低(diff < 0)是坏事 = 红色，实盘价格高(diff > 0)是好事 = 绿色
      return diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
    }
  };

  const getStatusBadgeProps = (status: EnhancedComprehensivePriceComparison['status']) => {
    switch (status) {
      case 'new_position':
        return { text: '新开仓', className: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' };
      case 'holding':
        return { text: '持仓不变', className: 'bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800' };
      case 'add_position':
        return { text: '加仓', className: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' };
      case 'partial_close':
        return { text: '部分平仓', className: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' };
      case 'full_close':
        return { text: '完全平仓', className: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' };
      default:
        return { text: '未知', className: 'bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800' };
    }
  };

  if (positionHistoryLoading) {
    return (
      <div className={`mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 ${className}`}>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-green-600" />
          <span className="font-medium text-green-800 dark:text-green-200">
            正在加载{positionHistoryLoading ? '持仓历史' : '交易日志'}数据...
          </span>
        </div>
      </div>
    );
  }


  if (!enhancedComparisons.length) {
    return (
      <div className={`mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 ${className}`}>
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-yellow-600" />
          <span className="font-medium text-yellow-800 dark:text-yellow-200">暂无价格对比数据</span>
        </div>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
          {!positionHistory ? '未找到对应时间的持仓历史数据' : 
           '未找到对应时间段的实盘交易数据或持仓列表为空'}
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
          {/* 增强版综合对比表格 - 正确区分持仓和交易数量 */}
          {enhancedComparisons.length > 0 ? (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200">综合差异分析</h3>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">标的</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="text-center" colSpan={4}>持仓对比</TableHead>
                      <TableHead className="text-center" colSpan={2}>金额差异分析</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead></TableHead>
                      <TableHead className="text-right">回测持仓</TableHead>
                      <TableHead className="text-right">实盘持仓</TableHead>
                      <TableHead className="text-right">持仓数量差异</TableHead>
                      <TableHead className="text-right">持仓价格差异</TableHead>
                      <TableHead className="text-right">持仓金额差异</TableHead>
                      <TableHead className="text-right">浮动盈亏差异</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enhancedComparisons.map((comparison, index) => {
                      const { symbol, difference, status } = comparison;
                      const statusBadge = getStatusBadgeProps(status);
                      const isBtc = symbol.replace('USDT', '').toUpperCase() === 'BTC';
                      
                      return (
                        <TableRow key={`${symbol}-${index}`}>
                          <TableCell className="font-medium">{symbol}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs px-2 py-1 ${statusBadge.className}`}>
                              {statusBadge.text}
                            </Badge>
                          </TableCell>
                          
                          {/* 持仓数量对比 */}
                          <TableCell className="text-right font-mono text-sm">
                            <div>{difference.backtestHoldingQuantity.toFixed(6)}</div>
                            {difference.backtestMarketPrice && (
                              <div className="text-xs text-gray-500">@${difference.backtestMarketPrice.toFixed(4)}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <div>{difference.realHoldingQuantity.toFixed(6)}</div>
                            {difference.realMarketPrice && (
                              <div className="text-xs text-gray-500">@${difference.realMarketPrice.toFixed(4)}</div>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm ${getQuantityDiffColor(difference.holdingQuantityDiff)}`}>
                            {formatQuantityDiff(difference.holdingQuantityDiff)}
                            {Math.abs(difference.holdingQuantityDiffPercent) > 0.1 && (
                              <div className="text-xs opacity-75">
                                ({difference.holdingQuantityDiffPercent > 0 ? '+' : ''}{difference.holdingQuantityDiffPercent.toFixed(2)}%)
                              </div>
                            )}
                          </TableCell>
                          
                          {/* 持仓价格差异 */}
                          <TableCell className={`text-right font-mono text-sm ${getPriceDiffColor(difference.holdingPriceDiff, isBtc)}`}>
                            {formatPriceDiff(difference.holdingPriceDiff)}
                            {difference.holdingPriceDiffPercent !== undefined && Math.abs(difference.holdingPriceDiffPercent) > 0.1 && (
                              <div className="text-xs opacity-75">
                                ({difference.holdingPriceDiffPercent > 0 ? '+' : ''}{difference.holdingPriceDiffPercent.toFixed(2)}%)
                              </div>
                            )}
                          </TableCell>
                          
                          {/* 金额差异分解 */}
                          <TableCell className={`text-right font-mono text-sm ${getPnlColor(difference.holdingAmountDiff)}`}>
                            {formatPnlAmount(difference.holdingAmountDiff)}
                            <div className="text-xs opacity-75">持仓金额</div>
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm ${getPnlColor(difference.pnlDiff)}`}>
                            {formatPnlAmount(difference.pnlDiff)}
                            <div className="text-xs opacity-75">浮动盈亏</div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* 增强版综合汇总卡片 */}
              {enhancedSummary && (
                <div>
                  {/* 主要汇总统计 */}
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <Card className="border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-blue-800 dark:text-blue-200">浮动盈亏差异</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${getPnlColor(enhancedSummary.totalPnlDiff)}`}>
                          {formatPnlAmount(enhancedSummary.totalPnlDiff)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          实盘浮动盈亏 - 回测浮动盈亏
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-orange-200 dark:border-orange-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-orange-800 dark:text-orange-200">现金余额差异</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${getPnlColor(enhancedSummary.totalCashBalanceDiff)}`}>
                          {formatPnlAmount(enhancedSummary.totalCashBalanceDiff)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          实盘余额 - 回测余额
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                          <div className="font-medium">实盘余额: ${enhancedSummary.realCashBalance.toFixed(2)}</div>
                          <div className="font-medium mt-2">回测余额: ${enhancedSummary.backtestCashBalance.toFixed(2)}</div>
                        </div>
                      </CardContent>
                    </Card>
                  
                    <Card className="border-indigo-200 dark:border-indigo-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-indigo-800 dark:text-indigo-200">总体影响</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${getPnlColor(enhancedSummary.totalImpact)}`}>
                          {formatPnlAmount(enhancedSummary.totalImpact)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          对收益率影响: {enhancedSummary.totalImpactPercent >= 0 ? '+' : ''}{enhancedSummary.totalImpactPercent.toFixed(3)}%
                        </div>
                    </CardContent>
                  </Card>
                </div>
                </div>
              )}
              
              <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">金额差异计算说明</h4>
                <div className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
                  <p>• <strong>持仓金额差异</strong>：实盘持仓金额 - 回测持仓金额（使用btcdom2_position_history中的value字段）</p>
                  <p>• <strong>浮动盈亏差异</strong>：实盘浮动盈亏 - 回测浮动盈亏（使用btcdom2_position_history中的unrealized_pnl字段）</p>
                  <p>• <strong>现金余额差异</strong>：(实盘现货余额 + 实盘期货余额) - (回测现货余额 + 回测期货余额)</p>
                  <p>• <strong>总影响</strong>：浮动盈亏差异 + 现金余额差异</p>
                  <p>• <strong>数据来源</strong>：</p>
                  <p>&nbsp;&nbsp;- 实盘数据：来自btcdom2_position_history表</p>
                  <p>&nbsp;&nbsp;- 回测数据：来自策略快照</p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}