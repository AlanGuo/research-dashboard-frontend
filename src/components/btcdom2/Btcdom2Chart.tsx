'use client';

import { useMemo, useState } from 'react';
import { 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  ResponsiveContainer,
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

export function BTCDOM2Chart({ data }: BTCDOM2ChartProps) {
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
    
    const processedData = data.map(point => {
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
            {data.btcdomReturnPercent !== null && (
              <div className="flex justify-between gap-6">
                <span className="text-gray-600 dark:text-gray-400">BTCDOM收益率:</span>
                <span className={`font-medium ${data.btcdomReturnPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {data.btcdomReturnPercent.toFixed(2)}%
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
            {data.btcdomPrice && data.btcdomPrice > 0 && (
              <div className="flex justify-between gap-6">
                <span className="text-gray-600 dark:text-gray-400">BTCDOM价格:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  ${data.btcdomPrice.toLocaleString()}
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
                  connectNulls={true}
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
    </div>
  );
}