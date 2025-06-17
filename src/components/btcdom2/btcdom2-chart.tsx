'use client';

import { useMemo } from 'react';
import { 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';
import { BTCDOM2ChartData, BTCDOM2StrategyParams } from '@/types/btcdom2';

interface TooltipPayload {
  payload: {
    date: string;
    totalValue: number;
    totalReturnPercent: number;
    btcReturnPercent: number; // 新增BTC收益率
    btcPrice: number;
    isActive: boolean;
  };
}

interface BTCDOM2ChartProps {
  data: BTCDOM2ChartData[];
  params?: BTCDOM2StrategyParams;
}

export function BTCDOM2Chart({ data, params }: BTCDOM2ChartProps) {
  // 处理图表数据
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const processedData = data.map(point => ({
      ...point,
      date: new Date(point.timestamp).toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        timeZone: 'UTC'
      }),
      totalReturnPercent: (point.totalReturn * 100),
      btcReturnPercent: ((point.btcReturn || 0) * 100), // 新增BTC收益率百分比，处理undefined情况
      drawdownPercent: (point.drawdown * 100),
      totalValueK: point.totalValue / 1000, // 转换为千为单位
    }));
    
    // 添加调试信息
    console.log('Chart Data Debug:', {
      dataLength: data.length,
      firstPoint: data[0],
      lastPoint: data[data.length - 1],
      sampleProcessedData: processedData.slice(0, 3),
      btcReturnRange: {
        min: Math.min(...processedData.map(p => p.btcReturnPercent)),
        max: Math.max(...processedData.map(p => p.btcReturnPercent))
      }
    });
    
    return processedData;
  }, [data]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span>总资产:</span>
              <span className="font-medium">${data.totalValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>策略收益率:</span>
              <span className={`font-medium ${data.totalReturnPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.totalReturnPercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>BTC收益率:</span>
              <span className={`font-medium ${(data.btcReturnPercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(data.btcReturnPercent || 0).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>BTC价格:</span>
              <span className="font-medium">${data.btcPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>策略状态:</span>
              <span className={`font-medium ${data.isActive ? 'text-green-600' : 'text-gray-500'}`}>
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
          <p className="text-sm text-muted-foreground mt-1">请执行回测以生成图表数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BTC价格与策略收益对比 */}
      <div>
        <h4 className="text-lg font-medium mb-4">BTC价格与收益率对比</h4>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                stroke="#666"
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
              <Legend />
              
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="btcPrice"
                stroke="#f7931a"
                strokeWidth={2}
                dot={false}
                name="BTC价格 ($)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalReturnPercent"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                name="策略收益率 (%)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="btcReturnPercent"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
                name="BTC收益率 (%)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 资产配置变化 */}
      <div>
        <h4 className="text-lg font-medium mb-4">资产配置变化</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#666"
                label={{ value: '资产价值 (千美元)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  `$${(value * 1000).toLocaleString()}`, 
                  name
                ]}
              />
              <Legend />
              
              <Area
                type="monotone"
                dataKey="cashValue"
                stackId="1"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.6}
                name="现金"
              />
              {/* 只在选择做多BTC时显示BTC持仓 */}
              {(!params || params.longBtc) && (
                <Area
                  type="monotone"
                  dataKey="btcValue"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.6}
                  name="BTC持仓"
                />
              )}
              {/* 只在选择做空ALT时显示做空持仓 */}
              {(!params || params.shortAlt) && (
                <Area
                  type="monotone"
                  dataKey="shortValue"
                  stackId="1"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.6}
                  name="做空持仓"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}