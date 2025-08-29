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
  PositionInfo,
  BTCDOM2BacktestResult,
  MarketPriceSnapshot,
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
  previousBalance,
  initialCapital = DEFAULT_INITIAL_CAPITAL
}: PriceComparisonTableProps) {
  const [tradingLogs, setTradingLogs] = useState<TradingLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // 实盘市值价格快照和持仓历史数据
  const [marketPriceSnapshot, setMarketPriceSnapshot] = useState<MarketPriceSnapshot | null>(null);
  const [marketPriceLoading, setMarketPriceLoading] = useState<boolean>(false);
  const [positionHistory, setPositionHistory] = useState<Btcdom2PositionHistory | null>(null);
  const [positionHistoryLoading, setPositionHistoryLoading] = useState<boolean>(false);
  
  // 综合对比数据
  const [enhancedComparisons, setEnhancedComparisons] = useState<EnhancedComprehensivePriceComparison[]>([]);
  const [enhancedSummary, setEnhancedSummary] = useState<EnhancedComprehensiveDifferenceSummary | null>(null);



  // 综合差异计算函数 - 正确区分持仓和交易数量
  const calculateComprehensiveDifference = (
    position: PositionInfo,
    tradingLog: TradingLogEntry | null,
    marketPriceSnapshot: MarketPriceSnapshot,
    positionHistory: Btcdom2PositionHistory | null
  ): EnhancedComprehensiveDifference => {
    // 数据验证
    if (!position) {
      throw new Error('Position data is required for enhanced calculation');
    }
    if (!marketPriceSnapshot) {
      throw new Error('Market price snapshot is required for enhanced calculation');
    }

    const result: EnhancedComprehensiveDifference = {
      marketValueDiff: 0,
      executionDiff: 0,
      totalImpact: 0,
      holdingAmountDiff: 0,
      tradingAmountDiff: 0,
      
      // 持仓数量对比
      backtestHoldingQuantity: position.isSoldOut ? 0 : Math.max(0, position.quantity || 0),
      realHoldingQuantity: 0,
      holdingQuantityDiff: 0,
      holdingQuantityDiffPercent: 0,
      
      // 交易数量对比
      backtestTradingQuantity: Math.abs(position.tradingQuantity || 0),
      realTradingQuantity: Math.abs(tradingLog?.quantity || 0),
      tradingQuantityDiff: 0,
      tradingQuantityDiffPercent: 0,
      
      // 价格信息
      backtestMarketPrice: position.currentPrice > 0 ? position.currentPrice : undefined,
      realMarketPrice: undefined,
      backtestExecutionPrice: position.periodTradingPrice && position.periodTradingPrice > 0 ? position.periodTradingPrice : undefined,
      realExecutionPrice: tradingLog?.price && tradingLog.price > 0 ? tradingLog.price : undefined,
      
      calculationType: 'none',
      calculationNote: '',
      hasValidData: false
    };

    // 1. 获取实盘市值价格
    const symbol = position.symbol;
    if (!symbol) {
      result.calculationNote = '错误：持仓symbol为空';
      return result;
    }

    try {
      if (symbol === 'BTCUSDT') {
        result.realMarketPrice = marketPriceSnapshot.btc_price_used;
        if (!result.realMarketPrice || result.realMarketPrice <= 0) {
          result.calculationNote = '警告：BTC市值价格无效';
        }
      } else {
        result.realMarketPrice = marketPriceSnapshot.alt_prices_snapshot?.[symbol];
        if (!result.realMarketPrice || result.realMarketPrice <= 0) {
          result.calculationNote = `警告：${symbol}市值价格无效或缺失`;
        }
      }
    } catch (error) {
      result.calculationNote = `错误：获取${symbol}市值价格时发生异常`;
      console.error('市值价格获取异常:', error);
      return result;
    }

    // 2. 获取实盘持仓数量
    if (positionHistory && positionHistory.positions) {
      const normalizeSymbol = (sym: string) => sym.replace('USDT', '').toUpperCase();
      const positionSymbol = normalizeSymbol(symbol);
      
      if (positionSymbol === 'BTC' && positionHistory.positions.btc) {
        result.realHoldingQuantity = positionHistory.positions.btc.quantity;
      } else {
        // 在做空列表中查找
        const shortPosition = positionHistory.positions.shorts.find(
          short => normalizeSymbol(short.symbol) === positionSymbol
        );
        result.realHoldingQuantity = shortPosition ? shortPosition.quantity : 0;
      }
    }

    // 3. 计算持仓数量差异
    result.holdingQuantityDiff = result.backtestHoldingQuantity - result.realHoldingQuantity;
    result.holdingQuantityDiffPercent = result.realHoldingQuantity > 0 
      ? (result.holdingQuantityDiff / result.realHoldingQuantity) * 100 
      : 0;

    // 4. 计算交易数量差异
    if (result.backtestTradingQuantity !== undefined && result.realTradingQuantity !== undefined) {
      result.tradingQuantityDiff = result.backtestTradingQuantity - result.realTradingQuantity;
      result.tradingQuantityDiffPercent = result.realTradingQuantity > 0 
        ? (result.tradingQuantityDiff / result.realTradingQuantity) * 100 
        : 0;
    }

    // 5. 判断持仓状态和计算类型
    const isClosed = position.isSoldOut === true;
    const tradingType = position.periodTradingType;
    const isClosingTrade = isClosed || 
      (position.side === 'LONG' && tradingType === 'sell') ||
      (position.side === 'SHORT' && tradingType === 'buy');

    // 6. 计算持仓金额差异（有持仓时）
    if (position.quantity > 0 && result.realMarketPrice !== undefined && result.backtestMarketPrice !== undefined) {
      // 计算持仓金额差异 = (回测持仓数量 × 回测市值价格) - (实盘持仓数量 × 实盘市值价格)
      const backtestHoldingAmount = result.backtestHoldingQuantity * result.backtestMarketPrice;
      const realHoldingAmount = result.realHoldingQuantity * result.realMarketPrice;
      
      result.holdingAmountDiff = backtestHoldingAmount - realHoldingAmount;
      result.marketValueDiff = result.holdingAmountDiff;
      
      result.calculationType = 'market_value';
      result.calculationNote = `持仓金额差异：回测$${backtestHoldingAmount.toFixed(2)} - 实盘$${realHoldingAmount.toFixed(2)} = $${result.holdingAmountDiff.toFixed(2)}`;
      result.hasValidData = true;
    }

    // 7. 计算交易金额差异（仅平仓时）
    if (isClosingTrade && result.backtestExecutionPrice && result.realExecutionPrice && 
        result.backtestTradingQuantity !== undefined && result.realTradingQuantity !== undefined) {
      
      // 计算交易金额差异 = (回测交易数量 × 回测执行价格) - (实盘交易数量 × 实盘执行价格)
      const backtestTradingAmount = result.backtestTradingQuantity * result.backtestExecutionPrice;
      const realTradingAmount = result.realTradingQuantity * result.realExecutionPrice;
      
      let tradingAmountDiff = backtestTradingAmount - realTradingAmount;
      
      // 调整交易金额差异符号（做多和做空的差异方向不同）
      if (position.side === 'LONG') {
        // 做多平仓：实盘价格高有利，符号取反
        tradingAmountDiff = -tradingAmountDiff;
      }
      // 做空平仓：实盘价格低有利，保持原符号
      
      result.tradingAmountDiff = tradingAmountDiff;
      result.executionDiff = tradingAmountDiff;
      
      if (result.calculationType === 'market_value') {
        result.calculationType = 'both';
        result.calculationNote += ` + 交易金额差异：回测${result.backtestTradingQuantity.toFixed(6)}×$${result.backtestExecutionPrice.toFixed(6)}=$${backtestTradingAmount.toFixed(2)} - 实盘${result.realTradingQuantity.toFixed(6)}×$${result.realExecutionPrice.toFixed(6)}=$${realTradingAmount.toFixed(2)} = $${tradingAmountDiff.toFixed(2)}`;
      } else {
        result.calculationType = 'execution';
        result.calculationNote = `交易金额差异：回测${result.backtestTradingQuantity.toFixed(6)}×$${result.backtestExecutionPrice.toFixed(6)}=$${backtestTradingAmount.toFixed(2)} - 实盘${result.realTradingQuantity.toFixed(6)}×$${result.realExecutionPrice.toFixed(6)}=$${realTradingAmount.toFixed(2)} = $${tradingAmountDiff.toFixed(2)}`;
      }
      result.hasValidData = true;
    }

    // 8. 计算总影响
    result.totalImpact = result.marketValueDiff + result.executionDiff;
    
    if (!result.hasValidData) {
      result.calculationNote = '无有效数据进行对比';
    }
    
    return result;
  };

  // 判断持仓状态的工具函数
  const getPositionStatus = (position: PositionInfo): EnhancedComprehensivePriceComparison['status'] => {
    if (position.isSoldOut) return 'full_close';
    
    const tradingType = position.periodTradingType;
    const quantityChange = position.quantityChange;
    
    if (quantityChange?.type === 'new') return 'new_position';
    if (quantityChange?.type === 'increase' || tradingType === 'buy') return 'add_position';
    if (quantityChange?.type === 'decrease' && position.quantity > 0) return 'partial_close';
    if (tradingType === 'hold' || !tradingType) return 'holding';
    
    return 'holding'; // 默认
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

  // 获取实盘市值价格数据
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const fetchMarketPriceSnapshot = async () => {
      if (!marketDataTimestamp) return;

      setMarketPriceLoading(true);

      try {
        // 使用现有的接口获取实盘市值价格
        const timestamp = new Date(marketDataTimestamp);
        const startDate = timestamp.toISOString();
        const endDate = timestamp.toISOString();
        
        const response = await fetch(
          `/api/btcdom2/performance?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&limit=1`
        );
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        if (data.success && data.data.length > 0) {
          const performanceData = data.data[0];
          
          // 检查是否有必要的市值价格字段
          if (performanceData.btc_price_used && performanceData.alt_prices_snapshot) {
            setMarketPriceSnapshot({
              btc_price_used: performanceData.btc_price_used,
              alt_prices_snapshot: performanceData.alt_prices_snapshot,
              market_data_timestamp: performanceData.market_data_timestamp || marketDataTimestamp
            });
          } else {
            console.warn('市值价格数据不完整:', performanceData);
            setMarketPriceSnapshot(null);
          }
        } else {
          console.warn('未找到对应时间的市值价格数据');
          setMarketPriceSnapshot(null);
        }
      } catch (err: unknown) {
        console.error('获取市值价格数据失败:', err);
        setMarketPriceSnapshot(null);
      } finally {
        setMarketPriceLoading(false);
      }
    };

    fetchMarketPriceSnapshot();
  }, [marketDataTimestamp]);

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
    if (!tradingLogs.length || !positions.length || !marketPriceSnapshot || !positionHistory) {
      setEnhancedComparisons([]);
      setEnhancedSummary(null);
      return;
    }

    const enhancedComparisons: EnhancedComprehensivePriceComparison[] = [];

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

      // 按时间排序交易日志，取最新的作为相关日志
      const sortedLogs = relevantLogs.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const relevantLog = sortedLogs[0] || null;

      try {
        // 计算综合差异
        const difference = calculateComprehensiveDifference(
          position,
          relevantLog,
          marketPriceSnapshot,
          positionHistory
        );

        // 确定持仓状态
        const status = getPositionStatus(position);

        enhancedComparisons.push({
          symbol: position.symbol,
          position,
          tradingLog: relevantLog,
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
          tradingAmountDiff: 0,
          backtestHoldingQuantity: position.quantity || 0,
          realHoldingQuantity: 0,
          holdingQuantityDiff: 0,
          holdingQuantityDiffPercent: 0,
          backtestTradingQuantity: position.tradingQuantity,
          realTradingQuantity: relevantLog?.quantity,
          tradingQuantityDiff: 0,
          tradingQuantityDiffPercent: 0,
          backtestMarketPrice: position.currentPrice,
          realMarketPrice: undefined,
          backtestExecutionPrice: position.periodTradingPrice,
          realExecutionPrice: undefined,
          calculationType: 'none',
          calculationNote: `计算错误: ${error instanceof Error ? error.message : '未知错误'}`,
          hasValidData: false
        };

        enhancedComparisons.push({
          symbol: position.symbol,
          position,
          tradingLog: relevantLog,
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
      totalTradingAmountDiff: 0,
      holdingAmountImpactPercent: 0,
      tradingAmountImpactPercent: 0,
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
        validExecutionPriceCount: 0,
        validPositionHistoryCount: 0,
        holdingQuantityMismatchCount: 0,
        tradingQuantityMismatchCount: 0
      },
      marketDataTimestamp,
      calculationTimestamp: new Date().toISOString()
    };

    enhancedComparisons.forEach(comparison => {
      const { difference, status, position } = comparison;
      
      // 累加差异
      summary.totalMarketValueDiff += difference.marketValueDiff;
      summary.totalExecutionDiff += difference.executionDiff;
      summary.totalImpact += difference.totalImpact;
      summary.totalHoldingAmountDiff += difference.holdingAmountDiff;
      summary.totalTradingAmountDiff += difference.tradingAmountDiff;

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
      const isBtc = normalizeSymbol(position.symbol) === 'BTC';
      if (isBtc) {
        summary.byCoinType.btcImpact += difference.totalImpact;
      } else {
        summary.byCoinType.altImpact += difference.totalImpact;
      }

      // 数据质量统计
      if (difference.realMarketPrice !== undefined) {
        summary.dataQuality.validMarketPriceCount++;
      }
      if (difference.realExecutionPrice !== undefined) {
        summary.dataQuality.validExecutionPriceCount++;
      }
      if (comparison.positionHistory !== null) {
        summary.dataQuality.validPositionHistoryCount++;
      }
      if (Math.abs(difference.holdingQuantityDiff) > 0.000001) {
        summary.dataQuality.holdingQuantityMismatchCount++;
      }
      if (difference.tradingQuantityDiff !== undefined && Math.abs(difference.tradingQuantityDiff) > 0.000001) {
        summary.dataQuality.tradingQuantityMismatchCount++;
      }
    });

    // 计算总影响百分比
    const baseAmount = previousBalance || initialCapital;
    summary.totalImpactPercent = (summary.totalImpact / baseAmount) * 100;
    summary.holdingAmountImpactPercent = (summary.totalHoldingAmountDiff / baseAmount) * 100;
    summary.tradingAmountImpactPercent = (summary.totalTradingAmountDiff / baseAmount) * 100;

    setEnhancedComparisons(enhancedComparisons);
    setEnhancedSummary(summary);
  }, [tradingLogs, positions, marketPriceSnapshot, positionHistory, previousBalance, initialCapital, marketDataTimestamp]);

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





  // 计算单个交易的影响率
  const calculateImpactRate = (diffAmount: number | undefined): string => {
    if (diffAmount === undefined || diffAmount === null) return '--';
    // 使用上一期资产总额，如果没有则回退到初始资金
    const baseAmount = previousBalance || initialCapital;
    const impactRate = (diffAmount / baseAmount) * 100;
    const sign = impactRate >= 0 ? '+' : '';
    return `${sign}${impactRate.toFixed(3)}%`;
  };


  // 新的格式化函数
  const formatQuantityDiff = (diff: number): string => {
    if (Math.abs(diff) < 0.000001) return '0';
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(6)}`;
  };

  const getQuantityDiffColor = (diff: number): string => {
    if (Math.abs(diff) < 0.000001) return 'text-gray-600 dark:text-gray-400';
    return diff > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400';
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

  if (loading || marketPriceLoading || positionHistoryLoading) {
    return (
      <div className={`mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 ${className}`}>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-green-600" />
          <span className="font-medium text-green-800 dark:text-green-200">
            正在加载{positionHistoryLoading ? '持仓历史' : marketPriceLoading ? '市值价格' : '交易日志'}数据...
          </span>
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

  if (!enhancedComparisons.length) {
    return (
      <div className={`mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 ${className}`}>
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-yellow-600" />
          <span className="font-medium text-yellow-800 dark:text-yellow-200">暂无价格对比数据</span>
        </div>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
          {!marketPriceSnapshot ? '未找到对应时间的市值价格数据' : 
           !positionHistory ? '未找到对应时间的持仓历史数据' : 
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
                      <TableHead className="text-center" colSpan={3}>持仓数量对比</TableHead>
                      <TableHead className="text-center" colSpan={2}>市值价格</TableHead>
                      <TableHead className="text-center" colSpan={2}>执行价格</TableHead>
                      <TableHead className="text-center" colSpan={3}>金额差异分析</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead></TableHead>
                      <TableHead className="text-right">回测持仓</TableHead>
                      <TableHead className="text-right">实盘持仓</TableHead>
                      <TableHead className="text-right">持仓差异</TableHead>
                      <TableHead className="text-right">回测市值价</TableHead>
                      <TableHead className="text-right">实盘市值价</TableHead>
                      <TableHead className="text-right">回测执行价</TableHead>
                      <TableHead className="text-right">实盘执行价</TableHead>
                      <TableHead className="text-right">持仓金额差异</TableHead>
                      <TableHead className="text-right">交易金额差异</TableHead>
                      <TableHead className="text-right">总影响</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enhancedComparisons.map((comparison, index) => {
                      const { symbol, difference, status } = comparison;
                      const statusBadge = getStatusBadgeProps(status);
                      
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
                            {difference.backtestHoldingQuantity.toFixed(6)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {difference.realHoldingQuantity.toFixed(6)}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm ${getQuantityDiffColor(difference.holdingQuantityDiff)}`}>
                            {formatQuantityDiff(difference.holdingQuantityDiff)}
                            {Math.abs(difference.holdingQuantityDiffPercent) > 0.1 && (
                              <div className="text-xs opacity-75">
                                ({difference.holdingQuantityDiffPercent > 0 ? '+' : ''}{difference.holdingQuantityDiffPercent.toFixed(2)}%)
                              </div>
                            )}
                          </TableCell>
                          
                          {/* 市值价格 */}
                          <TableCell className="text-right font-mono text-sm">
                            {formatPrice(difference.backtestMarketPrice)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatPrice(difference.realMarketPrice)}
                          </TableCell>
                          
                          {/* 执行价格 */}
                          <TableCell className="text-right font-mono text-sm">
                            {formatPrice(difference.backtestExecutionPrice)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatPrice(difference.realExecutionPrice)}
                          </TableCell>
                          
                          {/* 金额差异分解 */}
                          <TableCell className={`text-right font-mono text-sm ${getPnlColor(difference.holdingAmountDiff)}`}>
                            {formatPnlAmount(difference.holdingAmountDiff)}
                            <div className="text-xs opacity-75">持仓金额</div>
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm ${getPnlColor(difference.tradingAmountDiff)}`}>
                            {formatPnlAmount(difference.tradingAmountDiff)}
                            <div className="text-xs opacity-75">交易金额</div>
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm ${getPnlColor(difference.totalImpact)}`}>
                            {formatPnlAmount(difference.totalImpact)}
                            <div className="text-xs opacity-75">
                              {calculateImpactRate(difference.totalImpact)}
                            </div>
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
                        <CardTitle className="text-sm text-blue-800 dark:text-blue-200">持仓金额差异</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${getPnlColor(enhancedSummary.totalHoldingAmountDiff)}`}>
                          {formatPnlAmount(enhancedSummary.totalHoldingAmountDiff)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          持仓数量×市值价格差异
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-orange-200 dark:border-orange-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-orange-800 dark:text-orange-200">交易金额差异</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${getPnlColor(enhancedSummary.totalTradingAmountDiff)}`}>
                          {formatPnlAmount(enhancedSummary.totalTradingAmountDiff)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          交易数量×执行价格差异
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
                  <p>• <strong>持仓金额差异</strong>：(回测持仓数量 × 回测市值价格) - (实盘持仓数量 × 实盘市值价格)</p>
                  <p>• <strong>交易金额差异</strong>：(回测交易数量 × 回测执行价格) - (实盘交易数量 × 实盘执行价格)</p>
                  <p>• <strong>完整对比</strong>：不单独拆分数量和价格，而是对比完整的金额差异</p>
                  <p>• <strong>数据来源</strong>：实盘持仓数量来自btcdom2_position_history表</p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}