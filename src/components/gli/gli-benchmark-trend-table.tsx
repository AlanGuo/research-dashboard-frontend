'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  intervalType?: string; // 时间间隔类型
  trendPerformance: Record<string, {
    change: number;
    startPrice?: number;
    endPrice?: number;
    dataStatus?: string;
    statusMessage?: string;
  }>;
}

interface GliBenchmarkTrendTableProps {
  trendPeriods: TrendPeriod[];
  benchmark: BenchmarkType | 'none'; // 对比标的，包含'none'值
  offset?: number; // 滞后天数
  interval?: string; // 时间间隔类型：1D（1天）、1W（1周）、1M（1月）
}

// 缓存对比标的详情数据，避免重复请求
// 使用组件外部的变量来缓存数据，这样即使组件重新渲染也不会丢失缓存
// key是benchmark ID，value是对应的BenchmarkAsset对象
const benchmarkCache: Record<string, BenchmarkAsset> = {};

export function GliBenchmarkTrendTable({ trendPeriods, benchmark, offset = 0, interval = '1W' }: GliBenchmarkTrendTableProps) {
  const [benchmarkData, setBenchmarkData] = useState<AssetTrendData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [, setUpdatingTrend] = useState<boolean>(false); // 仅更新趋势数据时的状态
  
  // 记录当前正在请求的benchmark ID，避免重复请求
  const fetchingRef = useRef<string | null>(null);
  
  // 记录上一次的benchmark和offset值，用于决定是完全重新加载还是仅更新趋势数据
  const prevBenchmarkRef = useRef<string | null>(null);
  const prevOffsetRef = useRef<number | null>(null);
  const prevIntervalRef = useRef<string | null>(null);

  // 使用 useRef 来跟踪是否已经加载过对比标的数据
  const initialLoadDone = useRef(false);
  
  // 获取对比标的数据
  useEffect(() => {
    // 如果没有选择对比标，则不进行任何操作
    if (benchmark === 'none') {
      setBenchmarkData(null);
      setLoading(false);
      setUpdatingTrend(false);
      return;
    }
    
    // 如果是首次加载且没有趋势期间数据，则等待趋势期间数据加载完成
    if (!initialLoadDone.current && trendPeriods.length === 0) {
      console.log('等待趋势期间数据加载完成...');
      return;
    }
    
    const fetchBenchmarkData = async () => {
      // 确保 benchmark 是字符串且非 undefined
      const benchmarkId = benchmark as string;
      
      // 判断是否只是参数变化（offset或interval），而不是benchmark变化
      const isSameBenchmark = prevBenchmarkRef.current === benchmarkId;
      const isParamChange = isSameBenchmark && (prevOffsetRef.current !== offset || prevIntervalRef.current !== interval);
      
      // 更新当前值为下次比较的基准
      prevBenchmarkRef.current = benchmarkId;
      prevOffsetRef.current = offset;
      prevIntervalRef.current = interval;
      
      // 如果只是参数变化，且已有数据，则只更新趋势数据，不显示全屏加载状态
      if (isParamChange && benchmarkData) {
        setUpdatingTrend(true); // 设置仅更新趋势数据的状态
      } else {
        setLoading(true); // 完全加载状态
      }
      
      try {
        // 从缓存中获取对比标的详情，如果没有则请求API
        let benchmarkInfo: BenchmarkAsset;
        
        // 如果只是参数变化，且已有缓存的数据，则直接使用缓存
        if (benchmarkId && benchmarkCache[benchmarkId]) {
          // 使用缓存的数据
          benchmarkInfo = benchmarkCache[benchmarkId];
          console.log(`使用缓存的对比标数据: ${benchmarkId}`);
        } else if (fetchingRef.current === benchmarkId) {
          // 如果正在请求相同的benchmark，等待一下再重试
          console.log(`正在请求对比标数据: ${benchmarkId}，稍后重试`);
          setTimeout(() => fetchBenchmarkData(), 100);
          return;
        } else {
          // 记录当前正在请求的benchmark
          fetchingRef.current = benchmarkId;
          
          // 请求API获取数据
          console.log(`请求对比标详情: ${benchmarkId}`);
          const benchmarkResponse = await fetch(`/api/benchmark/${benchmarkId}`);
          if (!benchmarkResponse.ok) {
            throw new Error('获取对比标的详情失败');
          }
          
          benchmarkInfo = await benchmarkResponse.json();
          
          // 将数据存入缓存
          benchmarkCache[benchmarkId] = benchmarkInfo;
          console.log(`对比标数据已缓存: ${benchmarkId}`);
          
          // 清除正在请求的标记
          fetchingRef.current = null;
        }
        
        // 获取对比标的趋势表现数据
        console.log(`请求趋势数据: ${benchmarkId}, 间隔: ${interval}, 偏移: ${offset}`);
        const trendResponse = await fetch(`/api/asset-trend/${benchmarkId}/lag-days?intervalType=${interval}&intervalCount=${offset}`);
        if (!trendResponse.ok) {
          throw new Error('获取对比标的趋势表现数据失败');
        }
        
        const result = await trendResponse.json();
        
        if (!result.success) {
          throw new Error(result.message || '获取对比标的趋势表现数据失败');
        }
        
        // 标记初始加载已完成
        initialLoadDone.current = true;
        
        // 处理趋势表现数据
        const trendPerformance: Record<string, { 
          change: number; 
          startPrice?: number; 
          endPrice?: number;
          dataStatus?: string;
          statusMessage?: string;
        }> = {};
        
        // 处理每个趋势期间的数据
        result.data.performances.forEach((performance: { 
          periodId: string; 
          change: number; 
          startPrice?: number; 
          endPrice?: number; 
          dataStatus?: string; 
          statusMessage?: string; 
        }) => {
          trendPerformance[performance.periodId] = {
            change: performance.change,
            startPrice: performance.startPrice,
            endPrice: performance.endPrice,
            dataStatus: performance.dataStatus,
            statusMessage: performance.statusMessage
          };
        });
        
        if (benchmarkData && isParamChange) {
          // 如果只是参数变化，只更新现有数据的相关字段
          setBenchmarkData(prevData => {
            if (!prevData) return null;
            
            return {
              ...prevData,
              lagDays: calculateLagDaysForDisplay(interval, offset),
              intervalType: interval,
              trendPerformance: trendPerformance
            };
          });
          console.log('已更新对比标的趋势数据（只更新参数相关字段）');
        } else {
          // 完全更新数据
          const assetData: AssetTrendData = {
            id: benchmarkInfo.id,
            name: benchmarkInfo.name,
            symbol: benchmarkInfo.symbol,
            category: benchmarkInfo.category,
            lagDays: calculateLagDaysForDisplay(interval, offset), // 根据间隔类型计算滞后天数
            intervalType: interval, // 保存间隔类型以便显示
            trendPerformance
          };
          
          setBenchmarkData(assetData);
          console.log('已更新对比标的趋势数据（完全更新）');
        }
      } catch (err) {
        console.error('获取对比标的趋势数据出错:', err);
        setError('无法加载对比标的趋势数据');
      } finally {
        setLoading(false);
        setUpdatingTrend(false);
      }
    };
    
    fetchBenchmarkData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchmark, offset, interval, trendPeriods]);
  
  // 根据间隔类型计算滞后天数（用于显示）
  const calculateLagDaysForDisplay = (intervalType: string, intervalCount: number): number => {
    switch (intervalType) {
      case '1D': return intervalCount; // 日线，直接显示天数
      case '1W': return intervalCount * 7; // 周线，转换为天数
      case '1M': return intervalCount * 30; // 月线，转换为天数（约数）
      default: return intervalCount * 7; // 默认使用周间隔
    }
  };

  // 格式化日期为更友好的显示
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
  };

  // 格式化涨跌幅
  const formatChange = (change: number): string => {
    return change.toFixed(2) + '%';
  };
  
  // 获取间隔类型的中文显示
  const getIntervalTypeDisplay = (intervalType: string): string => {
    switch (intervalType) {
      case '1D': return '天';
      case '1W': return '周';
      case '1M': return '月';
      default: return '周';
    }
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

  // 将趋势时期按类型和时间排序：上涨趋势放前面，下跌趋势放后面，各自按从新到旧排序
  const sortedTrendPeriods = [...trendPeriods].sort((a: TrendPeriod, b: TrendPeriod) => {
    // 先按趋势类型排序（上涨放前面）
    if (a.trend !== b.trend) {
      return a.trend === 'up' ? -1 : 1;
    }
    
    // 同一类型内按结束日期从新到旧排序
    return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
  });

  // 如果没有选择对比标的，不显示表格
  if (benchmark === 'none') {
    return null;
  }

  return (
    <div className="w-full mb-6">
      <h3 className="text-lg font-medium mb-4">对比标的在各趋势时期的表现</h3>
      
      {loading ? (
        // 全屏加载状态 - 首次加载或切换对比标的时显示
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <div className="h-5 w-5 border-t-2 border-primary rounded-full animate-spin"></div>
          <p className="text-muted-foreground">数据加载中...</p>
        </div>
      ) : error ? (
        <div className="text-center text-red-500 py-4">{error}</div>
      ) : !benchmarkData ? (
        // 如果没有数据，显示空状态
        <div className="text-center text-gray-500 py-4">暂无数据</div>
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
              <TableRow>
                <TableCell className="font-medium sticky left-0 bg-background z-10 shadow-sm whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="font-semibold">{benchmarkData.name}</span>
                    <span className="text-xs text-muted-foreground">
                      滞后{benchmarkData.lagDays}天 
                      {benchmarkData.intervalType && (
                        <span className="ml-1 text-gray-400">
                          ({offset}{getIntervalTypeDisplay(benchmarkData.intervalType)})
                        </span>
                      )}
                    </span>
                  </div>
                </TableCell>
                {sortedTrendPeriods.map((period) => {
                  const periodId = `${period.startDate}_${period.endDate}`;                  
                  const performance = benchmarkData.trendPerformance[periodId] || { change: 0, dataStatus: 'no_data' };
                  
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
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
