'use client';

import { useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { GliDataPoint } from '@/types/gli';

interface GliChartProps {
  data: GliDataPoint[];
}

export function GliChart({ data }: GliChartProps) {
  // 准备图表数据
  const chartData = useMemo(() => {
    // 确保数据是按时间排序的（从旧到新，因为图表通常从左到右显示）
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    
    // 提取总值
    const totalValues = sortedData.map(d => d.total);
    const trillion = 1000000000000;
    // 创建图表数据
    return sortedData.map((d, index) => ({
      date: new Date(d.timestamp).toLocaleDateString(),
      total: d.total,
      fed: d.fed ? d.fed / trillion : undefined, // 转换为万亿
      ecb: d.ecb ? d.ecb / trillion : undefined,
      pbc: d.pbc ? d.pbc / trillion : undefined,
      boj: d.boj ? d.boj / trillion : undefined,
    }));
  }, [data]);

  if (data.length === 0) {
    return <div className="text-center p-4">No data available</div>;
  }

  return (
    <div className="w-full h-[500px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          stackOffset="expand"
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => value}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
            domain={[0, 1]}
          />
          <Tooltip 
            formatter={(value: number, name: string) => {
              // 对于百分比值
              if (name === 'fed' || name === 'ecb' || name === 'pbc' || name === 'boj') {
                return [`${(value * 100).toFixed(2)}%`, name.toUpperCase()];
              }
              // 对于总值
              return [`${value.toFixed(2)} T`, name];
            }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend />
          
          {chartData[0]?.fed !== undefined && (
            <Area 
              type="monotone" 
              dataKey="fed" 
              stackId="1"
              stroke="#ff7300" 
              fill="#ff7300" 
              name="FED"
            />
          )}
          {chartData[0]?.ecb !== undefined && (
            <Area 
              type="monotone" 
              dataKey="ecb" 
              stackId="1"
              stroke="#0088fe" 
              fill="#0088fe" 
              name="ECB"
            />
          )}
          {chartData[0]?.pbc !== undefined && (
            <Area 
              type="monotone" 
              dataKey="pbc" 
              stackId="1"
              stroke="#00c49f" 
              fill="#00c49f" 
              name="PBC"
            />
          )}
          {chartData[0]?.boj !== undefined && (
            <Area 
              type="monotone" 
              dataKey="boj" 
              stackId="1"
              stroke="#ff8042" 
              fill="#ff8042" 
              name="BOJ"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
