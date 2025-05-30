'use client';

import { useState, useEffect, useCallback } from 'react';
import { BtcDomComparisonChart } from '@/components/btcdom/btcdom-comparison-chart';
import { PerformanceMetrics } from '@/components/btcdom/performance-metrics';
import { BtcDomDataTable } from '@/components/btcdom/btcdom-data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Badge import removed as it's not used in this component
import { 
  BtcDomStrategyData, 
  BtcDomComparisonData, 
  BtcDomComparisonParams,
  BtcDomPerformanceMetrics,
  BtcDomResponse,
  ChartDataPoint 
} from '@/types/btcdom';
import {
  processStrategyData,
  extractPricesFromKlineData,
  mergeComparisonData,
  generateChartData,
  filterDataByTimeRange,
  calculatePerformanceMetrics,
  getBarsFromTimeRange,
  KlineData
} from '@/lib/btcdom-utils';

export default function BtcDomComparisonDashboard() {
  const [strategyData, setStrategyData] = useState<BtcDomStrategyData[]>([]);
  const [binanceData, setBinanceData] = useState<KlineData | null>(null);
  const [comparisonData, setComparisonData] = useState<BtcDomComparisonData[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 性能指标
  const [strategyMetrics, setStrategyMetrics] = useState<BtcDomPerformanceMetrics | null>(null);
  const [binanceMetrics, setBinanceMetrics] = useState<BtcDomPerformanceMetrics | null>(null);

  // 参数状态
  const [params, setParams] = useState<BtcDomComparisonParams>({
    timeRange: 'ALL',
  });

  // 获取自制BTCDOM策略数据
  const fetchStrategyData = useCallback(async () => {
    try {
      const response = await fetch('/api/btcdom?direction=ascending');
      
      if (!response.ok) {
        throw new Error(`策略API请求失败: ${response.status}`);
      }
      
      const result: BtcDomResponse = await response.json();
      
      if (result.success && result.data && Array.isArray(result.data)) {
        setStrategyData(result.data);
        return result.data;
      } else {
        throw new Error(result.error || '获取策略数据失败');
      }
    } catch (err) {
      console.error('获取策略数据失败:', err);
      throw err;
    }
  }, []);

  // 获取币安BTCDOM合约数据
  const fetchBinanceData = useCallback(async (): Promise<KlineData> => {
    try {
      const bars = getBarsFromTimeRange(params.timeRange);
      // 使用现有的kline API获取BTCDOMUSDT.P的历史数据
      const response = await fetch(`/api/kline/btcdomusdt.p?interval=1D&bars=${bars}`);
      
      if (!response.ok) {
        throw new Error(`获取币安数据失败: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data && result.data.candles && Array.isArray(result.data.candles)) {
        setBinanceData(result.data);
        return result.data;
      } else {
        throw new Error(result.error || '获取币安数据失败');
      }
    } catch (err) {
      console.error('获取币安数据失败:', err);
      throw err;
    }
  }, [params.timeRange]);

  // 处理和合并数据
  const processAndMergeData = useCallback((strategyRawData: BtcDomStrategyData[], binanceRawData: KlineData) => {
    try {
      
      // 处理策略数据
      const processedStrategyRecords = processStrategyData(strategyRawData);
      
      if (processedStrategyRecords.length === 0) {
        console.warn('没有有效的策略数据可以处理');
        setComparisonData([]);
        setChartData([]);
        setStrategyMetrics(null);
        setBinanceMetrics(null);
        return;
      }
      
      // 处理币安数据
      const binancePriceMap = extractPricesFromKlineData(binanceRawData);
      
      // 合并数据
      const mergedData = mergeComparisonData(processedStrategyRecords, binancePriceMap);
      
      // 根据参数过滤数据
      const filteredData = filterDataByTimeRange(mergedData, params);
      
      setComparisonData(filteredData);
      
      // 生成图表数据
      const chartDataPoints = generateChartData(filteredData);
      setChartData(chartDataPoints);
      
      // 计算性能指标
      if (filteredData.length > 0) {
        const strategyMetrics = calculatePerformanceMetrics(filteredData, true);
        const binanceMetrics = calculatePerformanceMetrics(filteredData, false);
        
        setStrategyMetrics(strategyMetrics);
        setBinanceMetrics(binanceMetrics);
      } else {
        console.warn('过滤后数据为空，无法计算性能指标');
        setStrategyMetrics(null);
        setBinanceMetrics(null);
      }
      
    } catch (err) {
      console.error('数据处理失败:', err);
      setError('数据处理失败: ' + (err instanceof Error ? err.message : '未知错误'));
      setComparisonData([]);
      setStrategyMetrics(null);
      setBinanceMetrics(null);
    }
  }, [params]);

  // 获取所有数据
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [strategyResult, binanceResult] = await Promise.all([
        fetchStrategyData(),
        fetchBinanceData()
      ]);
      
      processAndMergeData(strategyResult, binanceResult);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [fetchStrategyData, fetchBinanceData, processAndMergeData]);

  // 处理参数变化
  const handleParamsChange = useCallback((newParams: BtcDomComparisonParams) => {
    setParams(newParams);
    
    if (strategyData.length > 0 && binanceData) {
      processAndMergeData(strategyData, binanceData);
    }
  }, [strategyData, binanceData, processAndMergeData]);

  // 处理时间范围变化
  const handleTimeRangeChange = (value: string) => {
    handleParamsChange({ ...params, timeRange: value as BtcDomComparisonParams['timeRange'] });
  };

  // 当 timeRange 变化时重新获取币安数据
  useEffect(() => {
    if (strategyData.length > 0) {
      // timeRange 变化时需要重新获取币安数据
      const refetchBinanceData = async () => {
        try {
          const binanceResult = await fetchBinanceData();
          processAndMergeData(strategyData, binanceResult);
        } catch (err) {
          setError(err instanceof Error ? err.message : '重新获取币安数据失败');
        }
      };
      
      refetchBinanceData();
    }
  }, [params.timeRange, strategyData, fetchBinanceData, processAndMergeData]);

  // 当其他参数变化时重新处理现有数据
  useEffect(() => {
    if (strategyData.length > 0 && binanceData && (params.startDate || params.endDate)) {
      processAndMergeData(strategyData, binanceData);
    }
  }, [params.startDate, params.endDate, strategyData, binanceData, processAndMergeData]);

  // 初始加载数据
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return (
    <div className="container mx-auto p-6 max-w-[1920px]">
      <div className="space-y-6">
        {/* 标题和时间范围选择器 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">BTCDOM 策略收益对比</h2>
            <p className="text-sm text-muted-foreground">
              对比自制BTCDOM策略与币安BTCDOM合约(BTCDOMUSDT.P)的表现
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">时间范围</span>
            <Select value={params.timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="选择时间范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1M">近1个月</SelectItem>
                <SelectItem value="3M">近3个月</SelectItem>
                <SelectItem value="6M">近6个月</SelectItem>
                <SelectItem value="1Y">近1年</SelectItem>
                <SelectItem value="ALL">全部数据</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <span className="text-red-600">⚠️</span>
                <p className="text-red-700">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 性能指标对比 */}
        <PerformanceMetrics
          strategyMetrics={strategyMetrics}
          binanceMetrics={binanceMetrics}
          loading={loading}
        />

        {/* 对比图表 */}
        <BtcDomComparisonChart
          data={chartData}
          loading={loading}
        />

        {/* 数据表格 */}
        <BtcDomDataTable
          data={comparisonData}
          loading={loading}
        />

        {/* 数据说明 */}
        <Card>
          <CardHeader>
            <CardTitle>收益率对比说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">自制BTCDOM策略</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• 数据来源：Notion数据库</li>
                  <li>• 更新频率：根据策略运行情况</li>
                  <li>• 数据类型：实盘交易记录</li>
                  <li>• 计算方式：初始金额 = BTC仓位 × BTC初始价格 + ALT初始仓位(U)</li>
                  <li>• 收益率 = (总盈亏 + 初始金额) / 初始金额</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">币安BTCDOM合约</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• 合约代码：BTCDOMUSDT.P</li>
                  <li>• 数据来源：TradingView API</li>
                  <li>• 数据频率：日线K线数据</li>
                  <li>• 计算方式：根据策略开仓/平仓日期匹配对应价格</li>
                  <li>• 收益率 = (平仓价格 - 开仓价格) / 开仓价格</li>
                </ul>
              </div>
            </div>
            <div className="pt-3 border-t">
              <h4 className="font-semibold mb-2">性能指标说明</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">总收益率：</span>期间总体收益表现
                </div>
                <div>
                  <span className="font-medium">波动率：</span>年化波动率，衡量风险水平
                </div>
                <div>
                  <span className="font-medium">夏普比率：</span>风险调整后收益，数值越高越好
                </div>
                <div>
                  <span className="font-medium">最大回撤：</span>最大亏损幅度，数值越小越好
                </div>
                <div>
                  <span className="font-medium">胜率：</span>盈利交易日占比
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}