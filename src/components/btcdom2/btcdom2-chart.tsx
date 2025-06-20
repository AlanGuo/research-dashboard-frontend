'use client';

import { useMemo, useState } from 'react';
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

// 扩展的图表数据类型，包含处理后的字段
interface ProcessedChartData extends BTCDOM2ChartData {
  date: string;
  totalReturnPercent: number;
  btcReturnPercent: number;
  btcdomReturnPercent: number | null;
  drawdownPercent: number;
  totalValueK: number;
}

interface BTCDOM2ChartProps {
  data: BTCDOM2ChartData[];
  params?: BTCDOM2StrategyParams;
}

export function BTCDOM2Chart({ data, params }: BTCDOM2ChartProps) {
  // 图表可见性状态
  const [visibility, setVisibility] = useState({
    btcPrice: true,
    btcReturn: true,
    btcdomReturn: true,
    strategyReturn: true
  });

  // 切换曲线可见性
  const toggleVisibility = (key: keyof typeof visibility) => {
    setVisibility(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // 处理图表数据
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // 计算BTC和BTCDOM收益率（相对于初始价格）
    const initialBtcPrice = data.length > 0 && data[0].btcPrice ? data[0].btcPrice : null;
    const initialBtcdomPrice = data.length > 0 && data[0].btcdomPrice ? data[0].btcdomPrice : null;
    
    const processedData = data.map(point => {
      // 计算BTC收益率
      let btcReturnPercent = 0;
      if (initialBtcPrice && point.btcPrice) {
        btcReturnPercent = ((point.btcPrice - initialBtcPrice) / initialBtcPrice) * 100;
      }
      
      // 计算BTCDOM收益率
      let btcdomReturnPercent = null;
      if (initialBtcdomPrice && point.btcdomPrice) {
        btcdomReturnPercent = ((point.btcdomPrice - initialBtcdomPrice) / initialBtcdomPrice) * 100;
      }
      
      return {
        ...point,
        date: new Date(point.timestamp).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          timeZone: 'UTC'
        }),
        totalReturnPercent: (point.totalReturn * 100),
        btcReturnPercent,
        btcdomReturnPercent,
        drawdownPercent: (point.drawdown * 100),
        totalValueK: point.totalValue / 1000, // 转换为千为单位
      };
    });
    
    return processedData;
  }, [data]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: { 
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
            {label}
          </p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-6">
              <span className="text-gray-600 dark:text-gray-400">策略总资产:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                ${data.totalValue.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-600 dark:text-gray-400">BTCDOM2.0收益率:</span>
              <span className={`font-medium ${data.totalReturnPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {data.totalReturnPercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-600 dark:text-gray-400">BTC收益率:</span>
              <span className={`font-medium ${data.btcReturnPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {data.btcReturnPercent.toFixed(2)}%
              </span>
            </div>
            {data.btcdomReturnPercent !== null && (
              <div className="flex justify-between gap-6">
                <span className="text-gray-600 dark:text-gray-400">BTCDOM收益率:</span>
                <span className={`font-medium ${data.btcdomReturnPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {data.btcdomReturnPercent.toFixed(2)}%
                </span>
              </div>
            )}
            <div className="flex justify-between gap-6">
              <span className="text-gray-600 dark:text-gray-400">BTC价格:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                ${data.btcPrice.toLocaleString()}
              </span>
            </div>
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

  // 自定义AreaChart Tooltip
  const CustomAreaTooltip = ({ active, payload, label }: { 
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
            {label}
          </p>
          <div className="space-y-1.5 text-sm">
            {payload.map((entry, index) => (
              <div key={index} className="flex justify-between gap-6">
                <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.name}:
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  ${(entry.value * 1000).toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex justify-between gap-6 pt-1 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">总资产:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                ${data.totalValue.toLocaleString()}
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
    <div className="space-y-2">
      {/* BTC价格与策略收益对比 */}
      <div>
        <h4 className="text-lg font-medium mb-4">BTC价格与收益率对比</h4>
        
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
              BTCDOM2.0收益率 (%)
            </span>
          </div>
        </div>
        
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
                  connectNulls={false}
                />
              )}
              {visibility.strategyReturn && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="totalReturnPercent"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  name="BTCDOM2.0收益率 (%)"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 资产配置变化 */}
      <div>
        <h4 className="font-medium mb-4 text-gray-900 dark:text-gray-100">资产配置变化</h4>
        <div className="h-50">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="rgba(156, 163, 175, 0.3)"
              />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: 'rgba(107, 114, 128, 0.8)' }}
                stroke="rgba(107, 114, 128, 0.8)"
                tickFormatter={(value) => value}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'rgba(107, 114, 128, 0.8)' }}
                stroke="rgba(107, 114, 128, 0.8)"
                label={{ 
                  value: '资产价值 (千美元)', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fill: 'rgba(107, 114, 128, 0.8)' }
                }}
              />
              <Tooltip content={<CustomAreaTooltip />} />
              <Legend 
                wrapperStyle={{
                  color: 'hsl(var(--muted-foreground))'
                }}
              />
              
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