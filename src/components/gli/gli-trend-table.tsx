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
  trendPeriods: {
    centralBankTrendPeriods: TrendPeriod[];
    m2TrendPeriods: TrendPeriod[];
  };
  benchmark?: BenchmarkType; // 添加对比标的参数
  offset?: number; // 添加偏移参数
}

export function GliTrendTable({ trendPeriods }: GliTrendTableProps) {
  const [assets, setAssets] = useState<BenchmarkAsset[]>([]);
  const [centralBankTrendData, setCentralBankTrendData] = useState<AssetTrendData[]>([]);
  const [m2TrendData, setM2TrendData] = useState<AssetTrendData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchAssetTrendData = async () => {
    if (assets.length === 0 || 
        (trendPeriods.centralBankTrendPeriods.length === 0 && trendPeriods.m2TrendPeriods.length === 0)) return;
    
    setLoading(true);
    try {
      const centralBankResponse = await fetch('/api/asset-trend?trendType=centralBank');
      if (!centralBankResponse.ok) {
        throw new Error('获取资产央行趋势表现数据失败');
      }
      
      const centralBankResult = await centralBankResponse.json();
      
      if (!centralBankResult.success) {
        throw new Error(centralBankResult.message || '获取资产央行趋势表现数据失败');
      }
      
      const m2Response = await fetch('/api/asset-trend?trendType=m2');
      if (!m2Response.ok) {
        throw new Error('获取资产M2趋势表现数据失败');
      }
      
      const m2Result = await m2Response.json();
      
      if (!m2Result.success) {
        throw new Error(m2Result.message || '获取资产M2趋势表现数据失败');
      }
      
      const centralBankAssetData = assets.map(asset => {
        const assetPerformance = centralBankResult.data.find((item: { assetId: string; performances: Array<{ periodId: string; change: number; startPrice?: number; endPrice?: number; dataStatus?: string; statusMessage?: string; }> }) => item.assetId === asset.id);
        
        if (!assetPerformance) {
          const emptyTrendPerformance: Record<string, { change: number }> = {};
          
          trendPeriods.centralBankTrendPeriods.forEach(period => {
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
        
        const trendPerformance: Record<string, { 
          change: number; 
          startPrice?: number; 
          endPrice?: number;
          dataStatus?: string;
          statusMessage?: string;
        }> = {};
        
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
          lagDays: asset.lagDays || (assetPerformance.lagDays ? assetPerformance.lagDays : 90), 
          trendPerformance
        };
      });
      
      const m2AssetData = assets.map(asset => {
        const assetPerformance = m2Result.data.find((item: { assetId: string; performances: Array<{ periodId: string; change: number; startPrice?: number; endPrice?: number; dataStatus?: string; statusMessage?: string; }> }) => item.assetId === asset.id);
        
        if (!assetPerformance) {
          const emptyTrendPerformance: Record<string, { change: number }> = {};
          
          trendPeriods.m2TrendPeriods.forEach(period => {
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
        
        const trendPerformance: Record<string, { 
          change: number; 
          startPrice?: number; 
          endPrice?: number;
          dataStatus?: string;
          statusMessage?: string;
        }> = {};
        
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
          lagDays: asset.lagDays || (assetPerformance.lagDays ? assetPerformance.lagDays : 90), 
          trendPerformance
        };
      });
      
      setCentralBankTrendData(centralBankAssetData);
      setM2TrendData(m2AssetData);
    } catch (err) {
      console.error('获取资产趋势数据出错:', err);
      setError('无法加载资产趋势数据');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (assets.length === 0 || 
        (trendPeriods.centralBankTrendPeriods.length === 0 && trendPeriods.m2TrendPeriods.length === 0)) return;
    fetchAssetTrendData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, trendPeriods]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
  };

  const formatChange = (change: number): string => {
    return change.toFixed(2) + '%';
  };

  const getCellStyle = (change: number) => {
    if (change > 0) {
      return 'text-green-600 font-medium';
    } else if (change < 0) {
      return 'text-red-600 font-medium';
    }
    return 'text-gray-500';
  };
    
  const centralBankAssetsByCategory: Record<string, AssetTrendData[]> = {};
    centralBankTrendData.forEach(asset => {
    if (!centralBankAssetsByCategory[asset.category]) {
      centralBankAssetsByCategory[asset.category] = [];
    }
    centralBankAssetsByCategory[asset.category].push(asset);
  });
  
  const m2AssetsByCategory: Record<string, AssetTrendData[]> = {};
    m2TrendData.forEach(asset => {
    if (!m2AssetsByCategory[asset.category]) {
      m2AssetsByCategory[asset.category] = [];
    }
    m2AssetsByCategory[asset.category].push(asset);
  });

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

  const sortedCentralBankTrendPeriods = [...trendPeriods.centralBankTrendPeriods].sort((a: TrendPeriod, b: TrendPeriod) => {
    if (a.trend !== b.trend) {
      return a.trend === 'up' ? -1 : 1;
    }
    
    return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
  });
  
  const sortedM2TrendPeriods = [...trendPeriods.m2TrendPeriods].sort((a: TrendPeriod, b: TrendPeriod) => {
    if (a.trend !== b.trend) {
      return a.trend === 'up' ? -1 : 1;
    }
    
    return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
  });

  return (
    <div className="w-full">
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4">央行总负债趋势期间资产表现</h3>
        
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
                  {sortedCentralBankTrendPeriods.map((period) => (
                    <TableHead 
                      key={`cb_${period.startDate}_${period.endDate}`} 
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
                            {formatDate(period.startDate)} - {formatDate(period.endDate)}
                          </span>
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
                {Object.entries(centralBankAssetsByCategory).map(([category, assets]) => (
                  <React.Fragment key={`cb_${category}`}>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={sortedCentralBankTrendPeriods.length + 1} className="font-medium">
                        {getCategoryName(category)}
                      </TableCell>
                    </TableRow>
                    {assets.map((asset) => (
                      <TableRow key={`cb_${asset.id}`}>
                        <TableCell className="font-medium sticky left-0 bg-background z-10 shadow-sm whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-semibold">{asset.name}</span>
                            <span className="text-xs text-muted-foreground">滞后{asset.lagDays}天</span>
                          </div>
                        </TableCell>
                        {sortedCentralBankTrendPeriods.map((period) => {
                          const periodId = `${period.startDate}_${period.endDate}`;
                          const performance = asset.trendPerformance[periodId] || { change: 0, dataStatus: 'no_data' };
                          
                          let displayContent = '-';
                          let tooltip = '无数据';
                          
                          if (performance.dataStatus === 'available') {
                            displayContent = formatChange(performance.change);
                            tooltip = performance.startPrice && performance.endPrice 
                              ? `起始价: ${performance.startPrice.toFixed(2)}, 结束价: ${performance.endPrice.toFixed(2)}` 
                              : '有数据但缺少价格详情';
                          } else if (performance.dataStatus === 'too_early') {
                            displayContent = '未上市';
                            tooltip = performance.statusMessage || '该资产在此时间段还未存在';
                          } else if (performance.dataStatus === 'rate_limited') {
                            displayContent = '请求限流';
                            tooltip = performance.statusMessage || '获取数据时请求被限流';
                          }
                          
                          return (
                            <TableCell 
                              key={`cb_${periodId}`} 
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

      <div className="mt-12">
        <h3 className="text-lg font-medium mb-4">M2总量趋势期间资产表现</h3>
        
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
                  {sortedM2TrendPeriods.map((period) => (
                    <TableHead 
                      key={`m2_${period.startDate}_${period.endDate}`} 
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
                            {formatDate(period.startDate)} - {formatDate(period.endDate)}
                          </span>
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
                {Object.entries(m2AssetsByCategory).map(([category, assets]) => (
                  <React.Fragment key={`m2_${category}`}>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={sortedM2TrendPeriods.length + 1} className="font-medium">
                        {getCategoryName(category)}
                      </TableCell>
                    </TableRow>
                    {assets.map((asset) => (
                      <TableRow key={`m2_${asset.id}`}>
                        <TableCell className="font-medium sticky left-0 bg-background z-10 shadow-sm whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-semibold">{asset.name}</span>
                            <span className="text-xs text-muted-foreground">滞后{asset.lagDays}天</span>
                          </div>
                        </TableCell>
                        {sortedM2TrendPeriods.map((period) => {
                          const periodId = `${period.startDate}_${period.endDate}`;
                          const performance = asset.trendPerformance[periodId] || { change: 0, dataStatus: 'no_data' };
                          
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
                              key={`m2_${periodId}`} 
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
    </div>
  );
}
