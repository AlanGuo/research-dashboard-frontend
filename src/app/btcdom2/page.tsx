'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
import { AlertCircle, Play, Settings, TrendingUp, TrendingDown, Clock, Loader2, Eye, Info, Bitcoin, ArrowDown } from 'lucide-react';

export default function BTCDOM2Dashboard() {
  // 策略参数状态
  const [params, setParams] = useState<BTCDOM2StrategyParams>({
    startDate: '2025-06-01',
    endDate: '2025-06-18',
    initialCapital: 10000,
    btcRatio: 0.5,
    priceChangeWeight: 0.4,
    volumeWeight: 0.2,
    volatilityWeight: 0.1,
    fundingRateWeight: 0.3,
    maxShortPositions: 10,
    tradingFeeRate: 0.002,
    longBtc: true,
    shortAlt: true,
    allocationStrategy: PositionAllocationStrategy.BY_VOLUME,
    maxSinglePositionRatio: 0.25
  });

  // 数据状态
  const [backtestResult, setBacktestResult] = useState<BTCDOM2BacktestResult | null>(null);
  const [chartData, setChartData] = useState<BTCDOM2ChartData[]>([]);
  const [currentSnapshot, setCurrentSnapshot] = useState<StrategySnapshot | null>(null);
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState<number>(-1); // -1 表示最新
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [granularityHours, setGranularityHours] = useState<number>(8);

  // UI状态
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  // 工具函数：格式化时间（使用UTC+0时区）
  const formatPeriodTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
  };

  // 工具函数：获取数值的颜色类名
  const getValueColorClass = (value: number | null) => {
    const validValue = value ?? 0;
    if (validValue > 0) return 'text-green-600';
    if (validValue < 0) return 'text-red-600';
    return 'text-gray-600';
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
  const [parameterErrors, setParameterErrors] = useState<Record<string, string>>({});

  // 验证参数
  const validateParameters = useCallback((params: BTCDOM2StrategyParams): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (params.initialCapital <= 0) {
      errors.initialCapital = '初始本金必须大于0';
    }

    if (params.btcRatio < 0 || params.btcRatio > 1) {
      errors.btcRatio = 'BTC占比必须在0-1之间';
    }

    const weightSum = params.priceChangeWeight + params.volumeWeight + params.volatilityWeight + params.fundingRateWeight;
    if (Math.abs(weightSum - 1) > 0.001) {
      errors.weights = '跌幅权重、成交量权重、波动率权重和资金费率权重之和必须等于1';
    }

    if (params.maxShortPositions <= 0 || params.maxShortPositions > 50) {
      errors.maxShortPositions = '做空标的数量必须在1-50之间';
    }

    if (params.tradingFeeRate < 0 || params.tradingFeeRate > 0.01) {
      errors.tradingFeeRate = '交易手续费率必须在0-1%之间';
    }

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    if (startDate >= endDate) {
      errors.dateRange = '开始日期必须早于结束日期';
    }

    if (!params.longBtc && !params.shortAlt) {
      errors.strategySelection = '至少需要选择一种策略：做多BTC或做空ALT';
    }

    if (params.allocationStrategy === PositionAllocationStrategy.BY_COMPOSITE_SCORE && params.maxSinglePositionRatio < 0.01) {
      errors.maxSinglePositionRatio = '单币种最高持仓限制不能低于1%';
    }

    return errors;
  }, []);

  // 执行回测
  const runBacktest = useCallback(async (currentParams?: BTCDOM2StrategyParams) => {
    const paramsToUse = currentParams || params;
    const errors = validateParameters(paramsToUse);
    setParameterErrors(errors);

    if (Object.keys(errors).length > 0) {
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
        setGranularityHours(result.data.summary.granularityHours);
      } else {
        throw new Error(result.error || '回测失败');
      }
    } catch (err) {
      console.error('回测错误:', err);
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [validateParameters, params]);

  // 按钮点击处理
  const handleRunBacktest = () => {
    runBacktest(params);
  };

  // 页面首次加载时自动执行一次回测
  useEffect(() => {
    runBacktest();
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 检查权重是否有效
  const isWeightsValid = useCallback(() => {
    const weightSum = params.priceChangeWeight + params.volumeWeight + params.volatilityWeight + params.fundingRateWeight;
    return Math.abs(weightSum - 1) <= 0.001;
  }, [params.priceChangeWeight, params.volumeWeight, params.volatilityWeight, params.fundingRateWeight]);

  // 获取权重总和百分比
  const getWeightSumPercent = useCallback(() => {
    return ((params.priceChangeWeight + params.volumeWeight + params.volatilityWeight + params.fundingRateWeight) * 100).toFixed(0);
  }, [params.priceChangeWeight, params.volumeWeight, params.volatilityWeight, params.fundingRateWeight]);

  // 参数更新处理
  const handleParamChange = (key: keyof BTCDOM2StrategyParams, value: string | number | boolean) => {
    const newParams = {
      ...params,
      [key]: value
    };
    setParams(newParams);

    // 实时验证并更新错误状态
    const errors = validateParameters(newParams);
    setParameterErrors(errors);
  };

  // 权重调整处理
  const handleWeightChange = (type: 'priceChange' | 'volume' | 'volatility' | 'fundingRate', value: number) => {
    const weight = value / 100;
    const newParams = {
      ...params,
      [`${type}Weight`]: weight
    };

    setParams(newParams);

    // 实时验证并更新错误状态
    const errors = validateParameters(newParams);
    setParameterErrors(errors);
  };

  // 标准化权重 - 将所有权重按比例调整使总和为1
  const normalizeWeights = () => {
    const currentSum = params.priceChangeWeight + params.volumeWeight + params.volatilityWeight + params.fundingRateWeight;
    if (currentSum === 0) return; // 避免除零

    const normalizedParams = {
      ...params,
      priceChangeWeight: params.priceChangeWeight / currentSum,
      volumeWeight: params.volumeWeight / currentSum,
      volatilityWeight: params.volatilityWeight / currentSum,
      fundingRateWeight: params.fundingRateWeight / currentSum
    };

    setParams(normalizedParams);
    
    // 实时验证并更新错误状态
    const errors = validateParameters(normalizedParams);
    setParameterErrors(errors);
  };

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
      const snapshotWithNewPositions = markNewPositions(selectedSnapshot, index);
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

  // 标记新增持仓的函数
  const markNewPositions = (currentSnapshot: StrategySnapshot, currentIndex: number): StrategySnapshot => {
    if (!backtestResult) {
      return currentSnapshot;
    }

    const actualIndex = currentIndex === -1 ? backtestResult.snapshots.length - 1 : currentIndex;

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
          quantityChange: { type: 'new' },
          priceChange: { type: 'new' }
        }))
      };
    }

    // 获取前一期的快照
    const previousSnapshot = backtestResult.snapshots[actualIndex - 1];

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">BTCDOM 2.0 策略回测</h1>
          <p className="text-gray-600">
            基于成交量排行榜的BTC+做空ALT策略
            {granularityHours > 0 && (
              <span className="ml-2 inline-flex items-center text-sm text-blue-600">
                <Clock className="w-4 h-4 mr-1" />
                {granularityHours}小时再平衡
              </span>
            )}
            <span className="ml-2 text-xs text-gray-500">(时间：UTC+0)</span>
          </p>
        </div>

        {/* 策略参数配置 */}
        <Card>
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

              <div className="space-y-2">
                <Label htmlFor="btcRatio">BTC占比</Label>
                <div className="flex items-center space-x-2">
                  <Slider
                    value={[params.btcRatio * 100]}
                    onValueChange={(value) => handleParamChange('btcRatio', value[0] / 100)}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12 text-right">
                    {(params.btcRatio * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* 高级设置 */}
            {showAdvancedSettings && (
              <div className="space-y-6 border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-4">高级设置</h4>

                {/* 权重配置区域 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-medium text-gray-700">做空标的选择权重配置</h5>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm transition-colors duration-200 ${
                        !isWeightsValid() 
                          ? 'text-red-600 font-semibold' 
                          : 'text-gray-600'
                      }`}>
                        权重总和: {getWeightSumPercent()}%
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
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">跌幅权重</Label>
                      <div className="flex items-center space-x-3">
                        <Slider
                          value={[params.priceChangeWeight * 100]}
                          onValueChange={(value) => handleWeightChange('priceChange', value[0])}
                          max={100}
                          step={10}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium w-12 text-right bg-gray-50 px-2 py-1 rounded">
                          {(params.priceChangeWeight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">评估价格下跌程度，跌幅越大分数越高</p>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">成交量权重</Label>
                      <div className="flex items-center space-x-3">
                        <Slider
                          value={[params.volumeWeight * 100]}
                          onValueChange={(value) => handleWeightChange('volume', value[0])}
                          max={100}
                          step={10}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium w-12 text-right bg-gray-50 px-2 py-1 rounded">
                          {(params.volumeWeight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">评估交易活跃度和流动性，确保足够流动性</p>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">波动率权重</Label>
                      <div className="flex items-center space-x-3">
                        <Slider
                          value={[params.volatilityWeight * 100]}
                          onValueChange={(value) => handleWeightChange('volatility', value[0])}
                          max={100}
                          step={10}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium w-12 text-right bg-gray-50 px-2 py-1 rounded">
                          {(params.volatilityWeight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">评估价格波动稳定性，适中波动率得分最高</p>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">资金费率权重</Label>
                      <div className="flex items-center space-x-3">
                        <Slider
                          value={[params.fundingRateWeight * 100]}
                          onValueChange={(value) => handleWeightChange('fundingRate', value[0])}
                          max={100}
                          step={10}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium w-12 text-right bg-gray-50 px-2 py-1 rounded">
                          {(params.fundingRateWeight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">评估做空成本和收益，正费率对做空有利</p>
                    </div>
                  </div>
                </div>

                {/* 其他配置 */}
                <div className="space-y-4">
                  <h5 className="text-sm font-medium text-gray-700">其他配置</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="maxShortPositions" className="text-sm font-medium">最多做空标的数量</Label>
                      <Input
                        id="maxShortPositions"
                        type="number"
                        min="1"
                        max="50"
                        value={params.maxShortPositions}
                        onChange={(e) => handleParamChange('maxShortPositions', parseInt(e.target.value) || 0)}
                        placeholder="请输入1-50的数字"
                      />
                      <p className="text-xs text-gray-500">控制同时做空的币种数量</p>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="tradingFeeRate" className="text-sm font-medium">
                        交易手续费率 <span className="text-gray-400">(按交易金额收取)</span>
                      </Label>
                      <div className="flex items-center space-x-3">
                        <Input
                          id="tradingFeeRate"
                          type="number"
                          step="0.001"
                          min="0"
                          max="0.01"
                          value={params.tradingFeeRate}
                          onChange={(e) => handleParamChange('tradingFeeRate', parseFloat(e.target.value) || 0)}
                          className="flex-1"
                          placeholder="0.002"
                        />
                        <span className="text-sm font-medium w-16 text-right bg-gray-50 px-2 py-1 rounded">
                          {(params.tradingFeeRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">买入卖出时的手续费成本</p>
                    </div>
                  </div>
                </div>

                {/* 仓位配置策略 */}
                <div className="space-y-4">
                  <h5 className="text-sm font-medium text-gray-700">仓位分配策略</h5>
                  <div className="space-y-3">
                    <Select
                      value={params.allocationStrategy}
                      onValueChange={(value) => handleParamChange('allocationStrategy', value as PositionAllocationStrategy)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PositionAllocationStrategy.BY_VOLUME}>按成交量比例分配</SelectItem>
                        <SelectItem value={PositionAllocationStrategy.BY_COMPOSITE_SCORE}>按综合分数分配权重</SelectItem>
                        <SelectItem value={PositionAllocationStrategy.EQUAL_ALLOCATION}>平均分配做空资金</SelectItem>
                      </SelectContent>
                    </Select>

                    {params.allocationStrategy === PositionAllocationStrategy.BY_COMPOSITE_SCORE && (
                      <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <Label className="text-sm font-medium text-blue-900">单币种最高持仓限制</Label>
                        <div className="flex items-center space-x-3">
                          <Slider
                            value={[params.maxSinglePositionRatio * 100]}
                            onValueChange={(value) => handleParamChange('maxSinglePositionRatio', value[0] / 100)}
                            max={50}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-sm font-medium w-12 text-right bg-white px-2 py-1 rounded">
                            {(params.maxSinglePositionRatio * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-blue-600 font-medium">
                            📍 此百分比是相对于分配给ALT做空的资金({((1 - params.btcRatio) * 100).toFixed(0)}%)而言
                          </p>
                          <p className="text-xs text-gray-600">
                            例如：ALT做空资金 {params.initialCapital > 0 ? `$${(params.initialCapital * (1 - params.btcRatio)).toLocaleString()}` : 'X'}，单币种最多 {params.initialCapital > 0 ? `$${(params.initialCapital * (1 - params.btcRatio) * params.maxSinglePositionRatio).toLocaleString()}` : `X × ${(params.maxSinglePositionRatio * 100).toFixed(0)}%`}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 space-y-1">
                      <p><strong>按成交量比例分配：</strong>根据币种成交量大小按比例分配资金</p>
                      <p><strong>按综合分数分配：</strong>根据跌幅、成交量、波动率、资金费率的综合评分分配资金</p>
                      <p><strong>平均分配：</strong>每个选中的币种分配相等的资金</p>
                    </div>
                  </div>
                </div>

                {/* 策略选择 */}
                <div className="space-y-4 relative">
                  <h5 className="text-sm font-medium text-gray-700">策略组合选择</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
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
                        <p className="text-xs text-gray-500 mt-1">配置资金的{(params.btcRatio * 100).toFixed(0)}%用于做多BTC</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
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
                        <p className="text-xs text-gray-500 mt-1">配置资金的{((1 - params.btcRatio) * 100).toFixed(0)}%用于做空山寨币</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                    <p><strong>策略说明：</strong>BTCDOM策略通过同时做多BTC和做空ALT币来获得BTC相对强势时的超额收益。</p>
                  </div>
                </div>
              </div>
            )}

            {/* 执行按钮 */}
            <div className="flex justify-center pt-4">
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

        {/* 错误显示 */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">回测失败</span>
              </div>
              <p className="text-red-600 mt-2">{error}</p>
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
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                          <span className="text-sm font-medium text-gray-700">总盈亏</span>
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
                            <span className="text-xs text-gray-500 flex items-center gap-1">
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
                            <span className="text-xs text-gray-500 flex items-center gap-1">
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
                          <span className="text-xs text-gray-500">手续费盈亏</span>
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
                              <span className="text-xs text-gray-500">资金费率盈亏</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-gray-100">
                                    <Info className="h-3 w-3 text-gray-400" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 text-sm">
                                  <div className="space-y-2">
                                    <p className="font-medium">资金费率说明</p>
                                    <p className="text-gray-600">
                                      对于做空头寸：
                                    </p>
                                    <div className="text-xs text-gray-500 space-y-1">
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
                          <div className="mt-4 p-2 bg-green-50 rounded text-xs text-green-700 border border-green-200">
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
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 最大回撤 - 突出显示 */}
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-md">
                    <span className="text-sm font-medium text-gray-700">最大回撤</span>
                    <div className="text-xl font-bold text-red-600">
                      {formatAmountWithPercent(
                        params.initialCapital * backtestResult.performance.maxDrawdown,
                        backtestResult.performance.maxDrawdown * 100
                      )}
                    </div>
                  </div>
                  {/* 年化收益率 */}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-gray-500">年化收益率</span>
                    <span className={`text-sm font-semibold ${getValueColorClass(backtestResult.performance.annualizedReturn)}`}>
                      {formatPercent(
                        backtestResult.performance.annualizedReturn * 100
                      )}
                    </span>
                  </div>
                  {/* 夏普比率 */}
                  <div className="flex justify-between items-center py-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">夏普比率</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-gray-100">
                            <Info className="h-3 w-3 text-gray-400" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 text-sm">
                          <div className="space-y-2">
                            <p className="font-medium">夏普比率说明</p>
                            <p className="text-gray-600">
                              衡量风险调整后收益的指标，计算公式为：(年化收益率 - 无风险利率) / 年化波动率
                            </p>
                            <div className="text-xs text-gray-500 space-y-1">
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
                      backtestResult.performance.sharpeRatio >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {backtestResult.performance.sharpeRatio.toFixed(2)}
                    </span>
                  </div>

                  {/* 波动率 */}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-gray-500">波动率</span>
                    <span className="text-sm font-semibold text-gray-700">
                      {(backtestResult.performance.volatility * 100).toFixed(2)}%
                    </span>
                  </div>

                  {/* 胜率 */}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-gray-500">胜率</span>
                    <span className="text-sm font-semibold text-blue-600">
                      {(backtestResult.performance.winRate * 100).toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* BTC价格与策略收益对比 */}
            <Card>
              <CardHeader>
                <CardTitle>
                  BTC价格与策略收益对比
                  <span className="text-sm font-normal text-gray-500 ml-2">
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
              <Card>
                <CardHeader>
                  <CardTitle>
                    策略统计
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      (BTC占比: {(params.btcRatio * 100).toFixed(0)}%)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">总再平衡次数</span>
                      <span className="font-medium">{backtestResult.summary.totalRebalances}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">持仓状态次数</span>
                      <span className="font-medium text-green-600">{backtestResult.summary.activeRebalances}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">空仓状态次数</span>
                      <span className="font-medium text-gray-500">{backtestResult.summary.inactiveRebalances}</span>
                    </div>
                    {/* 只在选择做空ALT时显示平均做空标的数量 */}
                    {params.shortAlt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">平均做空标的数量</span>
                        <span className="font-medium">{backtestResult.summary.avgShortPositions.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">策略持仓率</span>
                      <span className="font-medium">
                        {((backtestResult.summary.activeRebalances / backtestResult.summary.totalRebalances) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>风险指标</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600">波动率</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="text-gray-400 hover:text-gray-600">
                              <Info className="w-3 h-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 text-sm" side="top">
                            <div className="space-y-2">
                              <div className="font-medium">年化波动率</div>
                              <div className="text-gray-600">
                                衡量策略收益率的变动程度，反映投资风险的大小。
                              </div>
                              <div className="text-xs text-gray-500 border-t pt-2">
                                • 波动率越高，风险越大<br/>
                                • 波动率越低，收益越稳定
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <span className="font-medium">{(backtestResult.performance.volatility * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">胜率</span>
                      <span className="font-medium">{(backtestResult.performance.winRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">最佳收益期</span>
                      <div className="text-right">
                        <span className="font-medium text-green-600">
                          {backtestResult.performance.bestPeriodInfo && (
                            <span className="text-xs text-gray-500 mr-2">
                              第{backtestResult.performance.bestPeriodInfo.period}期 • {formatPeriodTime(backtestResult.performance.bestPeriodInfo.timestamp)}
                            </span>
                          )}
                          {formatAmountWithPercent(
                            params.initialCapital * backtestResult.performance.bestPeriod,
                            backtestResult.performance.bestPeriod * 100
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">最差收益期</span>
                      <div className="text-right">
                        <span className="font-medium text-red-600">
                          {backtestResult.performance.worstPeriodInfo && (
                            <span className="text-xs text-gray-500 mr-2">
                              第{backtestResult.performance.worstPeriodInfo.period}期 • {formatPeriodTime(backtestResult.performance.worstPeriodInfo.timestamp)}
                            </span>
                          )}
                          {formatAmountWithPercent(
                            params.initialCapital * backtestResult.performance.worstPeriod,
                            backtestResult.performance.worstPeriod * 100
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">最多资金费期</span>
                      <div className="text-right">
                        <span className="font-medium text-green-600">
                          {backtestResult.performance.bestFundingPeriodInfo && (
                            <span className="text-xs text-gray-500 mr-2">
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
                      <span className="text-gray-600">最少资金费期</span>
                      <div className="text-right">
                        <span className="font-medium text-red-600">
                          {backtestResult.performance.worstFundingPeriodInfo && (
                            <span className="text-xs text-gray-500 mr-2">
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
                    <div className="flex justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600">卡玛比率</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="text-gray-400 hover:text-gray-600">
                              <Info className="w-3 h-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 text-sm" side="top">
                            <div className="space-y-2">
                              <div className="font-medium">卡玛比率 (Calmar Ratio)</div>
                              <div className="text-gray-600">
                                卡玛比率 = 年化收益率 ÷ 最大回撤
                              </div>
                              <div className="text-gray-600">
                                用于衡量风险调整后的收益表现。比率越高，说明在承担相同回撤风险下获得了更高的收益。
                              </div>
                              <div className="text-xs text-gray-500 border-t pt-2">
                                • &gt; 1.0：优秀表现<br/>
                                • 0.5-1.0：良好表现<br/>
                                • &lt; 0.5：需要改进
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <span className="font-medium">{backtestResult.performance.calmarRatio.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 历史持仓查看 */}
            {backtestResult && backtestResult.snapshots && backtestResult.snapshots.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    持仓历史分析
                    <span className="text-sm font-normal text-gray-500 ml-2">
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
                              className={selectedSnapshotIndex === -1 ? 'bg-blue-50 border-blue-300' : ''}
                            >
                              最新
                            </Button>
                            <span className="text-xs text-gray-500">
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
                          <div className="flex justify-between text-xs text-gray-500">
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
