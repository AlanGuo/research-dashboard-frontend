'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceArea
} from 'recharts';
import { BTCDOM2ChartData, BTCDOM2StrategyParams, BTCDOM2PerformanceMetrics } from '@/types/btcdom2';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// 扩展的图表数据类型，包含处理后的字段
interface ProcessedChartData extends BTCDOM2ChartData {
  date: string;
  timestampValue: number; // 添加时间戳字段
  dataIndex: number; // 添加数组索引字段
  totalReturnPercent: number;
  btcReturnPercent: number;
  btcdomReturnPercent?: number | null; // 改为可选
  drawdownPercent: number;
  totalValueK: number;
  strategyReturnPercent?: number; // 回测策略收益率
  liveStrategyReturnPercent?: number; // 实盘策略收益率
  dataType?: 'backtest' | 'live';
  hasLiveData?: boolean; // 是否有实盘数据
  isAfterLiveStart?: boolean; // 是否在实盘数据开始之后
  backtestSolidPercent?: number; // 回测实线部分
  backtestDashedPercent?: number; // 回测虚线部分
}

interface BTCDOM2ChartProps {
  data: BTCDOM2ChartData[];
  params?: BTCDOM2StrategyParams;
  performance?: BTCDOM2PerformanceMetrics;
}

export function BTCDOM2Chart({ data, performance }: BTCDOM2ChartProps) {
  // 图表可见性状态
  const [visibility, setVisibility] = useState({
    btcPrice: true,
    btcReturn: true,
    btcdomReturn: true,
    strategyReturn: true,
    liveStrategyReturn: true, // 新增实盘策略收益率
    maxDrawdown: true
  });

  // 实盘数据对齐开关
  const [alignLiveData, setAlignLiveData] = useState(false);

  // 切换曲线可见性 - 使用 useCallback 避免不必要的重新渲染
  const toggleVisibility = useCallback((key: keyof typeof visibility) => {
    setVisibility(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  // 处理图表数据
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 计算BTC收益率基准价格（第一个有效价格）
    const initialBtcPrice = data.length > 0 && data[0].btcPrice ? data[0].btcPrice : null;

    // 计算BTCDOM收益率基准价格（第一个有效的非零价格）
    let initialBtcdomPrice = null;
    for (const point of data) {
      if (point.btcdomPrice && point.btcdomPrice > 0) {
        initialBtcdomPrice = point.btcdomPrice;
        break;
      }
    }

    // 找到第一个有实盘数据的点，用于对齐计算
    let firstLiveDataIndex = -1;
    let alignmentOffset = 0;

    if (alignLiveData) {
      for (let i = 0; i < data.length; i++) {
        if (data[i].liveReturn !== undefined) {
          firstLiveDataIndex = i;
          // 获取该点的回测收益率作为对齐基准
          alignmentOffset = data[i].totalReturn * 100;
          break;
        }
      }
    }

    const processedData = data.map((point, index) => {
      // 计算BTC收益率
      let btcReturnPercent = 0;
      if (initialBtcPrice && point.btcPrice) {
        btcReturnPercent = ((point.btcPrice - initialBtcPrice) / initialBtcPrice) * 100;
      }

      // 计算BTCDOM收益率
      let btcdomReturnPercent = null;
      if (initialBtcdomPrice && point.btcdomPrice && point.btcdomPrice > 0) {
        btcdomReturnPercent = ((point.btcdomPrice - initialBtcdomPrice) / initialBtcdomPrice) * 100;
      }

      // 计算对齐后的实盘收益率
      let alignedLiveStrategyReturnPercent = undefined;
      if (point.liveReturn !== undefined) {
        const rawLiveReturnPercent = point.liveReturn * 100;
        if (alignLiveData && firstLiveDataIndex >= 0) {
          // 对齐：实盘收益率 + 实盘首期对应的回测收益率
          alignedLiveStrategyReturnPercent = rawLiveReturnPercent + alignmentOffset;
        } else {
          alignedLiveStrategyReturnPercent = rawLiveReturnPercent;
        }
      }

      // 使用更稳定的日期格式化方法，包含分钟信息
      const dateObj = new Date(point.timestamp);
      const formattedDate = `${dateObj.getUTCFullYear()}/${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}/${String(dateObj.getUTCDate()).padStart(2, '0')} ${String(dateObj.getUTCHours()).padStart(2, '0')}:${String(dateObj.getUTCMinutes()).padStart(2, '0')}`;
      
      // 同时保留原有时间戳用于数值型 X 轴
      const timestampValue = point.timestamp;

      return {
        ...point,
        date: formattedDate,
        timestampValue, // 添加时间戳值
        dataIndex: index, // 添加数组索引
        totalReturnPercent: (point.totalReturn * 100),
        btcReturnPercent,
        btcdomReturnPercent,
        drawdownPercent: (point.drawdown * 100),
        totalValueK: point.totalValue / 1000, // 转换为千为单位
        // 使用对齐后的实盘收益率
        liveStrategyReturnPercent: alignedLiveStrategyReturnPercent,
        // 标记是否有实盘数据，用于样式控制
        hasLiveData: point.liveReturn !== undefined,
        isAfterLiveStart: firstLiveDataIndex >= 0 && index >= firstLiveDataIndex,
      };
    });

    return processedData;
  }, [data, alignLiveData]);

  // 使用处理后的图表数据，添加分离的回测数据字段
  const combinedChartData = useMemo(() => {
    const firstLiveIndex = chartData.findIndex(point => point.hasLiveData);

    const result = chartData.map((point, index) => {
      const strategyReturnPercent = point.totalReturnPercent;

      // 分离回测数据：实盘开始前用实线，实盘开始后用虚线
      let backtestSolidPercent = undefined;
      let backtestDashedPercent = undefined;

      if (firstLiveIndex === -1) {
        // 没有实盘数据，全部使用实线
        backtestSolidPercent = strategyReturnPercent;
      } else if (index < firstLiveIndex) {
        // 实盘开始前，使用实线
        backtestSolidPercent = strategyReturnPercent;
      } else if (index === firstLiveIndex) {
        // 分界点：两条线都有数据，确保连续性
        backtestSolidPercent = strategyReturnPercent;
        backtestDashedPercent = strategyReturnPercent;
      } else {
        // 实盘开始后，使用虚线
        backtestDashedPercent = strategyReturnPercent;
      }

      return {
        ...point, // 这会包含所有字段，包括 timestampValue
        strategyReturnPercent,
        backtestSolidPercent,
        backtestDashedPercent,
        dataType: 'backtest' as const
      };
    });

    return result;
  }, [chartData]);

  // 计算最大回撤区域
  const maxDrawdownArea = useMemo(() => {
    if (!performance?.maxDrawdownInfo || !combinedChartData || combinedChartData.length === 0) {
      return null;
    }

    const { startPeriod, endPeriod } = performance.maxDrawdownInfo;

    // 处理期数索引定位
    // 如果 startPeriod 为 0，表示从初始状态开始，使用第一个数据点
    // 如果 startPeriod > 0，期数是从1开始的，但数组索引是从0开始的
    const startIndex = startPeriod === 0 ? 0 : Math.max(0, startPeriod - 1);
    const endIndex = Math.min(combinedChartData.length - 1, endPeriod - 1);

    // 确保索引有效
    if (startIndex < 0 || endIndex < 0 || startIndex >= combinedChartData.length || endIndex >= combinedChartData.length) {
      console.warn('最大回撤区域索引无效:', { startIndex, endIndex, dataLength: combinedChartData.length, startPeriod, endPeriod });
      return null;
    }

    const startDateByIndex = combinedChartData[startIndex]?.date;
    const endDateByIndex = combinedChartData[endIndex]?.date;
    const startTimestamp = combinedChartData[startIndex]?.timestamp;
    const endTimestamp = combinedChartData[endIndex]?.timestamp;

    if (!startDateByIndex || !endDateByIndex || !startTimestamp || !endTimestamp) {
      console.warn('最大回撤区域日期无效:', { startDateByIndex, endDateByIndex, startIndex, endIndex });
      return null;
    }
    
    return {
      startDate: startDateByIndex,
      endDate: endDateByIndex,
      startIndex,
      endIndex
    };
  }, [performance?.maxDrawdownInfo, combinedChartData]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{
      color: string;
      name: string;
      value: number;
      payload: ProcessedChartData;
    }>;
    label?: string
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-900 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg backdrop-blur-sm">
          <p className="font-medium text-gray-900 dark:text-gray-100 mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">
            {new Date(data.timestamp).toISOString().slice(0, 16).replace('T', ' ')}
          </p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-6">
              <span className="text-gray-600 dark:text-gray-400">策略总资产:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                ${data.totalValue.toLocaleString()}
              </span>
            </div>
            {data.btcdomReturnPercent !== null && data.btcdomReturnPercent !== undefined && (
              <div className="flex justify-between gap-6">
                <span className="text-gray-600 dark:text-gray-400">BTCDOM收益率:</span>
                <span className={`font-medium ${data.btcdomReturnPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {data.btcdomReturnPercent.toFixed(2)}%
                </span>
              </div>
            )}
            {data.btcdomPrice && data.btcdomPrice > 0 && (
              <div className="flex justify-between gap-6">
                <span className="text-gray-600 dark:text-gray-400">BTCDOM价格:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  ${data.btcdomPrice.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-6">
              <span className="text-gray-600 dark:text-gray-400">BTC收益率:</span>
              <span className={`font-medium ${data.btcReturnPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {data.btcReturnPercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-600 dark:text-gray-400">BTC价格:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                ${data.btcPrice.toLocaleString()}
              </span>
            </div>
            {data.strategyReturnPercent !== undefined && (
              <div className="flex justify-between gap-6">
                <span className="text-gray-600 dark:text-gray-400">BTCDOM2.0回测收益率:</span>
                <span className={`font-medium ${data.strategyReturnPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {data.strategyReturnPercent.toFixed(2)}%
                </span>
              </div>
            )}
            {data.liveStrategyReturnPercent !== undefined && (
              <div className="flex justify-between gap-6">
                <span className="text-gray-600 dark:text-gray-400">BTCDOM2.0实盘收益率:</span>
                <span className={`font-medium ${data.liveStrategyReturnPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {data.liveStrategyReturnPercent.toFixed(2)}%
                </span>
              </div>
            )}
            <div className="flex justify-between gap-6">
              <span className="text-gray-600 dark:text-gray-400">策略状态:</span>
              <span className={`font-medium ${data.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {data.isActive ? '持仓' : '空仓'}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">暂无数据</p>
          <p className="text-sm text-muted-foreground mt-1">请执行回测或加载实盘数据以生成图表</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* BTC价格与策略收益对比 */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-medium">BTC价格与收益率对比</h4>

          {/* 实盘数据对齐控制 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="alignLiveData"
              checked={alignLiveData}
              onCheckedChange={(checked) => setAlignLiveData(checked === true)}
            />
            <Label
              htmlFor="alignLiveData"
              className="text-sm font-medium cursor-pointer"
            >
              实盘数据对齐
            </Label>
          </div>
        </div>

        {/* 自定义Legend - 独立于数据显示 */}
        <div className="flex justify-center gap-6 mb-4 flex-wrap">
          <div
            className={`flex items-center gap-2 cursor-pointer select-none transition-all duration-200 hover:scale-105 px-2 py-1 rounded ${
              visibility.btcPrice ? 'opacity-100' : 'opacity-50'
            }`}
            onClick={() => toggleVisibility('btcPrice')}
          >
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#f7931a' }}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              BTC价格 ($)
            </span>
          </div>
          <div
            className={`flex items-center gap-2 cursor-pointer select-none transition-all duration-200 hover:scale-105 px-2 py-1 rounded ${
              visibility.btcReturn ? 'opacity-100' : 'opacity-50'
            }`}
            onClick={() => toggleVisibility('btcReturn')}
          >
          <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#10b981' }}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              BTC收益率 (%)
            </span>
          </div>
          <div
            className={`flex items-center gap-2 cursor-pointer select-none transition-all duration-200 hover:scale-105 px-2 py-1 rounded ${
              visibility.btcdomReturn ? 'opacity-100' : 'opacity-50'
            }`}
            onClick={() => toggleVisibility('btcdomReturn')}
          >
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#8b5cf6' }}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              BTCDOM收益率 (%)
            </span>
          </div>
          <div
            className={`flex items-center gap-2 cursor-pointer select-none transition-all duration-200 hover:scale-105 px-2 py-1 rounded ${
              visibility.strategyReturn ? 'opacity-100' : 'opacity-50'
            }`}
            onClick={() => toggleVisibility('strategyReturn')}
          >
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#2563eb' }}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              BTCDOM2.0回测收益率 (%)
            </span>
          </div>
          <div
            className={`flex items-center gap-2 cursor-pointer select-none transition-all duration-200 hover:scale-105 px-2 py-1 rounded ${
              visibility.liveStrategyReturn ? 'opacity-100' : 'opacity-50'
            }`}
            onClick={() => toggleVisibility('liveStrategyReturn')}
          >
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#dc2626' }}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              BTCDOM2.0实盘收益率 (%)
            </span>
          </div>
          {/* 最大回撤区域图例 */}
          {maxDrawdownArea && (
            <div
              className={`flex items-center gap-2 cursor-pointer select-none transition-all duration-200 hover:scale-105 px-2 py-1 rounded ${
                visibility.maxDrawdown ? 'opacity-100' : 'opacity-50'
              }`}
              onClick={() => toggleVisibility('maxDrawdown')}
            >
              <div
                className="w-3 h-3 rounded border border-red-400"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                最大回撤期间
              </span>
            </div>
          )}
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={combinedChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="dataIndex"
                tick={{ fontSize: 12 }}
                stroke="#666"
                type="number"
                domain={[0, 'dataMax']}
                tickFormatter={(value) => {
                  const dataPoint = combinedChartData[Math.floor(value)];
                  if (!dataPoint) return '';
                  const date = new Date(dataPoint.timestamp);
                  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
                }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                stroke="#f7931a"
                label={{ value: 'BTC价格 ($)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                stroke="#2563eb"
                label={{ value: '收益率 (%)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* 最大回撤区域背景 - 使用数组索引确保稳定渲染 */}
              {maxDrawdownArea && 
               visibility.maxDrawdown && 
               maxDrawdownArea.startIndex !== undefined &&
               maxDrawdownArea.endIndex !== undefined &&
               maxDrawdownArea.startIndex !== maxDrawdownArea.endIndex && (
                <ReferenceArea
                  yAxisId="right"
                  x1={maxDrawdownArea.startIndex}
                  x2={maxDrawdownArea.endIndex}
                  fill="#fef2f2"
                  fillOpacity={0.8}
                  stroke="#dc2626"
                  strokeOpacity={0.8}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )}

              {visibility.btcPrice && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="btcPrice"
                  stroke="#f7931a"
                  strokeWidth={2}
                  dot={false}
                  name="BTC价格 ($)"
                />
              )}
              {visibility.btcReturn && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="btcReturnPercent"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="BTC收益率 (%)"
                />
              )}
              {visibility.btcdomReturn && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="btcdomReturnPercent"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                  name="BTCDOM收益率 (%)"
                  connectNulls={true}
                />
              )}
              {/* 回测收益率 - 实线部分（实盘数据开始前） */}
              {visibility.strategyReturn && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="backtestSolidPercent"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  name="BTCDOM2.0回测收益率 (%)"
                  connectNulls={false}
                />
              )}
              {/* 回测收益率 - 虚线部分（实盘数据开始后） */}
              {visibility.strategyReturn && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="backtestDashedPercent"
                  stroke="#2563eb"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="BTCDOM2.0回测收益率(虚线) (%)"
                  connectNulls={false}
                />
              )}
              {visibility.liveStrategyReturn && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="liveStrategyReturnPercent"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={false}
                  name="BTCDOM2.0实盘收益率 (%)"
                  connectNulls={true}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
