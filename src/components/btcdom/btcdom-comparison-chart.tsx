'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartDataPoint } from '@/types/btcdom';
import { formatDate, formatPercentage } from '@/lib/btcdom-utils';

interface BtcDomComparisonChartProps {
  data: ChartDataPoint[];
  loading: boolean;
}

export function BtcDomComparisonChart({
  data,
  loading
}: BtcDomComparisonChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    return data.map(item => ({
      date: formatDate(item.date),
      openDate: item.openDate ? formatDate(item.openDate) : '',
      closeDate: item.closeDate ? formatDate(item.closeDate) : '',
      strategyReturn: item.strategyReturn,
      binanceReturn: item.binanceReturn,
      // 格式化后的值用于tooltip显示
      strategyReturnFormatted: item.strategyReturn !== null 
        ? formatPercentage(item.strategyReturn) 
        : 'N/A',
      binanceReturnFormatted: item.binanceReturn !== null 
        ? formatPercentage(item.binanceReturn) 
        : 'N/A',
    }));
  }, [data]);

  // 计算Y轴范围
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return ['auto', 'auto'];
    
    const validValues = chartData.reduce<number[]>((acc, item) => {
      if (item.strategyReturn !== null) acc.push(item.strategyReturn);
      if (item.binanceReturn !== null) acc.push(item.binanceReturn);
      return acc;
    }, []);
    
    if (validValues.length === 0) return ['auto', 'auto'];
    
    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    const range = max - min;
    const padding = range * 0.1; // 10% padding
    
    return [
      Math.floor((min - padding) / 5) * 5, // 向下取整到5的倍数
      Math.ceil((max + padding) / 5) * 5   // 向上取整到5的倍数
    ];
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{
      color: string;
      name: string;
      dataKey: string;
      payload: Record<string, unknown>;
    }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const firstPayload = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium text-foreground mb-1">交易周期</p>
          <p className="text-sm text-muted-foreground mb-2">
            {firstPayload.openDate && firstPayload.closeDate 
              ? `${firstPayload.openDate} 至 ${firstPayload.closeDate}`
              : label}
          </p>
          {payload.map((entry, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${entry.payload[`${entry.dataKey}Formatted`]}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>累计收益率对比</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="h-5 w-5 border-t-2 border-primary rounded-full animate-spin"></div>
            <span className="ml-2 text-muted-foreground">图表加载中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>累计收益率对比</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">暂无数据可展示</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>累计收益率对比</span>
          <div className="text-sm text-muted-foreground">
            {data.length} 个交易周期
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 20,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                interval="preserveStartEnd"
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                domain={yAxisDomain}
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                tickFormatter={(value) => `${value.toFixed(1)}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              
              {/* 自制BTCDOM策略线 */}
              <Line
                type="monotone"
                dataKey="strategyReturn"
                stroke="rgb(59, 130, 246)"
                strokeWidth={3}
                dot={{ 
                  fill: 'rgb(59, 130, 246)', 
                  strokeWidth: 2, 
                  r: 4 
                }}
                name="自制BTCDOM策略"
                connectNulls={false}
                activeDot={{ 
                  r: 6, 
                  fill: 'rgb(59, 130, 246)',
                  stroke: 'white',
                  strokeWidth: 2
                }}
              />
              
              {/* 币安BTCDOM合约线 */}
              <Line
                type="monotone"
                dataKey="binanceReturn"
                stroke="rgb(249, 115, 22)"
                strokeWidth={3}
                dot={{ 
                  fill: 'rgb(249, 115, 22)', 
                  strokeWidth: 2, 
                  r: 4 
                }}
                name="币安BTCDOM合约"
                connectNulls={false}
                activeDot={{ 
                  r: 6, 
                  fill: 'rgb(249, 115, 22)',
                  stroke: 'white',
                  strokeWidth: 2
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* 图表说明 */}
        <div className="mt-4 text-xs text-muted-foreground space-y-1">
          <p>• 图表展示基于交易记录的累计收益率对比</p>
          <p>• 蓝色线条：自制BTCDOM策略的累计收益率</p>
          <p>• 橙色线条：币安BTCDOM合约在相同时间段的累计收益率</p>
          <p>• 数据点对应每次交易的平仓日期</p>
        </div>

        {/* 快速统计 */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-muted-foreground">策略最终收益</div>
              <div className={`font-semibold text-lg ${
                (chartData[chartData.length - 1]?.strategyReturn ?? 0) >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {chartData[chartData.length - 1]?.strategyReturn !== null
                  ? formatPercentage(chartData[chartData.length - 1]?.strategyReturn ?? 0)
                  : 'N/A'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">币安最终收益</div>
              <div className={`font-semibold text-lg ${
                (chartData[chartData.length - 1]?.binanceReturn ?? 0) >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {chartData[chartData.length - 1]?.binanceReturn !== null
                  ? formatPercentage(chartData[chartData.length - 1]?.binanceReturn ?? 0)
                  : 'N/A'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">策略最高收益</div>
              <div className="font-semibold text-lg text-green-600 dark:text-green-400">
                {(() => {
                  const strategyReturns = chartData
                    .map(d => d.strategyReturn)
                    .filter(r => r !== null) as number[];
                  return strategyReturns.length > 0 
                    ? formatPercentage(Math.max(...strategyReturns))
                    : 'N/A';
                })()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">策略最大回撤</div>
              <div className="font-semibold text-lg text-red-600 dark:text-red-400">
                {(() => {
                  const strategyReturns = chartData
                    .map(d => d.strategyReturn)
                    .filter(r => r !== null) as number[];
                  if (strategyReturns.length === 0) return 'N/A';
                  
                  let maxDrawdown = 0;
                  let peak = strategyReturns[0];
                  
                  for (const ret of strategyReturns) {
                    if (ret > peak) peak = ret;
                    const drawdown = peak - ret;
                    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
                  }
                  
                  return formatPercentage(-maxDrawdown);
                })()}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}