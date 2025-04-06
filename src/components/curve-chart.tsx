"use client"

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// 图表数据类型
interface ChartDataPoint {
  date: string;
  fundReturnPct: number; // 策略收益百分比，已考虑出入金影响
  fundReturn: number;    // 总市值（包含初始本金、出入金和盈亏）
  [key: string]: string | number; // 动态比较资产数据
}

interface CurveChartProps {
  chartData: ChartDataPoint[];
  chartMode: 'percentage' | 'absolute';
  setChartMode: (mode: 'percentage' | 'absolute') => void;
  comparisonAssets: string[];
  selectedComparisonAsset: string;
  setSelectedComparisonAsset: (asset: string) => void;
  visibleLines: Record<string, boolean>;
  setVisibleLines: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const CurveChart: React.FC<CurveChartProps> = ({
  chartData,
  chartMode,
  setChartMode,
  comparisonAssets,
  selectedComparisonAsset,
  setSelectedComparisonAsset,
  visibleLines,
  setVisibleLines
}) => {
  return (
    <Card className="animate-in fade-in duration-700">
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
          <CardTitle className="text-lg">收益曲线</CardTitle>
        </div>
        <div>
          <Tabs value={chartMode} onValueChange={(value) => setChartMode(value as 'percentage' | 'absolute')}>
            <TabsList>
              <TabsTrigger value="percentage">收益率</TabsTrigger>
              <TabsTrigger value="absolute">绝对收益</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      {chartMode === 'absolute' && comparisonAssets.length > 1 && (
        <div className="flex justify-end p-4 pt-3">
          <Select
            value={selectedComparisonAsset}
            onValueChange={setSelectedComparisonAsset}
          >
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue placeholder="选择资产" />
            </SelectTrigger>
            <SelectContent>
              {comparisonAssets.map(asset => (
                <SelectItem key={asset} value={asset}>{asset}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <CardContent className="px-0 pb-2 md:px-4 md:pb-4">
        <div className="h-60 sm:h-72 md:h-80">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" />
              {/* 百分比模式下的Y轴 */}
              {chartMode === 'percentage' && 
                <YAxis 
                  yAxisId="main" 
                  stroke="var(--foreground)" 
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                />
              }
              
              {/* 绝对值模式下的左侧Y轴（策略收益） */}
              {chartMode === 'absolute' && 
                <YAxis 
                  yAxisId="left" 
                  orientation="left"
                  stroke="#e11d48" /* 使用固定的红色 */
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
              }
              
              {/* 绝对值模式下的右侧Y轴（比较资产价格） */}
              {chartMode === 'absolute' && selectedComparisonAsset && 
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  stroke="var(--chart-2)" 
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
              }
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--card-foreground)",
                  fontSize: '12px',
                  padding: '8px'
                }}
                labelFormatter={(label) => `日期: ${label}`}
                formatter={(value, name) => {
                  const numValue = Number(value);
                  if (chartMode === 'percentage') {
                    if (name === "策略收益率") {
                      return [`${numValue.toFixed(1)}%`, "策略收益率"];
                    }
                    
                    // 处理比较资产的百分比
                    for (const asset of comparisonAssets) {
                      if (name === `${asset}涨跌幅`) {
                        return [`${numValue.toFixed(1)}%`, `${asset}涨跌幅`];
                      }
                    }
                  } else {
                    // 绝对值模式
                    if (name === "策略收益") {
                      return [`$${numValue.toLocaleString()}`, "策略市值"];
                    }
                    
                    // 处理比较资产的绝对值
                    for (const asset of comparisonAssets) {
                      if (name === `${asset}价格`) {
                        return [`$${numValue.toLocaleString()}`, `${asset}价格`];
                      }
                    }
                  }
                  return [value, name];
                }}
              />
              <Legend 
                onClick={(e) => {
                  // 处理图例点击事件
                  const dataKey = e.dataKey as string;
                  if (dataKey in visibleLines) {
                    setVisibleLines(prev => ({
                      ...prev,
                      [dataKey]: !prev[dataKey]
                    }));
                  }
                }}
                wrapperStyle={{ cursor: 'pointer', fontSize: '12px', marginTop: '4px' }}
                payload={
                  (() => {
                    // 创建图例数组
                    const legendItems = [];
                    
                    // 添加策略收益图例
                    if (chartMode === 'percentage') {
                      legendItems.push({ 
                        value: '策略收益率', 
                        type: 'line' as const, 
                        color: '#e11d48', 
                        dataKey: 'fundReturnPct', 
                        inactive: !visibleLines.fundReturnPct 
                      });
                      
                      // 添加比较资产的百分比图例
                      comparisonAssets.forEach((asset, index) => {
                        const assetKey = asset.toLowerCase();
                        const colorIndex = (index % 4) + 2; // 使用不同的颜色
                        const dataKey = `${assetKey}PricePct`;
                        
                        legendItems.push({
                          value: `${asset}涨跌幅`,
                          type: 'line' as const,
                          color: `var(--chart-${colorIndex})`,
                          dataKey: dataKey,
                          inactive: !visibleLines[dataKey]
                        });
                      });
                    } else {
                      legendItems.push({ 
                        value: '策略市值', 
                        type: 'line' as const, 
                        color: '#e11d48', 
                        dataKey: 'fundReturn', 
                        inactive: !visibleLines.fundReturn 
                      });
                      
                      // 绝对值模式下只添加选中的比较资产图例
                      if (selectedComparisonAsset) {
                        const asset = selectedComparisonAsset;
                        const assetKey = asset.toLowerCase();
                        const dataKey = `${assetKey}Price`;
                        
                        legendItems.push({
                          value: `${asset}价格`,
                          type: 'line' as const,
                          color: 'var(--chart-2)',
                          dataKey: dataKey,
                          inactive: !visibleLines[dataKey]
                        });
                      }
                    }
                    
                    return legendItems;
                  })()
                }
              />
              {/* 百分比模式 - 策略收益率 (固定使用红色) */}
              {chartMode === 'percentage' && 
                <Line
                  yAxisId="main"
                  type="monotone"
                  dataKey="fundReturnPct"
                  name="策略收益率"
                  stroke="#e11d48" /* 使用固定的红色 */
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 8 }}
                  hide={!visibleLines.fundReturnPct}
                />
              }
              
              {/* 百分比模式 - 比较资产涨跌幅 */}
              {chartMode === 'percentage' && comparisonAssets.map((asset, index) => {
                const assetKey = asset.toLowerCase();
                const colorIndex = (index % 4) + 2; // 使用不同的颜色
                const dataKey = `${assetKey}PricePct`;
                
                return (
                  <Line
                    key={dataKey}
                    yAxisId="main"
                    type="monotone"
                    dataKey={dataKey}
                    name={`${asset}涨跌幅`}
                    stroke={`var(--chart-${colorIndex})`}
                    dot={false}
                    activeDot={{ r: 6 }}
                    strokeWidth={2}
                    hide={!visibleLines[dataKey]}
                  />
                );
              })}
              
              {/* 绝对值模式 - 策略收益 (固定使用红色) */}
              {chartMode === 'absolute' && 
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="fundReturn"
                  name="策略收益"
                  stroke="#e11d48" /* 使用固定的红色 */
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 8 }}
                  hide={!visibleLines.fundReturn}
                />
              }
              
              {/* 绝对值模式 - 比较资产价格（只显示选中的一个） */}
              {chartMode === 'absolute' && selectedComparisonAsset && (() => {
                const asset = selectedComparisonAsset;
                const assetKey = asset.toLowerCase();
                const dataKey = `${assetKey}Price`;
                
                return (
                  <Line
                    key={dataKey}
                    yAxisId="right"
                    type="monotone"
                    dataKey={dataKey}
                    name={`${asset}价格`}
                    stroke="var(--chart-2)"
                    dot={false}
                    activeDot={{ r: 6 }}
                    strokeWidth={2}
                    hide={!visibleLines[dataKey]}
                  />
                );
              })()}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">暂无图表数据</p>
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  );
};
