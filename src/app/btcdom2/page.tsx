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
    startDate: '2023-12-01',
    endDate: '2025-06-17',
    initialCapital: 10000,
    btcRatio: 0.5,
    priceChangeWeight: 0.5,
    volumeWeight: 0.3,
    volatilityWeight: 0.2,
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

    if (Math.abs(params.priceChangeWeight + params.volumeWeight + params.volatilityWeight - 1) > 0.001) {
      errors.weights = '跌幅权重、成交量权重和波动率权重之和必须等于1';
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

    return errors;
  }, []);

  // 执行回测
  const runBacktest = useCallback(async () => {
    const errors = validateParameters(params);
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
        body: JSON.stringify(params),
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
  }, [validateParameters]);

  // 页面加载时自动执行一次回测
  useEffect(() => {
    // 只在页面首次加载时执行回测
    runBacktest();
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 参数更新处理
  const handleParamChange = (key: keyof BTCDOM2StrategyParams, value: string | number | boolean) => {
    setParams(prev => ({
      ...prev,
      [key]: value
    }));

    // 清除相关参数错误
    if (parameterErrors[key]) {
      setParameterErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  // 权重调整处理
  const handleWeightChange = (type: 'priceChange' | 'volume' | 'volatility', value: number) => {
    const weight = value / 100;
    let newParams: BTCDOM2StrategyParams;
    
    if (type === 'priceChange') {
      // 调整跌幅权重时，按比例调整其他两个权重
      const remaining = 1 - weight;
      const currentOtherTotal = params.volumeWeight + params.volatilityWeight;
      newParams = {
        ...params,
        priceChangeWeight: weight,
        volumeWeight: currentOtherTotal > 0 ? remaining * (params.volumeWeight / currentOtherTotal) : remaining * 0.6,
        volatilityWeight: currentOtherTotal > 0 ? remaining * (params.volatilityWeight / currentOtherTotal) : remaining * 0.4
      };
    } else if (type === 'volume') {
      // 调整成交量权重时，按比例调整其他两个权重
      const remaining = 1 - weight;
      const currentOtherTotal = params.priceChangeWeight + params.volatilityWeight;
      newParams = {
        ...params,
        volumeWeight: weight,
        priceChangeWeight: currentOtherTotal > 0 ? remaining * (params.priceChangeWeight / currentOtherTotal) : remaining * 0.625,
        volatilityWeight: currentOtherTotal > 0 ? remaining * (params.volatilityWeight / currentOtherTotal) : remaining * 0.375
      };
    } else {
      // 调整波动率权重时，按比例调整其他两个权重
      const remaining = 1 - weight;
      const currentOtherTotal = params.priceChangeWeight + params.volumeWeight;
      newParams = {
        ...params,
        volatilityWeight: weight,
        priceChangeWeight: currentOtherTotal > 0 ? remaining * (params.priceChangeWeight / currentOtherTotal) : remaining * 0.625,
        volumeWeight: currentOtherTotal > 0 ? remaining * (params.volumeWeight / currentOtherTotal) : remaining * 0.375
      };
    }

    console.log('权重调整:', {
      type,
      inputValue: value,
      newPriceChangeWeight: newParams.priceChangeWeight,
      newVolumeWeight: newParams.volumeWeight,
      newVolatilityWeight: newParams.volatilityWeight,
      sum: newParams.priceChangeWeight + newParams.volumeWeight + newParams.volatilityWeight
    });

    setParams(newParams);

    // 清除权重错误
    if (parameterErrors.weights) {
      setParameterErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.weights;
        return newErrors;
      });
    }
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
                  className={parameterErrors.dateRange ? 'border-red-500' : ''}
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
                  className={parameterErrors.dateRange ? 'border-red-500' : ''}
                />
                {parameterErrors.dateRange && (
                  <p className="text-xs text-red-500">{parameterErrors.dateRange}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialCapital">初始本金 (USDT)</Label>
                <Input
                  id="initialCapital"
                  type="number"
                  value={params.initialCapital}
                  onChange={(e) => handleParamChange('initialCapital', parseFloat(e.target.value) || 0)}
                  className={parameterErrors.initialCapital ? 'border-red-500' : ''}
                />
                {parameterErrors.initialCapital && (
                  <p className="text-xs text-red-500">{parameterErrors.initialCapital}</p>
                )}
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
                {parameterErrors.btcRatio && (
                  <p className="text-xs text-red-500">{parameterErrors.btcRatio}</p>
                )}
              </div>
            </div>

            {/* 高级设置 */}
            {showAdvancedSettings && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium text-gray-900">高级设置</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>跌幅权重</Label>
                    <div className="flex items-center space-x-2">
                      <Slider
                        value={[params.priceChangeWeight * 100]}
                        onValueChange={(value) => handleWeightChange('priceChange', value[0])}
                        max={100}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-12 text-right">
                        {(params.priceChangeWeight * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>成交量权重</Label>
                    <div className="flex items-center space-x-2">
                      <Slider
                        value={[params.volumeWeight * 100]}
                        onValueChange={(value) => handleWeightChange('volume', value[0])}
                        max={100}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-12 text-right">
                        {(params.volumeWeight * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>波动率权重</Label>
                    <div className="flex items-center space-x-2">
                      <Slider
                        value={[params.volatilityWeight * 100]}
                        onValueChange={(value) => handleWeightChange('volatility', value[0])}
                        max={100}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-12 text-right">
                        {(params.volatilityWeight * 100).toFixed(0)}%
                      </span>
                    </div>
                    {parameterErrors.weights && (
                      <p className="text-xs text-red-500">{parameterErrors.weights}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxShortPositions">最多做空标的数量</Label>
                    <Input
                      id="maxShortPositions"
                      type="number"
                      value={params.maxShortPositions}
                      onChange={(e) => handleParamChange('maxShortPositions', parseInt(e.target.value) || 0)}
                      className={parameterErrors.maxShortPositions ? 'border-red-500' : ''}
                    />
                    {parameterErrors.maxShortPositions && (
                      <p className="text-xs text-red-500">{parameterErrors.maxShortPositions}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tradingFeeRate">交易手续费率<span className="text-xs text-gray-500">(按交易金额收取)</span></Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="tradingFeeRate"
                        type="number"
                        step="0.001"
                        min="0"
                        max="0.01"
                        value={params.tradingFeeRate}
                        onChange={(e) => handleParamChange('tradingFeeRate', parseFloat(e.target.value) || 0)}
                        className={`flex-1 ${parameterErrors.tradingFeeRate ? 'border-red-500' : ''}`}
                      />
                      <span className="text-sm font-medium w-12 text-right">
                        {(params.tradingFeeRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    {parameterErrors.tradingFeeRate && (
                      <p className="text-xs text-red-500">{parameterErrors.tradingFeeRate}</p>
                    )}
                  </div>
                </div>

                {/* 仓位配置策略 */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-4 gap-4">
                    <div className="flex-1">
                      <Select 
                        value={params.allocationStrategy} 
                        onValueChange={(value) => handleParamChange('allocationStrategy', value as PositionAllocationStrategy)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PositionAllocationStrategy.BY_VOLUME}>按成交量比例分配</SelectItem>
                          <SelectItem value={PositionAllocationStrategy.BY_COMPOSITE_SCORE}>按综合分数分配权重</SelectItem>
                          <SelectItem value={PositionAllocationStrategy.EQUAL_ALLOCATION}>平均分配做空资金</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {params.allocationStrategy === PositionAllocationStrategy.BY_COMPOSITE_SCORE && (
                      <div className="flex items-center space-x-2 flex-1">
                        <Label className="text-sm whitespace-nowrap">最高单币种持仓限制</Label>
                        <Slider
                          value={[params.maxSinglePositionRatio * 100]}
                          onValueChange={(value) => handleParamChange('maxSinglePositionRatio', value[0] / 100)}
                          max={50}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium w-12 text-right">
                          {(params.maxSinglePositionRatio * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 策略选择 */}
                <div className="border-t pt-4">
                  <h5 className="font-medium text-gray-900 mb-3">策略选择</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="longBtc"
                        checked={params.longBtc}
                        onCheckedChange={(checked) => handleParamChange('longBtc', checked as boolean)}
                      />
                      <Label htmlFor="longBtc" className="text-sm font-medium leading-none">
                        做多BTC
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="shortAlt"
                        checked={params.shortAlt}
                        onCheckedChange={(checked) => handleParamChange('shortAlt', checked as boolean)}
                      />
                      <Label htmlFor="shortAlt" className="text-sm font-medium leading-none">
                        做空ALT
                      </Label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    根据BTC占比分配资金，可单独选择做多BTC或做空ALT，或两者同时进行
                  </p>
                  {parameterErrors.strategySelection && (
                    <p className="text-xs text-red-500 mt-1">{parameterErrors.strategySelection}</p>
                  )}
                </div>
              </div>
            )}

            {/* 执行按钮 */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={runBacktest}
                disabled={loading}
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
                  <CardTitle className="text-sm font-medium text-gray-600">
                    收益率分解
                  </CardTitle>
                  <TrendingUp className={`h-4 w-4 ${
                    backtestResult.performance.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
                  }`} />
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 总盈亏 - 突出显示 */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                    <span className="text-sm font-medium text-gray-700">总盈亏</span>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${
                        backtestResult.performance.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {backtestResult.performance.totalReturn >= 0 ? '+' : ''}${(params.initialCapital * backtestResult.performance.totalReturn).toFixed(2)}
                      </div>
                      <div className={`text-sm font-medium ${
                        backtestResult.performance.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ({backtestResult.performance.totalReturn >= 0 ? '+' : ''}{(backtestResult.performance.totalReturn * 100).toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                  
                  {/* 年化收益率 */}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-gray-500">年化收益率</span>
                    <span className={`text-sm font-semibold ${
                      backtestResult.performance.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(backtestResult.performance.annualizedReturn * 100).toFixed(2)}%
                    </span>
                  </div>
                  
                  {/* 只在选择做多BTC时显示BTC收益率 */}
                  {params.longBtc && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-xs text-orange-500 flex items-center gap-1">
                        <Bitcoin className="w-3 h-3" />
                        BTC做多
                      </span>
                      <span className={`text-sm font-semibold ${
                        backtestResult.performance.btcReturn >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(backtestResult.performance.btcReturn * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                  
                  {/* 只在选择做空ALT时显示ALT收益率 */}
                  {params.shortAlt && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-xs text-blue-500 flex items-center gap-1">
                        <ArrowDown className="w-3 h-3" />
                        ALT做空
                      </span>
                      <span className={`text-sm font-semibold ${
                        backtestResult.performance.altReturn >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(backtestResult.performance.altReturn * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 风险指标卡片 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    风险指标
                  </CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 最大回撤 - 突出显示 */}
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-md">
                    <span className="text-sm font-medium text-gray-700">最大回撤</span>
                    <div className="text-right">
                      <div className="text-xl font-bold text-red-600">
                        -${(params.initialCapital * backtestResult.performance.maxDrawdown).toFixed(2)}
                      </div>
                      <div className="text-sm font-medium text-red-600">
                        ({(backtestResult.performance.maxDrawdown * 100).toFixed(2)}%)
                      </div>
                    </div>
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
                          {(backtestResult.performance.bestPeriod * 100).toFixed(2)}%
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
                          {(backtestResult.performance.worstPeriod * 100).toFixed(2)}%
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

                      {/* 当前选中时间点的详细信息 */}
                      {currentSnapshot && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">时间: </span>
                              <span className="font-medium">{formatPeriodTime(currentSnapshot.timestamp)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">期数: </span>
                              <span className="font-medium">
                                第 {selectedSnapshotIndex === -1 ? backtestResult.snapshots.length : selectedSnapshotIndex + 1} 期
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">BTC价格: </span>
                              <span className="font-medium">${currentSnapshot.btcPrice.toLocaleString()}</span>
                              <span className={`font-medium ${currentSnapshot.btcPriceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ({currentSnapshot.btcPriceChange24h >= 0 ? "+" : ""}{currentSnapshot.btcPriceChange24h.toFixed(2)}%)
                              </span>
                            </div>

                            <div>
                              <span className="text-gray-500">做空标的数: </span>
                              <span className="font-medium">{currentSnapshot.shortPositions.length}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 持仓表格 */}
                      {currentSnapshot && (
                        <BTCDOM2PositionTable snapshot={currentSnapshot} params={params} />
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
