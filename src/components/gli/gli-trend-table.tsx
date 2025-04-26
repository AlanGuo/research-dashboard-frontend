'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendPeriod } from '@/types/gli';
import type { BenchmarkAsset } from '@/types/benchmark';

// K线数据接口
interface KlineDataPoint {
  timestamp: number;
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface AssetTrendData {
  id: string;
  name: string;
  symbol: string;
  category: string;
  trendPerformance: Record<string, {
    change: number;
    startPrice?: number;
    endPrice?: number;
  }>;
}

interface GliTrendTableProps {
  trendPeriods: TrendPeriod[];
}

export function GliTrendTable({ trendPeriods }: GliTrendTableProps) {
  const [assets, setAssets] = useState<BenchmarkAsset[]>([]);
  const [assetTrendData, setAssetTrendData] = useState<AssetTrendData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 获取所有对比标的
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const response = await fetch('/api/benchmark');
        if (!response.ok) {
          throw new Error('获取对比标的列表失败');
        }
        const data = await response.json();
        setAssets(data);
      } catch (err) {
        console.error('获取对比标的列表出错:', err);
        setError('无法加载对比标的列表');
      }
    };

    fetchAssets();
  }, []);

  // 获取所有资产在各趋势期间的表现数据（从后端API获取）
  useEffect(() => {
    if (assets.length === 0 || trendPeriods.length === 0) return;

    const fetchAssetTrendData = async () => {
      setLoading(true);
      try {
        // 从前端API路由获取所有资产的趋势表现数据
        const response = await fetch('/api/asset-trend');
        if (!response.ok) {
          throw new Error('获取资产趋势表现数据失败');
        }
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message || '获取资产趋势表现数据失败');
        }
        
        // 将后端数据转换为前端所需的格式
        const assetData = assets.map(asset => {
          // 查找该资产的趋势表现数据
          const assetPerformance = result.data.find((item: any) => item.assetId === asset.id);
          
          // 如果找不到该资产的数据，返回空的趋势表现
          if (!assetPerformance) {
            const emptyTrendPerformance: Record<string, { change: number }> = {};
            trendPeriods.forEach(period => {
              const periodId = `${period.startDate}_${period.endDate}`;
              emptyTrendPerformance[periodId] = { change: 0 };
            });
            
            return {
              id: asset.id,
              name: asset.name,
              symbol: asset.symbol,
              category: asset.category,
              trendPerformance: emptyTrendPerformance
            };
          }
          
          // 将后端的趋势表现数据转换为前端所需的格式
          const trendPerformance: Record<string, { change: number; startPrice?: number; endPrice?: number }> = {};
          
          // 处理每个趋势期间的数据
          assetPerformance.performances.forEach((performance: any) => {
            trendPerformance[performance.periodId] = {
              change: performance.change,
              startPrice: performance.startPrice,
              endPrice: performance.endPrice
            };
          });
          
          return {
            id: asset.id,
            name: asset.name,
            symbol: asset.symbol,
            category: asset.category,
            trendPerformance
          };
        });
        
        setAssetTrendData(assetData);
      } catch (err) {
        console.error('获取资产趋势数据出错:', err);
        setError('无法加载资产趋势数据');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAssetTrendData();
  }, [assets, trendPeriods]);

  // 格式化日期为更友好的显示
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // 格式化涨跌幅
  const formatChange = (change: number): string => {
    return change.toFixed(2) + '%';
  };

  // 获取表格单元格的样式
  const getCellStyle = (change: number) => {
    if (change > 0) {
      return 'text-green-600 font-medium';
    } else if (change < 0) {
      return 'text-red-600 font-medium';
    }
    return 'text-gray-500';
  };

  // 按类别对资产进行分组
  const assetsByCategory = assetTrendData.reduce((acc, asset) => {
    if (!acc[asset.category]) {
      acc[asset.category] = [];
    }
    acc[asset.category].push(asset);
    return acc;
  }, {} as Record<string, AssetTrendData[]>);

  // 获取分类的中文名称
  const getCategoryName = (category: string): string => {
    const categoryNames: {[key: string]: string} = {
      'crypto': '加密货币',
      'precious_metals': '贵金属',
      'commodities': '大宗商品',
      'us_indices': '美国指数',
      'bonds': '债券',
      'asia_indices': '亚洲指数',
      'europe_indices': '欧洲指数'
    };
    return categoryNames[category] || category;
  };

  // 将趋势时期按时间从新到旧排序
  const sortedTrendPeriods = [...trendPeriods].sort((a: TrendPeriod, b: TrendPeriod) => 
    new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
  );

  return (
    <div className="w-full">
      <h3 className="text-lg font-medium mb-4">资产在各趋势时期的表现</h3>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <div className="h-5 w-5 border-t-2 border-primary rounded-full animate-spin"></div>
          <p className="text-muted-foreground">数据加载中...</p>
        </div>
      ) : error ? (
        <div className="text-center text-red-500 py-4">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableCaption>各资产在GLI趋势时期的涨跌幅度</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">资产</TableHead>
                {sortedTrendPeriods.map((period) => (
                  <TableHead key={`${period.startDate}_${period.endDate}`} className="text-right">
                    <div className="flex flex-col">
                      <span className={`text-xs ${period.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                        {period.trend === 'up' ? '↑' : '↓'} {period.label || ''}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(period.startDate)} - {formatDate(period.endDate)}
                      </span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(assetsByCategory).map(([category, assets]) => (
                <React.Fragment key={category}>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={sortedTrendPeriods.length + 1} className="font-medium">
                      {getCategoryName(category)}
                    </TableCell>
                  </TableRow>
                  {assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        {asset.name} ({asset.symbol})
                      </TableCell>
                      {sortedTrendPeriods.map((period) => {
                        const periodId = `${period.startDate}_${period.endDate}`;
                        const performance = asset.trendPerformance[periodId] || { change: 0 };
                        return (
                          <TableCell 
                            key={periodId} 
                            className={`text-right ${getCellStyle(performance.change)}`}
                            title={performance.startPrice && performance.endPrice 
                              ? `起始价: ${performance.startPrice.toFixed(2)}, 结束价: ${performance.endPrice.toFixed(2)}` 
                              : '无数据'}
                          >
                            {performance.change !== 0 ? formatChange(performance.change) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
