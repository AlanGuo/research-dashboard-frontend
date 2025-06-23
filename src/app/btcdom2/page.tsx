'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import OptimizationPanel from './optimization/OptimizationPanel';
import { OptimizationResult } from './optimization/types';

import {
  BTCDOM2StrategyParams,
  BTCDOM2BacktestResult,
  BTCDOM2ChartData,
  StrategySnapshot,
  PositionInfo,
  PositionAllocationStrategy
} from '@/types/btcdom2';
import { BTCDOM2Chart } from '@/components/btcdom2/btcdom2-chart';
import { BTCDOM2PositionTable } from '@/components/btcdom2/btcdom2-position-table';
import { WeightControl } from '@/components/btcdom2/WeightControl';
import IsolatedBtcRatioControl from '@/components/btcdom2/IsolatedBtcRatioControl';
import MaxShortPositionsControl from '@/components/btcdom2/MaxShortPositionsControl';
import { AlertCircle, Play, Settings, TrendingUp, TrendingDown, Clock, Loader2, Eye, Info, Bitcoin, ArrowDown, Zap } from 'lucide-react';

export default function BTCDOM2Dashboard() {
  // 常量定义
  const REBALANCE_HOURS = 8; // 8小时再平衡周期

  // 策略参数状态
  const [params, setParams] = useState<BTCDOM2StrategyParams>({
    startDate: '2020-01-01',
    endDate: '2025-06-21',
    initialCapital: 10000,
    btcRatio: 0.6,
    priceChangeWeight: 0.15,
    volumeWeight: 0.35,
    volatilityWeight: 0.15,
    fundingRateWeight: 0.35,
    maxShortPositions: 5,
    spotTradingFeeRate: 0.0008, // 0.08% 现货手续费
    futuresTradingFeeRate: 0.0002, // 0.02% 期货手续费
    longBtc: true,
    shortAlt: true,
    allocationStrategy: PositionAllocationStrategy.BY_VOLUME
  });

  // 数据状态
  const [backtestResult, setBacktestResult] = useState<BTCDOM2BacktestResult | null>(null);
  const [chartData, setChartData] = useState<BTCDOM2ChartData[]>([]);
  const [currentSnapshot, setCurrentSnapshot] = useState<StrategySnapshot | null>(null);
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState<number>(-1); // -1 表示最新
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // UI状态
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [showOptimization, setShowOptimization] = useState<boolean>(false);

  // 显示参数状态（保持UI响应性）
  const [displayParams, setDisplayParams] = useState<BTCDOM2StrategyParams>(params); 
  
  // 独立的BTC占比状态管理 - 完全隔离，不受其他参数影响
  const [isolatedBtcRatio, setIsolatedBtcRatio] = useState<number>(params.btcRatio);
  
  // 独立的最多做空标的数量状态管理 - 完全隔离，不受其他参数影响
  const [isolatedMaxShortPositions, setIsolatedMaxShortPositions] = useState<number>(params.maxShortPositions);

  // 工具函数：格式化时间（使用UTC+0时区）
  const formatPeriodTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
  };

  // 工具函数：获取数值的颜色类名
  const getValueColorClass = (value: number | null) => {
    const validValue = value ?? 0;
    if (validValue > 0) return 'text-green-600 dark:text-green-400';
    if (validValue < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  // 工具函数：格式化百分比
  const formatPercent = (percent: number) => {
    // 对于百分比，如果是正数加+号，负数保持-号
    const percentSign = percent > 0 ? '+' : '';
    const formattedPercent = `${percentSign}${percent.toFixed(2)}%`;

    return `${formattedPercent}`;
  };

  // 工具函数：格式化金额和百分比的组合显示
  const formatAmountWithPercent = (amount: number, percent: number) => {
    // 对于金额，负号放在$符号前面
    let formattedAmount;
    if (amount > 0) {
      formattedAmount = `+$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (amount < 0) {
      formattedAmount = `-$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      formattedAmount = `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // 对于百分比，如果是正数加+号，负数保持-号
    const percentSign = percent > 0 ? '+' : '';
    const formattedPercent = `${percentSign}${percent.toFixed(2)}%`;

    return `${formattedAmount} (${formattedPercent})`;
  };
  // 验证参数 - 使用 useMemo 缓存验证结果
  // 检查权重是否有效 - 使用显示参数以提供即时反馈
  const isWeightsValid = useMemo(() => {
    const weightSum = displayParams.priceChangeWeight + displayParams.volumeWeight + displayParams.volatilityWeight + displayParams.fundingRateWeight;
    return Math.abs(weightSum - 1) <= 0.001;
  }, [displayParams.priceChangeWeight, displayParams.volumeWeight, displayParams.volatilityWeight, displayParams.fundingRateWeight]);

  // 获取权重总和百分比 - 使用显示参数
  const getWeightSumPercent = useMemo(() => {
    return ((displayParams.priceChangeWeight + displayParams.volumeWeight + displayParams.volatilityWeight + displayParams.fundingRateWeight) * 100).toFixed(0);
  }, [displayParams.priceChangeWeight, displayParams.volumeWeight, displayParams.volatilityWeight, displayParams.fundingRateWeight]);

  // 使用 useMemo 缓存当前参数的验证结果 - 优化版本
  const parameterErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    // 基础参数验证
    if (params.initialCapital <= 0) {
      errors.initialCapital = '初始本金必须大于0';
    }

    if (params.btcRatio < 0 || params.btcRatio > 1) {
      errors.btcRatio = 'BTC占比必须在0-1之间';
    }

    if (params.maxShortPositions <= 0 || params.maxShortPositions > 50) {
      errors.maxShortPositions = '做空标的数量必须在1-50之间';
    }

    if (params.spotTradingFeeRate < 0 || params.spotTradingFeeRate > 0.01) {
      errors.spotTradingFeeRate = '现货交易手续费率必须在0-1%之间';
    }

    if (params.futuresTradingFeeRate < 0 || params.futuresTradingFeeRate > 0.01) {
      errors.futuresTradingFeeRate = '期货交易手续费率必须在0-1%之间';
    }

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    if (startDate >= endDate) {
      errors.dateRange = '开始日期必须早于结束日期';
    }

    if (!params.longBtc && !params.shortAlt) {
      errors.strategySelection = '至少需要选择一种策略：做多BTC或做空ALT';
    }

    // 权重验证 - 使用实际参数的权重验证
    const actualWeightSum = params.priceChangeWeight + params.volumeWeight + params.volatilityWeight + params.fundingRateWeight;
    if (Math.abs(actualWeightSum - 1) > 0.001) {
      errors.weights = '跌幅权重、成交量权重、波动率权重和资金费率权重之和必须等于1';
    }

    return errors;
  }, [
    params.initialCapital,
    params.btcRatio,
    params.maxShortPositions,
    params.spotTradingFeeRate,
    params.futuresTradingFeeRate,
    params.startDate,
    params.endDate,
    params.longBtc,
    params.shortAlt,
    params.priceChangeWeight,
    params.volumeWeight,
    params.volatilityWeight,
    params.fundingRateWeight
  ]);

  // 执行回测
  const runBacktest = useCallback(async (currentParams?: BTCDOM2StrategyParams) => {
    const paramsToUse = currentParams || params;

    // 直接使用 parameterErrors 进行验证
    if (Object.keys(parameterErrors).length > 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/btcdom2/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paramsToUse),
      });

      if (!response.ok) {
        throw new Error(`回测请求失败: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setBacktestResult(result.data);
        setChartData(result.data.chartData);

        // 设置最新快照并标记新增持仓
        const latestIndex = result.data.snapshots.length - 1;
        const latestSnapshot = markNewPositionsWithData(result.data.snapshots[latestIndex], latestIndex, result.data);
        setCurrentSnapshot(latestSnapshot);
        setSelectedSnapshotIndex(-1); // 重置为最新
      } else {
        throw new Error(result.error || '回测失败');
      }
    } catch (err) {
      console.error('回测错误:', err);
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [parameterErrors, params]);

  // 按钮点击处理
  const handleRunBacktest = () => {
    runBacktest(params);
  };

  // 页面首次加载时自动执行一次回测
  useEffect(() => {
    runBacktest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 清理函数（组件内防抖已处理，此处无需清理）
  useEffect(() => {
    return () => {
      // 组件卸载时的清理逻辑（如果需要）
    };
  }, []);

  // 保持显示参数与实际参数同步（当外部更新params时）
  useEffect(() => {
    setDisplayParams(params);
  }, [params.priceChangeWeight, params.volumeWeight, params.volatilityWeight, params.fundingRateWeight]);

  // 独立BTC占比同步 - 简化版本，只在初始化时同步
  useEffect(() => {
    setIsolatedBtcRatio(params.btcRatio);
  }, []); // 只在组件挂载时执行一次

  // 独立最多做空标的数量同步 - 简化版本，只在初始化时同步
  useEffect(() => {
    setIsolatedMaxShortPositions(params.maxShortPositions);
  }, []); // 只在组件挂载时执行一次

  // 参数更新处理 - 优化版本
  const handleParamChange = useCallback((key: keyof BTCDOM2StrategyParams, value: string | number | boolean) => {
    const newParams = {
      ...params,
      [key]: value
    };
    setParams(newParams);
    setDisplayParams(newParams); // 同时更新显示参数
  }, [params]);

  // 权重调整处理 - 简化版本，防抖逻辑已移到组件内
  const handleWeightChange = useCallback((type: 'priceChange' | 'volume' | 'volatility' | 'fundingRate', value: number) => {
    console.log('页面权重变化:', { type, value });
    
    const newParams = {
      ...params,
      [`${type}Weight`]: value
    };

    // 直接更新参数，不需要防抖（组件内已处理）
    setParams(newParams);
    setDisplayParams(newParams);
  }, [params]);

  // 独立BTC占比处理函数 - 完全隔离，不影响其他参数
  const handleIsolatedBtcRatioChange = useCallback((value: number) => {
    console.time('handleIsolatedBtcRatioChange');
    console.log('独立BTC占比变化:', value);
    
    // 立即更新独立状态
    setIsolatedBtcRatio(value);
    
    // 同时更新实际参数中的BTC占比
    setParams(prev => ({
      ...prev,
      btcRatio: value
    }));
    
    console.timeEnd('handleIsolatedBtcRatioChange');
  }, []);

  // 独立最多做空标的数量处理函数 - 完全隔离，不影响其他参数
  const handleIsolatedMaxShortPositionsChange = useCallback((value: number) => {
    console.log('独立最多做空标的数量变化:', value);
    
    // 立即更新独立状态
    setIsolatedMaxShortPositions(value);
    
    // 同时更新实际参数中的最多做空标的数量
    setParams(prev => ({
      ...prev,
      maxShortPositions: value
    }));
  }, []);

  // 标准化权重 - 将所有权重按比例调整使总和为1
  const normalizeWeights = useCallback(() => {
    const currentSum = displayParams.priceChangeWeight + displayParams.volumeWeight + displayParams.volatilityWeight + displayParams.fundingRateWeight;
    if (currentSum === 0) return; // 避免除零

    const normalizedParams = {
      ...params,
      priceChangeWeight: displayParams.priceChangeWeight / currentSum,
      volumeWeight: displayParams.volumeWeight / currentSum,
      volatilityWeight: displayParams.volatilityWeight / currentSum,
      fundingRateWeight: displayParams.fundingRateWeight / currentSum
    };

    setParams(normalizedParams);
    setDisplayParams(normalizedParams);
  }, [displayParams, params]);

  // 处理优化完成
  const handleOptimizationComplete = useCallback((results: OptimizationResult[]) => {
    console.log('优化完成，共找到', results.length, '个结果');
    if (results.length > 0) {
      console.log('最优结果:', results[0]);
    }
  }, []);

  // 处理应用最优参数
  const handleBestParametersFound = useCallback((bestParams: {
    priceChangeWeight: number;
    volumeWeight: number;
    volatilityWeight: number;
    fundingRateWeight: number;
    maxShortPositions: number;
    allocationStrategy: PositionAllocationStrategy;
  }) => {
    console.log('应用最优参数:', bestParams);

    // 更新当前参数
    const newParams = {
      ...params,
      priceChangeWeight: bestParams.priceChangeWeight,
      volumeWeight: bestParams.volumeWeight,
      volatilityWeight: bestParams.volatilityWeight,
      fundingRateWeight: bestParams.fundingRateWeight,
      maxShortPositions: bestParams.maxShortPositions,
      allocationStrategy: bestParams.allocationStrategy
    };

    setParams(newParams);

    // 提示用户参数已更新
    console.log('参数已更新，建议重新执行回测查看效果');
  }, [params]);

  // 处理时间点选择
  const handleSnapshotSelection = (index: number) => {
    if (backtestResult && backtestResult.snapshots) {
      setSelectedSnapshotIndex(index);

      let selectedSnapshot: StrategySnapshot;
      if (index === -1) {
        // 选择最新
        selectedSnapshot = backtestResult.snapshots[backtestResult.snapshots.length - 1];
      } else {
        selectedSnapshot = backtestResult.snapshots[index];
      }

      // 标记新增持仓
      const snapshotWithNewPositions = markNewPositionsWithData(selectedSnapshot, index, backtestResult);
      setCurrentSnapshot(snapshotWithNewPositions);
    }
  };

  // 标记新增持仓的函数（带数据参数）
  const markNewPositionsWithData = (currentSnapshot: StrategySnapshot, currentIndex: number, data: BTCDOM2BacktestResult): StrategySnapshot => {
    if (!data) {
      return currentSnapshot;
    }

    const actualIndex = currentIndex === -1 ? data.snapshots.length - 1 : currentIndex;

    // 第1期（index = 0）时，所有持仓都是新增的
    if (actualIndex === 0) {
      return {
        ...currentSnapshot,
        btcPosition: currentSnapshot.btcPosition ? {
          ...currentSnapshot.btcPosition,
          isNewPosition: true,
          quantityChange: { type: 'new' },
          priceChange: { type: 'new' }
        } : null,
        shortPositions: currentSnapshot.shortPositions.map(pos => ({
          ...pos,
          isNewPosition: true,
          quantityChange: { type: 'new' }
        }))
      };
    }

    // 获取前一期的快照
    const previousSnapshot = data.snapshots[actualIndex - 1];

    // 获取前一期的持仓信息
    const previousPositions = new Map<string, PositionInfo>();
    if (previousSnapshot.btcPosition) {
      previousPositions.set(previousSnapshot.btcPosition.symbol, previousSnapshot.btcPosition);
    }
    previousSnapshot.shortPositions.forEach(pos => {
      previousPositions.set(pos.symbol, pos);
    });

    // 计算数量变化的辅助函数
    const getQuantityChange = (currentPos: PositionInfo) => {
      const previousPos = previousPositions.get(currentPos.symbol);

      if (!previousPos) {
        return { type: 'new' as const };
      }

      const currentQty = currentPos.quantity;
      const previousQty = previousPos.quantity;

      // 使用相对变化百分比来判断，更精确
      const changePercent = Math.abs((currentQty - previousQty) / previousQty) * 100;
      const threshold = 0.01; // 0.01% 的变化阈值

      if (changePercent < threshold) {
        return {
          type: 'same' as const,
          previousQuantity: previousQty
        };
      } else if (currentQty > previousQty) {
        return {
          type: 'increase' as const,
          previousQuantity: previousQty,
          changePercent: ((currentQty - previousQty) / previousQty) * 100
        };
      } else {
        return {
          type: 'decrease' as const,
          previousQuantity: previousQty,
          changePercent: ((currentQty - previousQty) / previousQty) * 100
        };
      }
    };

    // 计算价格变化的辅助函数
    const getPriceChange = (currentPos: PositionInfo) => {
      const previousPos = previousPositions.get(currentPos.symbol);

      if (!previousPos) {
        return { type: 'new' as const };
      }

      const currentPrice = currentPos.currentPrice;
      const previousPrice = previousPos.currentPrice;

      // 使用相对变化百分比来判断
      const changePercent = Math.abs((currentPrice - previousPrice) / previousPrice) * 100;
      const threshold = 0.01; // 0.01% 的变化阈值

      if (changePercent < threshold) {
        return {
          type: 'same' as const,
          previousPrice: previousPrice
        };
      } else if (currentPrice > previousPrice) {
        return {
          type: 'increase' as const,
          previousPrice: previousPrice,
          changePercent: ((currentPrice - previousPrice) / previousPrice) * 100
        };
      } else {
        return {
          type: 'decrease' as const,
          previousPrice: previousPrice,
          changePercent: ((currentPrice - previousPrice) / previousPrice) * 100
        };
      }
    };

    // 标记新增的持仓和数量变化
    const updatedSnapshot = {
      ...currentSnapshot,
      btcPosition: currentSnapshot.btcPosition ? {
        ...currentSnapshot.btcPosition,
        isNewPosition: !previousPositions.has(currentSnapshot.btcPosition.symbol),
        quantityChange: getQuantityChange(currentSnapshot.btcPosition),
        priceChange: getPriceChange(currentSnapshot.btcPosition)
      } : null,
      shortPositions: currentSnapshot.shortPositions.map(pos => ({
        ...pos,
        isNewPosition: !previousPositions.has(pos.symbol),
        quantityChange: getQuantityChange(pos),
        priceChange: getPriceChange(pos)
      }))
    };

    return updatedSnapshot;
  };



  return (
    <div className="container mx-auto p-6 max-w-[1920px]">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">BTCDOM 2.0 策略回测</h1>
          <p className="text-gray-600 dark:text-gray-400">
            基于成交量排行榜的BTC+做空ALT策略
            <span className="ml-2 inline-flex items-center text-sm text-blue-600 dark:text-blue-400">
              <Clock className="w-4 h-4 mr-1" />
              {REBALANCE_HOURS}小时再平衡
            </span>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(时间：UTC+0)</span>
          </p>
        </div>

        {/* 策略参数配置 */}
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                策略参数配置
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {showAdvancedSettings ? '收起' : '高级设置'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 基础参数 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">开始日期</Label>
                <DatePicker
                  date={params.startDate ? new Date(params.startDate + 'T00:00:00') : undefined}
                  onDateChange={(date) => {
                    if (date) {
                      // 使用本地时区格式化日期，避免时区转换问题
                      const year = date.getFullYear();
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const day = date.getDate().toString().padStart(2, '0');
                      handleParamChange('startDate', `${year}-${month}-${day}`);
                    } else {
                      handleParamChange('startDate', '');
                    }
                  }}
                  placeholder="选择开始日期"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">结束日期</Label>
                <DatePicker
                  date={params.endDate ? new Date(params.endDate + 'T00:00:00') : undefined}
                  onDateChange={(date) => {
                    if (date) {
                      // 使用本地时区格式化日期，避免时区转换问题
                      const year = date.getFullYear();
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const day = date.getDate().toString().padStart(2, '0');
                      handleParamChange('endDate', `${year}-${month}-${day}`);
                    } else {
                      handleParamChange('endDate', '');
                    }
                  }}
                  placeholder="选择结束日期"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialCapital">初始本金 (USDT)</Label>
                <Input
                  id="initialCapital"
                  type="number"
                  value={params.initialCapital}
                  onChange={(e) => handleParamChange('initialCapital', parseFloat(e.target.value) || 0)}
                />
              </div>

              <IsolatedBtcRatioControl
                value={isolatedBtcRatio}
                onValueChange={handleIsolatedBtcRatioChange}
                disabled={loading}
              />
            </div>

            {/* 高级设置 */}
            {showAdvancedSettings && (
              <div className="space-y-6 border-t pt-6">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">高级设置</h4>

                {/* 权重配置区域 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">做空标的选择权重配置</h5>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm transition-colors duration-200 ${
                        !isWeightsValid
                          ? 'text-red-600 dark:text-red-400 font-semibold'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        权重总和: {getWeightSumPercent}%
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={normalizeWeights}
                        className="text-xs px-3 py-1"
                      >
                        标准化权重
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <WeightControl
                      label="跌幅权重"
                      value={displayParams.priceChangeWeight}
                      onValueChange={(value) => handleWeightChange('priceChange', value)}
                      description="评估价格下跌程度，跌幅越大分数越高"
                    />

                    <WeightControl
                      label="成交量权重"
                      value={displayParams.volumeWeight}
                      onValueChange={(value) => handleWeightChange('volume', value)}
                      description="评估交易活跃度和流动性，确保足够流动性"
                    />

                    <WeightControl
                      label="波动率权重"
                      value={displayParams.volatilityWeight}
                      onValueChange={(value) => handleWeightChange('volatility', value)}
                      description="评估价格波动稳定性，适中波动率得分最高"
                    />

                    <WeightControl
                      label="资金费率权重"
                      value={displayParams.fundingRateWeight}
                      onValueChange={(value) => handleWeightChange('fundingRate', value)}
                      description="评估做空成本和收益，正费率对做空有利"
                    />
                  </div>
                </div>

                {/* 仓位配置策略 */}
                <div className="space-y-4">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">仓位分配策略</h5>
                  <div className="space-y-3">
                    <Select
                      value={params.allocationStrategy}
                      onValueChange={(value) => handleParamChange('allocationStrategy', value as PositionAllocationStrategy)}
                    >
                      <SelectTrigger className="w-full text-left">
                        <SelectValue>
                          {params.allocationStrategy === PositionAllocationStrategy.BY_VOLUME && "按成交量比例分配"}
                          {params.allocationStrategy === PositionAllocationStrategy.BY_COMPOSITE_SCORE && "按综合分数分配权重"}
                          {params.allocationStrategy === PositionAllocationStrategy.EQUAL_ALLOCATION && "平均分配做空资金"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PositionAllocationStrategy.BY_VOLUME}>
                          <div className="flex flex-col">
                            <span>按成交量比例分配</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">根据币种成交量大小按比例分配资金</span>
                          </div>
                        </SelectItem>
                        <SelectItem value={PositionAllocationStrategy.BY_COMPOSITE_SCORE}>
                          <div className="flex flex-col">
                            <span>按综合分数分配权重</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">根据跌幅、成交量、波动率、资金费率的综合评分分配资金</span>
                          </div>
                        </SelectItem>
                        <SelectItem value={PositionAllocationStrategy.EQUAL_ALLOCATION}>
                          <div className="flex flex-col">
                            <span>平均分配做空资金</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">每个选中的币种分配相等的资金</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>


                  </div>
                </div>

                {/* 最多做空标的数量 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MaxShortPositionsControl
                    value={isolatedMaxShortPositions}
                    onValueChange={handleIsolatedMaxShortPositionsChange}
                    disabled={loading}
                  />
                </div>

                {/* 其他配置 */}
                <div className="space-y-4">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">其他配置</h5>

                  {/* 手续费配置区域 */}
                  <div className="space-y-3 p-4 rounded-lg border">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">交易手续费率配置</Label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 现货手续费 */}
                      <div className="space-y-2">
                        <Label htmlFor="spotTradingFeeRate" className="text-xs font-medium text-blue-700 dark:text-blue-400">
                          现货手续费率 <span className="text-gray-400 dark:text-gray-500">(BTC交易使用)</span>
                        </Label>
                        <div className="flex items-center space-x-3">
                          <Input
                            id="spotTradingFeeRate"
                            type="number"
                            step="0.0001"
                            min="0"
                            max="0.01"
                            value={params.spotTradingFeeRate}
                            onChange={(e) => handleParamChange('spotTradingFeeRate', parseFloat(e.target.value) || 0)}
                            className="flex-1"
                            placeholder="0.0008"
                          />
                          <span className="text-xs font-medium w-16 text-right bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                            {(params.spotTradingFeeRate * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {/* 期货手续费 */}
                      <div className="space-y-2">
                        <Label htmlFor="futuresTradingFeeRate" className="text-xs font-medium text-red-700 dark:text-red-400">
                          期货手续费率 <span className="text-gray-400 dark:text-gray-500">(做空ALT使用)</span>
                        </Label>
                        <div className="flex items-center space-x-3">
                          <Input
                            id="futuresTradingFeeRate"
                            type="number"
                            step="0.0001"
                            min="0"
                            max="0.01"
                            value={params.futuresTradingFeeRate}
                            onChange={(e) => handleParamChange('futuresTradingFeeRate', parseFloat(e.target.value) || 0)}
                            className="flex-1"
                            placeholder="0.0002"
                          />
                          <span className="text-xs font-medium w-16 text-right bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                            {(params.futuresTradingFeeRate * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400">现货手续费通常高于期货手续费</p>
                  </div>

                </div>

                {/* 策略选择 */}
                <div className="space-y-4 relative">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">策略组合选择</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <Checkbox
                        id="longBtc"
                        checked={params.longBtc}
                        onCheckedChange={(checked) => handleParamChange('longBtc', checked as boolean)}
                      />
                      <div className="flex-1">
                        <Label htmlFor="longBtc" className="font-medium cursor-pointer flex items-center gap-2">
                          <Bitcoin className="w-4 h-4 text-orange-500" />
                          做多 BTC
                        </Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">配置资金的{(params.btcRatio * 100).toFixed(0)}%用于做多BTC</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <Checkbox
                        id="shortAlt"
                        checked={params.shortAlt}
                        onCheckedChange={(checked) => handleParamChange('shortAlt', checked as boolean)}
                      />
                      <div className="flex-1">
                        <Label htmlFor="shortAlt" className="font-medium cursor-pointer flex items-center gap-2">
                          <ArrowDown className="w-4 h-4 text-red-500" />
                          做空 ALT币
                        </Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">配置资金的{((1 - params.btcRatio) * 100).toFixed(0)}%用于做空山寨币</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4 pt-4">
                <div className="text-center">
                  <Button
                    onClick={handleRunBacktest}
                    disabled={loading || Object.keys(parameterErrors).length > 0}
                    className="px-8 py-2"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        执行回测中...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        执行回测
                      </>
                    )}
                  </Button>
                </div>
                <div className="text-center">
                  <Button
                    onClick={() => setShowOptimization(!showOptimization)}
                    disabled={loading}
                    variant="outline"
                    className="px-8 py-2"
                    size="lg"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {showOptimization ? '隐藏优化' : '参数优化'}
                  </Button>
                </div>
              </div>
              <div className="flex justify-center pt-2">
                <div className="text-center">
                {/* 显示所有参数错误 */}
                  {Object.entries(parameterErrors).map(([key, message]) => (
                    <p key={key} className="text-xs text-red-500 mt-2 flex items-center justify-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {message}
                    </p>
                  ))}
                </div>
              </div>

          </CardContent>
        </Card>

        {/* 参数优化面板 */}
        {showOptimization && (
          <Card className="mt-6 border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                参数优化工具
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OptimizationPanel
                initialConfig={{
                  baseParams: {
                    startDate: params.startDate,
                    endDate: params.endDate,
                    initialCapital: params.initialCapital,
                    btcRatio: params.btcRatio,
                    spotTradingFeeRate: params.spotTradingFeeRate,
                    futuresTradingFeeRate: params.futuresTradingFeeRate,
                    longBtc: params.longBtc,
                    shortAlt: params.shortAlt
                  }
                }}
                onOptimizationComplete={handleOptimizationComplete}
                onBestParametersFound={handleBestParametersFound}
              />
            </CardContent>
          </Card>
        )}

        {/* 错误显示 */}
        {error && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">回测失败</span>
              </div>
              <p className="text-red-600 dark:text-red-400 mt-2">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* 结果展示 */}
        {backtestResult && (
          <>
            {/* 性能指标卡片 - 紧凑布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 收益率分解卡片 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle>收益率分解</CardTitle>
                  <TrendingUp className={`h-4 w-4 ${
                    backtestResult.performance.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
                  }`} />
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 使用后端计算好的盈亏分解数据 */}
                  {(() => {
                    const pnlBreakdown = backtestResult.performance.pnlBreakdown;

                    return (
                      <>
                        {/* 总盈亏 - 突出显示 */}
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                          <span className="font-medium text-gray-700 dark:text-gray-300">总盈亏</span>
                          <div className={`text-xl font-bold ${getValueColorClass(pnlBreakdown.totalPnlAmount)}`}>
                            {formatAmountWithPercent(
                              pnlBreakdown.totalPnlAmount,
                              pnlBreakdown.totalPnlRate * 100
                            )}
                          </div>
                        </div>

                        {/* 只在选择做多BTC时显示BTC收益率 */}
                        {params.longBtc && (
                          <div className="flex justify-between items-center py-1">
                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Bitcoin className="w-3 h-3" />
                              BTC做多
                            </span>
                            <span className={`text-sm font-semibold ${getValueColorClass(pnlBreakdown.btcPnlAmount)}`}>
                              {formatAmountWithPercent(
                                pnlBreakdown.btcPnlAmount,
                                pnlBreakdown.btcPnlRate * 100
                              )}
                            </span>
                          </div>
                        )}

                        {/* 只在选择做空ALT时显示ALT收益率 */}
                        {params.shortAlt && (
                          <div className="flex justify-between items-center py-1">
                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <ArrowDown className="w-3 h-3" />
                              ALT做空
                            </span>
                            <span className={`text-sm font-semibold ${getValueColorClass(pnlBreakdown.altPnlAmount)}`}>
                              {formatAmountWithPercent(
                                pnlBreakdown.altPnlAmount,
                                pnlBreakdown.altPnlRate * 100
                              )}
                            </span>
                          </div>
                        )}

                        {/* 手续费盈亏 */}
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-500 dark:text-gray-400">手续费盈亏</span>
                          <span className={`text-sm font-semibold ${getValueColorClass(pnlBreakdown.tradingFeeAmount)}`}>
                            {formatAmountWithPercent(
                              pnlBreakdown.tradingFeeAmount,
                              pnlBreakdown.tradingFeeRate * 100
                            )}
                          </span>
                        </div>

                        {/* 资金费率盈亏 */}
                        {params.shortAlt && (
                          <div className="flex justify-between items-center py-1">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500 dark:text-gray-400">资金费率盈亏</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
                                    <Info className="h-3 w-3 text-gray-400" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 text-sm">
                                  <div className="space-y-2">
                                    <p className="font-medium">资金费率说明</p>
                                    <p className="text-gray-600 dark:text-gray-400">
                                      对于做空头寸：
                                    </p>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                      <p>• 资金费率为负数时，空头支付资金费（亏损）</p>
                                      <p>• 资金费率为正数时，空头收取资金费（盈利）</p>
                                      <p>• 新开仓的交易对从下一期开始收取资金费率</p>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <span className={`text-sm font-semibold ${getValueColorClass(pnlBreakdown.fundingFeeAmount)}`}>
                              {formatAmountWithPercent(
                                pnlBreakdown.fundingFeeAmount,
                                pnlBreakdown.fundingFeeRate * 100
                              )}
                            </span>
                          </div>
                        )}

                        {/* 盈亏验证 - 开发调试用 */}
                        {process.env.NODE_ENV === 'development' && (
                          <div className="mt-4 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                            <div className="font-medium mb-1">盈亏分解验证：</div>
                            <div>BTC: ${pnlBreakdown.btcPnlAmount.toFixed(2)} + ALT: ${pnlBreakdown.altPnlAmount.toFixed(2)} + 手续费: ${pnlBreakdown.tradingFeeAmount.toFixed(2)} + 资金费: ${pnlBreakdown.fundingFeeAmount.toFixed(2)}</div>
                            <div>= ${(pnlBreakdown.btcPnlAmount + pnlBreakdown.altPnlAmount + pnlBreakdown.tradingFeeAmount + pnlBreakdown.fundingFeeAmount).toFixed(2)}</div>
                            <div>总盈亏: ${pnlBreakdown.totalPnlAmount.toFixed(2)} (差额: ${(pnlBreakdown.totalPnlAmount - (pnlBreakdown.btcPnlAmount + pnlBreakdown.altPnlAmount + pnlBreakdown.tradingFeeAmount + pnlBreakdown.fundingFeeAmount)).toFixed(2)})</div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* 风险指标卡片 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle>风险指标</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 最大回撤 - 突出显示 */}
                  <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <span className="font-medium text-gray-700 dark:text-gray-300">最大回撤</span>
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">
                      {formatAmountWithPercent(
                        params.initialCapital * backtestResult.performance.maxDrawdown,
                        backtestResult.performance.maxDrawdown * 100
                      )}
                    </div>
                  </div>
                  {/* 年化收益率 */}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-500 dark:text-gray-400">年化收益率</span>
                    <span className={`text-sm font-semibold ${getValueColorClass(backtestResult.performance.annualizedReturn)}`}>
                      {formatPercent(
                        backtestResult.performance.annualizedReturn * 100
                      )}
                    </span>
                  </div>
                  {/* 夏普比率 */}
                  <div className="flex justify-between items-center py-1">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">夏普比率</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
                            <Info className="h-3 w-3 text-gray-400" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 text-sm">
                          <div className="space-y-2">
                            <p className="font-medium">夏普比率说明</p>
                            <p className="text-gray-600 dark:text-gray-400">
                              衡量风险调整后收益的指标，计算公式为：(年化收益率 - 无风险利率) / 年化波动率
                            </p>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                              <p>• {'>'}1.0: 优秀表现</p>
                              <p>• 0.5-1.0: 良好表现</p>
                              <p>• {'<'}0.5: 表现一般</p>
                              <p>• {'<'}0: 承担风险但收益不佳</p>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <span className={`text-sm font-semibold ${
                      backtestResult.performance.sharpeRatio >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {backtestResult.performance.sharpeRatio.toFixed(2)}
                    </span>
                  </div>

                  {/* 卡玛比率 */}
                  <div className="flex justify-between items-center py-1">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">卡玛比率</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
                            <Info className="h-3 w-3 text-gray-400" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 text-sm">
                          <div className="space-y-2">
                            <p className="font-medium">卡玛比率 (Calmar Ratio)</p>
                            <p className="text-gray-600 dark:text-gray-400">
                              卡玛比率 = 年化收益率 ÷ 最大回撤
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                              用于衡量风险调整后的收益表现。比率越高，说明在承担相同回撤风险下获得了更高的收益。
                            </p>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                              <p>• {'>'}1.0: 优秀表现</p>
                              <p>• 0.5-1.0: 良好表现</p>
                              <p>• {'<'}0.5: 需要改进</p>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <span className={`text-sm font-semibold ${
                      backtestResult.performance.calmarRatio >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {backtestResult.performance.calmarRatio.toFixed(2)}
                    </span>
                  </div>

                  {/* 波动率 */}
                  <div className="flex justify-between items-center py-1">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">波动率</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
                            <Info className="h-3 w-3 text-gray-400" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 text-sm">
                          <div className="space-y-2">
                            <p className="font-medium">年化波动率</p>
                            <p className="text-gray-600 dark:text-gray-400">
                              衡量策略收益率的变动程度，反映投资风险的大小。
                            </p>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                              <p>• 波动率越高，风险越大</p>
                              <p>• 波动率越低，收益越稳定</p>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {(backtestResult.performance.volatility * 100).toFixed(2)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* BTC价格与策略收益对比 */}
            <Card className="border border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle>
                  BTC价格与策略收益对比
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    ({params.longBtc && params.shortAlt ? '做多BTC + 做空ALT' :
                      params.longBtc ? '做多BTC' :
                      params.shortAlt ? '做空ALT' : '无策略'})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BTCDOM2Chart data={chartData} params={params} />
              </CardContent>
            </Card>

            {/* 详细统计 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle>
                    策略统计
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                      (BTC占比: {(params.btcRatio * 100).toFixed(0)}%)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">总再平衡次数</span>
                      <span className="font-medium">{backtestResult.summary.totalRebalances}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">持仓/空仓状态次数</span>
                      <span className="font-medium">{backtestResult.summary.activeRebalances} / {backtestResult.summary.inactiveRebalances}</span>
                    </div>
                    {/* 只在选择做空ALT时显示平均做空标的数量 */}
                    {params.shortAlt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">平均做空标的数量</span>
                        <span className="font-medium">{backtestResult.summary.avgShortPositions.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">策略持仓率</span>
                      <span className="font-medium">
                        {((backtestResult.summary.activeRebalances / backtestResult.summary.totalRebalances) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle>风险统计</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">最佳收益期</span>
                      <div className="text-right">
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {backtestResult.performance.bestPeriodInfo && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                              第{backtestResult.performance.bestPeriodInfo.period}期 • {formatPeriodTime(backtestResult.performance.bestPeriodInfo.timestamp)}
                            </span>
                          )}
                          {(() => {
                            // bestPeriod是期间收益率，需要找到对应期数的实际盈亏金额
                            const bestPeriodNumber = backtestResult.performance.bestPeriodInfo?.period;
                            if (bestPeriodNumber && backtestResult.snapshots[bestPeriodNumber - 1]) {
                              const bestSnapshot = backtestResult.snapshots[bestPeriodNumber - 1];
                              return formatAmountWithPercent(
                                bestSnapshot.periodPnl || 0,
                                (bestSnapshot.periodPnlPercent || 0) * 100
                              );
                            }
                            // 如果找不到对应快照，使用期间收益率计算
                            return formatAmountWithPercent(
                              params.initialCapital * backtestResult.performance.bestPeriod,
                              backtestResult.performance.bestPeriod * 100
                            );
                          })()}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">最差收益期</span>
                      <div className="text-right">
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {backtestResult.performance.worstPeriodInfo && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                              第{backtestResult.performance.worstPeriodInfo.period}期 • {formatPeriodTime(backtestResult.performance.worstPeriodInfo.timestamp)}
                            </span>
                          )}
                          {(() => {
                            // worstPeriod是期间收益率，需要找到对应期数的实际盈亏金额
                            const worstPeriodNumber = backtestResult.performance.worstPeriodInfo?.period;
                            if (worstPeriodNumber && backtestResult.snapshots[worstPeriodNumber - 1]) {
                              const worstSnapshot = backtestResult.snapshots[worstPeriodNumber - 1];
                              return formatAmountWithPercent(
                                worstSnapshot.periodPnl || 0,
                                (worstSnapshot.periodPnlPercent || 0) * 100
                              );
                            }
                            // 如果找不到对应快照，使用期间收益率计算
                            return formatAmountWithPercent(
                              params.initialCapital * backtestResult.performance.worstPeriod,
                              backtestResult.performance.worstPeriod * 100
                            );
                          })()}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">最多资金费期</span>
                      <div className="text-right">
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {backtestResult.performance.bestFundingPeriodInfo && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                              第{backtestResult.performance.bestFundingPeriodInfo.period}期 • {formatPeriodTime(backtestResult.performance.bestFundingPeriodInfo.timestamp)}
                            </span>
                          )}
                          {formatAmountWithPercent(
                            backtestResult.performance.bestFundingPeriod || 0,
                            ((backtestResult.performance.bestFundingPeriod || 0) / params.initialCapital) * 100
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">最少资金费期</span>
                      <div className="text-right">
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {backtestResult.performance.worstFundingPeriodInfo && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                              第{backtestResult.performance.worstFundingPeriodInfo.period}期 • {formatPeriodTime(backtestResult.performance.worstFundingPeriodInfo.timestamp)}
                            </span>
                          )}
                          {formatAmountWithPercent(
                            backtestResult.performance.worstFundingPeriod || 0,
                            ((backtestResult.performance.worstFundingPeriod || 0) / params.initialCapital) * 100
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 历史持仓查看 */}
            {backtestResult && backtestResult.snapshots && backtestResult.snapshots.length > 0 && (
              <Card className="border border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    持仓历史分析
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                      ({params.longBtc && params.shortAlt ? '做多BTC + 做空ALT' :
                        params.longBtc ? '做多BTC' :
                        params.shortAlt ? '做空ALT' : '无策略'})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 时间轴选择器 */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">选择时间点</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSnapshotSelection(-1)}
                              className={selectedSnapshotIndex === -1 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' : ''}
                            >
                              最新
                            </Button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              共 {backtestResult.snapshots.length} 个时间点
                            </span>
                          </div>
                        </div>

                        {/* 时间点滑动条 */}
                        <div className="space-y-2">
                          <Slider
                            value={[selectedSnapshotIndex === -1 ? backtestResult.snapshots.length - 1 : selectedSnapshotIndex]}
                            onValueChange={(value) => handleSnapshotSelection(value[0])}
                            max={backtestResult.snapshots.length - 1}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatPeriodTime(backtestResult.snapshots[0].timestamp)}</span>
                            <span>
                              {currentSnapshot && formatPeriodTime(currentSnapshot.timestamp)}
                            </span>
                            <span>{formatPeriodTime(backtestResult.snapshots[backtestResult.snapshots.length - 1].timestamp)}</span>
                          </div>
                        </div>

                        {/* 快速跳转按钮 */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSnapshotSelection(0)}
                            className="text-xs"
                          >
                            第1期
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const currentIndex = selectedSnapshotIndex === -1 ? backtestResult.snapshots.length - 1 : selectedSnapshotIndex;
                              const prevIndex = Math.max(0, currentIndex - 1);
                              handleSnapshotSelection(prevIndex);
                            }}
                            className="text-xs"
                            disabled={selectedSnapshotIndex === 0}
                          >
                            上一期
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const currentIndex = selectedSnapshotIndex === -1 ? backtestResult.snapshots.length - 1 : selectedSnapshotIndex;
                              const nextIndex = Math.min(backtestResult.snapshots.length - 1, currentIndex + 1);
                              handleSnapshotSelection(nextIndex);
                            }}
                            className="text-xs"
                            disabled={selectedSnapshotIndex === backtestResult.snapshots.length - 1 || selectedSnapshotIndex === -1}
                          >
                            下一期
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSnapshotSelection(backtestResult.snapshots.length - 1)}
                            className="text-xs"
                          >
                            最后1期
                          </Button>
                        </div>
                      </div>

                      {/* 持仓表格 */}
                      {currentSnapshot && (
                        <BTCDOM2PositionTable
                          snapshot={currentSnapshot}
                          params={params}
                          periodNumber={selectedSnapshotIndex === -1 ? backtestResult.snapshots.length : selectedSnapshotIndex + 1}
                          backtestResult={backtestResult}
                        />
                      )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
