'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

import { 
  BTCDOM2StrategyParams, 
  BTCDOM2BacktestResult, 
  BTCDOM2ChartData,
  StrategySnapshot
} from '@/types/btcdom2';
import { BTCDOM2Chart } from '@/components/btcdom2/btcdom2-chart';
import { BTCDOM2PerformanceCard } from '@/components/btcdom2/btcdom2-performance-card';
import { BTCDOM2PositionTable } from '@/components/btcdom2/btcdom2-position-table';
import { BTCDOM2PositionComparison } from '@/components/btcdom2/btcdom2-position-comparison';
import { AlertCircle, Play, Settings, TrendingUp, TrendingDown, Clock, Loader2, Eye, GitCompare } from 'lucide-react';

export default function BTCDOM2Dashboard() {
  // 策略参数状态
  const [params, setParams] = useState<BTCDOM2StrategyParams>({
    startDate: '2024-12-01',
    endDate: '2024-12-31',
    initialCapital: 10000,
    btcRatio: 0.5,
    volumeWeight: 0.6,
    volatilityWeight: 0.4,
    priceChangeThreshold: 5,
    maxShortPositions: 20
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
  const [parameterErrors, setParameterErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'current' | 'comparison'>('current');

  // 验证参数
  const validateParameters = useCallback((params: BTCDOM2StrategyParams): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (params.initialCapital <= 0) {
      errors.initialCapital = '初始本金必须大于0';
    }
    
    if (params.btcRatio < 0 || params.btcRatio > 1) {
      errors.btcRatio = 'BTC占比必须在0-1之间';
    }
    
    if (Math.abs(params.volumeWeight + params.volatilityWeight - 1) > 0.001) {
      errors.weights = '成交量权重和波动率权重之和必须等于1';
    }
    
    if (params.priceChangeThreshold <= 0) {
      errors.priceChangeThreshold = '涨跌幅阈值必须大于0';
    }
    
    if (params.maxShortPositions <= 0 || params.maxShortPositions > 50) {
      errors.maxShortPositions = '做空标的数量必须在1-50之间';
    }
    
    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    if (startDate >= endDate) {
      errors.dateRange = '开始日期必须早于结束日期';
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
        setCurrentSnapshot(result.data.snapshots[result.data.snapshots.length - 1]);
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
  }, [params, validateParameters]);

  // 页面加载时自动执行一次回测
  useEffect(() => {
    runBacktest();
  }, [runBacktest]); // 添加 runBacktest 依赖

  // 参数更新处理
  const handleParamChange = (key: keyof BTCDOM2StrategyParams, value: string | number) => {
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
  const handleWeightChange = (type: 'volume' | 'volatility', value: number) => {
    const weight = value / 100;
    if (type === 'volume') {
      setParams(prev => ({
        ...prev,
        volumeWeight: weight,
        volatilityWeight: 1 - weight
      }));
    } else {
      setParams(prev => ({
        ...prev,
        volatilityWeight: weight,
        volumeWeight: 1 - weight
      }));
    }
    
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
      if (index === -1) {
        // 选择最新
        setCurrentSnapshot(backtestResult.snapshots[backtestResult.snapshots.length - 1]);
      } else {
        setCurrentSnapshot(backtestResult.snapshots[index]);
      }
    }
  };

  // 格式化时间显示（使用UTC时区）
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });
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
                <Input
                  id="startDate"
                  type="date"
                  value={params.startDate}
                  onChange={(e) => handleParamChange('startDate', e.target.value)}
                  className={parameterErrors.dateRange ? 'border-red-500' : ''}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate">结束日期</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={params.endDate}
                  onChange={(e) => handleParamChange('endDate', e.target.value)}
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
                <h4 className="font-medium text-gray-900">高级参数</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="priceChangeThreshold">涨跌幅阈值 (%)</Label>
                    <Input
                      id="priceChangeThreshold"
                      type="number"
                      step="0.1"
                      value={params.priceChangeThreshold}
                      onChange={(e) => handleParamChange('priceChangeThreshold', parseFloat(e.target.value) || 0)}
                      className={parameterErrors.priceChangeThreshold ? 'border-red-500' : ''}
                    />
                    {parameterErrors.priceChangeThreshold && (
                      <p className="text-xs text-red-500">{parameterErrors.priceChangeThreshold}</p>
                    )}
                  </div>
                  
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
            {/* 性能指标卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <BTCDOM2PerformanceCard
                title="总收益率"
                value={`${(backtestResult.performance.totalReturn * 100).toFixed(2)}%`}
                icon={backtestResult.performance.totalReturn >= 0 ? TrendingUp : TrendingDown}
                trend={backtestResult.performance.totalReturn >= 0 ? 'positive' : 'negative'}
              />
              <BTCDOM2PerformanceCard
                title="年化收益率"
                value={`${(backtestResult.performance.annualizedReturn * 100).toFixed(2)}%`}
                icon={TrendingUp}
                trend={backtestResult.performance.annualizedReturn >= 0 ? 'positive' : 'negative'}
              />
              <BTCDOM2PerformanceCard
                title="最大回撤"
                value={`${(backtestResult.performance.maxDrawdown * 100).toFixed(2)}%`}
                icon={TrendingDown}
                trend="negative"
              />
              <BTCDOM2PerformanceCard
                title="夏普比率"
                value={backtestResult.performance.sharpeRatio.toFixed(2)}
                icon={TrendingUp}
                trend={backtestResult.performance.sharpeRatio >= 0 ? 'positive' : 'negative'}
              />
            </div>

            {/* BTC价格与策略收益对比 */}
            <Card>
              <CardHeader>
                <CardTitle>BTC价格与策略收益对比</CardTitle>
              </CardHeader>
              <CardContent>
                <BTCDOM2Chart data={chartData} />
              </CardContent>
            </Card>

            {/* 详细统计 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>策略统计</CardTitle>
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
                    <div className="flex justify-between">
                      <span className="text-gray-600">平均做空标的数量</span>
                      <span className="font-medium">{backtestResult.summary.avgShortPositions.toFixed(1)}</span>
                    </div>
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
                      <span className="text-gray-600">波动率</span>
                      <span className="font-medium">{(backtestResult.performance.volatility * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">胜率</span>
                      <span className="font-medium">{(backtestResult.performance.winRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">最佳收益期</span>
                      <span className="font-medium text-green-600">
                        {(backtestResult.performance.bestPeriod * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">最差收益期</span>
                      <span className="font-medium text-red-600">
                        {(backtestResult.performance.worstPeriod * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">卡玛比率</span>
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
                  <CardTitle className="flex items-center justify-between">
                    <span>持仓历史分析</span>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <Button
                        variant={activeTab === 'current' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('current')}
                        className="text-xs"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        持仓查看
                      </Button>
                      <Button
                        variant={activeTab === 'comparison' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('comparison')}
                        className="text-xs"
                      >
                        <GitCompare className="w-3 h-3 mr-1" />
                        持仓对比
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeTab === 'current' ? (
                    <>
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
                            <span>{formatTimestamp(backtestResult.snapshots[0].timestamp)}</span>
                            <span>
                              {currentSnapshot && formatTimestamp(currentSnapshot.timestamp)}
                            </span>
                            <span>{formatTimestamp(backtestResult.snapshots[backtestResult.snapshots.length - 1].timestamp)}</span>
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
                            onClick={() => handleSnapshotSelection(Math.floor(backtestResult.snapshots.length / 4))}
                            className="text-xs"
                          >
                            25%
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSnapshotSelection(Math.floor(backtestResult.snapshots.length / 2))}
                            className="text-xs"
                          >
                            50%
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSnapshotSelection(Math.floor(backtestResult.snapshots.length * 3 / 4))}
                            className="text-xs"
                          >
                            75%
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSnapshotSelection(backtestResult.snapshots.length - 1)}
                            className="text-xs"
                          >
                            最后一期
                          </Button>
                        </div>
                      </div>

                      {/* 当前选中时间点的详细信息 */}
                      {currentSnapshot && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">时间: </span>
                              <span className="font-medium">{formatTimestamp(currentSnapshot.timestamp)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">第 </span>
                              <span className="font-medium">{currentSnapshot.hour}</span>
                              <span className="text-gray-500"> 小时</span>
                            </div>
                            <div>
                              <span className="text-gray-500">BTC 24h涨跌: </span>
                              <span className={`font-medium ${currentSnapshot.btcPriceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {currentSnapshot.btcPriceChange24h.toFixed(2)}%
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
                        <BTCDOM2PositionTable snapshot={currentSnapshot} />
                      )}
                    </>
                  ) : (
                    /* 持仓对比功能 */
                    <BTCDOM2PositionComparison snapshots={backtestResult.snapshots} />
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