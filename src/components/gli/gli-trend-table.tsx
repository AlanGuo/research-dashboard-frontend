'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendPeriod, BenchmarkType } from '@/types/gli';
import type { BenchmarkAsset } from '@/types/benchmark';

interface AssetTrendData {
  id: string;
  name: string;
  symbol: string;
  category: string;
  lagDays: number;
  trendPerformance: Record<string, {
    change: number;
    startPrice?: number;
    endPrice?: number;
    dataStatus?: string;
    statusMessage?: string;
  }>;
}

interface GliTrendTableProps {
  trendPeriods: TrendPeriod[];
  benchmark?: BenchmarkType; // 添加对比标的参数
  offset?: number; // 添加偏移参数
}

export function GliTrendTable({ trendPeriods, benchmark = 'none' }: GliTrendTableProps) {
  const [assets, setAssets] = useState<BenchmarkAsset[]>([]);
  const [assetTrendData, setAssetTrendData] = useState<AssetTrendData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // 不再需要计算GLI涨跌幅，直接使用后端返回的数据

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
  
  // 不再需要计算GLI涨跌幅，直接使用后端返回的数据

  // 获取资产趋势数据的函数
  const fetchAssetTrendData = async () => {
    if (assets.length === 0 || trendPeriods.length === 0) return;
    
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
        const assetPerformance = result.data.find((item: { assetId: string; performances: Array<{ periodId: string; change: number; startPrice?: number; endPrice?: number; dataStatus?: string; statusMessage?: string; }> }) => item.assetId === asset.id);
        
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
            lagDays: asset.lagDays,
            trendPerformance: emptyTrendPerformance
          };
        }
        
        // 将后端的趋势表现数据转换为前端所需的格式
        const trendPerformance: Record<string, { 
          change: number; 
          startPrice?: number; 
          endPrice?: number;
          dataStatus?: string;
          statusMessage?: string;
        }> = {};
        
        // 处理每个趋势期间的数据
        assetPerformance.performances.forEach((performance: { periodId: string; change: number; startPrice?: number; endPrice?: number; dataStatus?: string; statusMessage?: string; }) => {
          trendPerformance[performance.periodId] = {
            change: performance.change,
            startPrice: performance.startPrice,
            endPrice: performance.endPrice,
            dataStatus: performance.dataStatus,
            statusMessage: performance.statusMessage
          };
        });
        
        return {
          id: asset.id,
          name: asset.name,
          symbol: asset.symbol,
          category: asset.category,
          lagDays: asset.lagDays || (assetPerformance.lagDays ? assetPerformance.lagDays : 90), // 使用资产或者API返回的lagDays
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
  
  // 获取所有资产在各趋势期间的表现数据（从后端API获取）
  useEffect(() => {
    if (assets.length === 0 || trendPeriods.length === 0) return;
    fetchAssetTrendData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, trendPeriods]);

  // 格式化日期为更友好的显示
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
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

  // 根据对比标的过滤资产
  const filteredAssets = benchmark !== 'none'
    ? assetTrendData.filter(asset => asset.id === benchmark)
    : assetTrendData;
    
  // 按类别分组过滤后的资产
  const assetsByCategory: Record<string, AssetTrendData[]> = {};
  filteredAssets.forEach(asset => {
    if (!assetsByCategory[asset.category]) {
      assetsByCategory[asset.category] = [];
    }
    assetsByCategory[asset.category].push(asset);
  });

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

  // 将趋势时期按类型和时间排序：上涨趋势放前面，下跌趋势放后面，各自按从新到旧排序
  const sortedTrendPeriods = [...trendPeriods].sort((a: TrendPeriod, b: TrendPeriod) => {
    // 先按趋势类型排序（上涨放前面）
    if (a.trend !== b.trend) {
      return a.trend === 'up' ? -1 : 1;
    }
    
    // 同一类型内按结束日期从新到旧排序
    return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
  });

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
        <div className="overflow-x-auto max-w-[1920px] mx-auto">
          <Table className="w-auto min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] sticky left-0 bg-background z-10 shadow-sm">资产</TableHead>
                {sortedTrendPeriods.map((period) => (
                  <TableHead 
                    key={`${period.startDate}_${period.endDate}`} 
                    className="text-center p-0 overflow-hidden min-w-[120px]"
                  >
                    <div className="flex flex-col">
                      <div 
                        className={`px-4 py-2 ${period.trend === 'up' 
                          ? 'bg-green-100 dark:bg-green-900/30' 
                          : 'bg-red-100 dark:bg-red-900/30'}`}
                      >
                        <span className={`text-xs font-medium ${period.trend === 'up' 
                          ? 'text-green-800 dark:text-green-300' 
                          : 'text-red-800 dark:text-red-300'}`}
                        >
                          {formatDate(period.startDate)} {formatDate(period.endDate)}
                        </span>
                        {/* 显示GLI涨跌幅 */}
                        {period.percentChange !== undefined && (
                          <div className={`text-xs font-bold mt-1 ${period.trend === 'up' 
                            ? 'text-green-800 dark:text-green-300' 
                            : 'text-red-800 dark:text-red-300'}`}
                          >
                            {formatChange(period.percentChange)}
                          </div>
                        )}
                      </div>
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
                      <TableCell className="font-medium sticky left-0 bg-background z-10 shadow-sm whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold">{asset.name}</span>
                          <span className="text-xs text-muted-foreground">滞后{asset.lagDays}天</span>
                        </div>
                      </TableCell>
                      {sortedTrendPeriods.map((period) => {
                        const periodId = `${period.startDate}_${period.endDate}`;
                        const performance = asset.trendPerformance[periodId] || { change: 0, dataStatus: 'no_data' };
                        
                        // 根据数据状态决定显示内容
                        let displayContent = '-';
                        let tooltip = '无数据';
                        
                        if (performance.dataStatus === 'available') {
                          // 数据可用，显示涨跌幅
                          displayContent = formatChange(performance.change);
                          tooltip = performance.startPrice && performance.endPrice 
                            ? `起始价: ${performance.startPrice.toFixed(2)}, 结束价: ${performance.endPrice.toFixed(2)}` 
                            : '有数据但缺少价格详情';
                        } else if (performance.dataStatus === 'too_early') {
                          // 资产在该时间点还不存在
                          displayContent = '未上市';
                          tooltip = performance.statusMessage || '该资产在此时间段还未存在';
                        } else if (performance.dataStatus === 'rate_limited') {
                          // 请求被限流
                          displayContent = '请求限流';
                          tooltip = performance.statusMessage || '获取数据时请求被限流';
                        }
                        
                        return (
                          <TableCell 
                            key={periodId} 
                            className={`text-center ${getCellStyle(performance.change)}`}
                            title={tooltip}
                          >
                            {displayContent}
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
