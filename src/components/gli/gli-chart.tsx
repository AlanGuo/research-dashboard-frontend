'use client';

import React, { useMemo, useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
  ReferenceArea
} from 'recharts';
import type { BenchmarkAsset } from '@/types/benchmark';
import { GliDataPoint, GliParams, TrendPeriod } from '@/types/gli';

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

interface GliChartProps {
  data: GliDataPoint[];
  params: GliParams; // 添加params参数
  trendPeriods: TrendPeriod[]; // 添加趋势时段数据
}

// 使用从 types/gli 导入的 TrendPeriod 接口

// 主题相关颜色配置
const THEME_COLORS = {
  light: {
    text: '#000000',
    grid: '#e0e0e0',
    background: '#ffffff',
    total: '#444',
    trend: {
      up: '#90EE90',   // 上升趋势，浅绿色
      down: '#FFB6C1', // 下降趋势，浅红色
    },
    // 流动性组件颜色
    components: {
      netUsdLiquidity: '#8884d8',
      ecb: '#82ca9d',
      pbc: '#ffc658',
      boj: '#ff8042',
      other_cb: '#0088fe',
      usa: '#00C49F',
      europe: '#FFBB28',
      china: '#FF8042',
      japan: '#0088FE',
      other_m2: '#FF00FF'
    }
  },
  dark: {
    text: '#ffffff',
    grid: '#333333',
    background: '#121212',
    total: '#888', // 青色，在深色背景上更加醒目
    trend: {
      up: '#004d00',   // 上升趋势，深绿色
      down: '#5c0000', // 下降趋势，深红色
    },
    // 流动性组件颜色 - 暗黑模式下更高饱和度和亮度
    components: {
      netUsdLiquidity: '#a4a0ff', // 更亮的紫色
      ecb: '#4ade80', // 更亮的绿色
      pbc: '#ffd700', // 更亮的黄色
      boj: '#ff9966', // 更亮的橙色
      other_cb: '#60a5fa', // 更亮的蓝色
      usa: '#34d399', // 更亮的青绿色
      europe: '#fbbf24', // 更亮的金色
      china: '#f97316', // 更亮的橙红色
      japan: '#3b82f6', // 更亮的蓝色
      other_m2: '#e879f9' // 更亮的粉色
    }
  }
}

// GLI趋势时段数据将从API获取

// 对比标的缓存机制，避免重复请求
// 使用组件外部的变量来缓存数据，这样即使组件重新渲染也不会丢失缓存
const benchmarkCache: Record<string, BenchmarkAsset> = {};

export function GliChart({ data, params, trendPeriods }: GliChartProps) {
  // 对比标的数据
  const [benchmarkData, setBenchmarkData] = useState<KlineDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [benchmarkInfo, setBenchmarkInfo] = useState<BenchmarkAsset | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  
  // 记录当前正在请求的benchmark ID，避免重复请求
  const fetchingBenchmarkRef = React.useRef<string | null>(null);
  
  // 将 params.benchmark 转换为字符串类型，用于缓存查询
  const benchmarkId = params.benchmark && params.benchmark !== 'none' ? params.benchmark : null;
  
  // 检测当前主题
  useEffect(() => {
    // 初始检查暗黑模式
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };
    
    // 初始检查
    checkDarkMode();
    
    // 创建一个MutationObserver来监听class变化
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkDarkMode();
        }
      });
    });
    
    // 开始观察document.documentElement的class属性变化
    observer.observe(document.documentElement, { attributes: true });
    
    // 清理函数
    return () => observer.disconnect();
  }, []);
  
  // 根据当前主题获取颜色
  const themeColors = isDarkMode ? THEME_COLORS.dark : THEME_COLORS.light;
  
  // 单独管理对比标的数据获取，避免触发 GLI 数据的重新渲染
  useEffect(() => {
    // 如果选择了对比标的且不是'none'
    if (params.benchmark && params.benchmark !== 'none') {
      setLoading(true);
      setError(null);
      
      // 创建一个可以终止的控制器
      const controller = new AbortController();
      const signal = controller.signal;
      
      // 获取对比标的信息和数据
      const fetchBenchmarkData = async () => {
        try {
          console.log(`获取对比标的数据: ${params.benchmark}`);
          
          // 获取对比标的信息（优先使用缓存）
          let benchmarkInfo: BenchmarkAsset;
          
          if (benchmarkId && benchmarkCache[benchmarkId]) {
            // 使用缓存的数据
            benchmarkInfo = benchmarkCache[benchmarkId];
            console.log(`使用缓存的对比标数据: ${benchmarkId}`);
            setBenchmarkInfo(benchmarkInfo);
          } else {
            // 记录当前正在请求的benchmark
            if (benchmarkId) {
              fetchingBenchmarkRef.current = benchmarkId;
              
              // 请求API获取数据
              const benchmarkResponse = await fetch(`/api/benchmark/${benchmarkId}`, { signal });
              if (!benchmarkResponse.ok) {
                throw new Error(`获取对比标信息失败: ${benchmarkResponse.status}`);
              }
              
              benchmarkInfo = await benchmarkResponse.json();
              
              // 将数据存入缓存
              benchmarkCache[benchmarkId] = benchmarkInfo;
              console.log(`对比标数据已缓存: ${benchmarkId}`);
              
              // 清除正在请求的标记
              fetchingBenchmarkRef.current = null;
              
              setBenchmarkInfo(benchmarkInfo);
            } else {
              throw new Error('无效的对比标ID');
            }
          }
          
          const symbol = benchmarkInfo.symbol; // 使用正确的交易符号
          
          // 构建查询参数
          const queryParams = new URLSearchParams();
          if (params.interval) queryParams.append('interval', params.interval);
          if (params.limit) queryParams.append('bars', params.limit.toString());
          const url = `/api/kline/${symbol}?${queryParams.toString()}`;
      
          // 请求对比标的数据
          const response = await fetch(url, { signal });
          if (!response.ok) {
            throw new Error(`获取${symbol}数据失败: ${response.status}`);
          }
          const result = await response.json();
          
          // 处理不同的数据格式
          let processedData: KlineDataPoint[] = [];
          
          // 根据用户提供的API返回格式处理
          if (result.success && result.data && result.data.candles && Array.isArray(result.data.candles)) {
            // 特定格式: data.candles数组包含K线数据
            processedData = result.data.candles;
          }
          
          if (processedData.length > 0) {
            setBenchmarkData(processedData);
          } else {
            console.error('无法解析对比标的数据:', result);
            setError('无法解析对比标的数据');
            setBenchmarkData([]);
          }
          
          setLoading(false);
        } catch (error) {
          // 如果不是因为终止而导致的错误，才记录日志和设置错误状态
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            console.error('获取对比标的数据失败:', error);
            setError(error instanceof Error ? error.message : '获取数据时发生未知错误');
            setBenchmarkData([]);
            setLoading(false);
          }
        }
      };
      
      // 执行异步函数
      fetchBenchmarkData();
      
      // 清理函数
      return () => {
        setLoading(false);
        controller.abort(); // 取消请求
      };
    } else {
      // 如果没有选择对比标的或选择了'none'，清空数据
      setBenchmarkData([]);
      setBenchmarkInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.benchmark, params.interval, params.limit]);
  
  // 根据时间间隔格式化日期
  const formatDateByInterval = (timestamp: number, interval: string): string => {
    const date = new Date(timestamp);
    
    switch(interval) {
      case '1M':
        // 月线显示年月，如 "2025-04"
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case '1W':
      case '1D':
      default:
        // 日线显示完整日期
        return date.toLocaleDateString();
    }
  };
  
  // 根据时间间隔生成日期键
  const getDateKey = (timestamp: number, interval: string): number => {
    const date = new Date(timestamp);
    
    switch(interval) {
      case '1M':
        // 月线使用月份的第一天作为键
        return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      case '1W':
      case '1D':
      default:
        // 日线使用当天零点作为键
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    }
  };

  // 将日期字符串转换为时间戳
  const dateToTimestamp = (dateStr: string): number => {
    return new Date(dateStr).getTime();
  };
  
  // 查找最近的对比标的值
  const findNearestBenchmarkValue = (dateKey: number, benchmarkMap: Record<number, number>): number | undefined => {
    // 如果当前日期有数据，直接返回
    if (benchmarkMap[dateKey] !== undefined) {
      return benchmarkMap[dateKey];
    }
    
    // 首先获取所有日期键并按时间排序
    const dateKeys = Object.keys(benchmarkMap).map(Number).sort((a, b) => a - b);
    
    // 如果没有任何数据，返回undefined
    if (dateKeys.length === 0) {
      return undefined;
    }
    
    // 获取资产的最早和最晚数据日期
    const earliestDataKey = dateKeys[0];
    const latestDataKey = dateKeys[dateKeys.length - 1];
    
    // 如果当前日期早于资产的最早数据日期，不进行填充
    if (dateKey < earliestDataKey) {
      return undefined;
    }
    
    // 如果当前日期晚于资产的最晚数据日期，也不进行填充
    if (dateKey > latestDataKey) {
      return undefined;
    }
    
    // 找到小于当前日期的最大日期键（最近的过去数据）
    let nearestPastKey = null;
    for (let i = dateKeys.length - 1; i >= 0; i--) {
      if (dateKeys[i] < dateKey) {
        nearestPastKey = dateKeys[i];
        break;
      }
    }
    
    // 如果找到了最近的过去数据，返回它
    if (nearestPastKey !== null) {
      return benchmarkMap[nearestPastKey];
    }
    
    // 如果没有找到过去的数据，使用未来最近的数据
    const nearestFutureKey = dateKeys.find(key => key > dateKey);
    return nearestFutureKey !== undefined ? benchmarkMap[nearestFutureKey] : undefined;
  };
  
  // 准备图表数据
  const chartData = useMemo(() => {
    // 确保数据是按时间排序的（从旧到新，因为图表通常从左到右显示）
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const trillion = 1000000000000;
    // 使用参数或默认值
    const interval = params.interval || '1D';
    const offset = params.offset || 0; // 获取时间偏移参数
    
    // 如果没有GLI数据，返回空数组
    if (sortedData.length === 0) {
      return [];
    }
    
    // 如果有对比标的数据，创建以时间戳为键的映射
    const benchmarkMap: Record<number, number> = {};
    
    if (benchmarkData.length > 0) {
      // 初始化最大和最小值，用于归一化
      let maxValue = -Infinity;
      let minValue = Infinity;
      
      // 首先按时间戳排序，确保从旧到新处理数据
      const sortedBenchmarkData = [...benchmarkData].sort((a, b) => a.timestamp - b.timestamp);
      
      sortedBenchmarkData.forEach(item => {
        if (item && typeof item.timestamp === 'number' && typeof item.close === 'number') {
          // 根据时间间隔生成日期键
          const dateKey = getDateKey(item.timestamp, interval);
          benchmarkMap[dateKey] = item.close; // 使用收盘价
          
          // 更新最大和最小值
          if (item.close > maxValue) maxValue = item.close;
          if (item.close < minValue) minValue = item.close;
        }
      });
    }
    
    // 创建图表数据
    const result = sortedData.map((d) => {
      // 计算 Net USD Liquidity = FED - TGA - RRP
      const netUsdLiquidity = d.fed ? 
        (d.fed - (d.tga || 0) - (d.rrp || 0)) / trillion : 
        undefined;
      
      // 根据时间间隔生成日期键和格式化日期
      const dateKey = getDateKey(d.timestamp, interval);
      const dateStr = formatDateByInterval(d.timestamp, interval);
      
      // 如果有偏移参数，计算偏移后的时间键
      let offsetDateKey = dateKey;
      if (offset !== 0 && benchmarkData.length > 0) {
        // 根据时间间隔计算偏移量
        let offsetMs = 0;
        if (interval === '1D') {
          offsetMs = offset * 24 * 60 * 60 * 1000; // 日线，一天的毫秒数
        } else if (interval === '1W') {
          offsetMs = offset * 7 * 24 * 60 * 60 * 1000; // 周线，一周的毫秒数
        } else if (interval === '1M') {
          offsetMs = offset * 30 * 24 * 60 * 60 * 1000; // 月线，约30天的毫秒数
        }
        
        // 计算偏移后的时间
        // 反转偏移方向，让正数表示 GLI 领先，负数表示 GLI 滞后
        const offsetDate = new Date(d.timestamp + offsetMs);
        offsetDateKey = getDateKey(offsetDate.getTime(), interval);
      }
      
      return {
        date: dateStr,
        timestamp: d.timestamp,
        dateKey: dateKey, // 原始日期键用于其他目的
        total: d.total / trillion,
        // 央行数据
        netUsdLiquidity, // 美元净流动性
        ecb: d.ecb ? d.ecb / trillion : undefined,
        pbc: d.pbc ? d.pbc / trillion : undefined,
        boj: d.boj ? d.boj / trillion : undefined,
        other_cb_total: d.other_cb_total ? d.other_cb_total / trillion : undefined,
        
        // M2货币供应数据
        usa: d.usa ? d.usa / trillion : undefined,
        eu: d.eu ? d.eu / trillion : undefined,
        china: d.china ? d.china / trillion : undefined,
        japan: d.japan ? d.japan / trillion : undefined,
        other_m2_total: d.other_m2_total ? d.other_m2_total / trillion : undefined,
        
        // 对比标的数据 - 使用偏移后的日期键
        // 如果当前日期没有数据，尝试查找最近的有效数据
        benchmarkValue: findNearestBenchmarkValue(offsetDateKey, benchmarkMap)
      };
    });
    
    // 检查是否有对比标的数据
    const hasBenchmarkData = result.some(item => item.benchmarkValue !== undefined);
    if (!hasBenchmarkData && benchmarkData.length > 0) {
      console.log('警告: 对比标的数据没有成功映射到图表数据中');
      
      // 如果没有成功映射，尝试直接添加对比标的数据点
      if (benchmarkData.length > 0) {
        // 将对比标的数据转换为图表数据格式
        const benchmarkChartData = benchmarkData.map((item: KlineDataPoint) => {
          const date = new Date(item.timestamp);
          const dateWithoutTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
          
          return {
            date: date.toLocaleDateString(),
            timestamp: item.timestamp,
            dateKey: dateWithoutTime,
            // 添加必要的空字段以符合类型
            total: 0,
            netUsdLiquidity: undefined,
            ecb: undefined,
            pbc: undefined,
            boj: undefined,
            other_cb_total: undefined,
            usa: undefined,
            eu: undefined,
            china: undefined,
            japan: undefined,
            other_m2_total: undefined,
            benchmarkValue: item.close
          };
        });
        
        // 合并到结果中
        result.push(...benchmarkChartData);
      }
    }
    
    return result;
  }, [data, benchmarkData, params.interval, params.offset]);

  // // 当选择的对比标的变化时，获取对比标的信息
  // useEffect(() => {
  //   // 获取对比标的信息（使用缓存机制）
  //   const fetchBenchmarkInfo = async () => {
  //     // 将 params.benchmark 转换为字符串类型，用于缓存查询
  //     const benchId = params.benchmark && params.benchmark !== 'none' ? params.benchmark : null;
      
  //     if (benchId) {
  //       try {
  //         // 优先使用缓存数据
  //         if (benchmarkCache[benchId]) {
  //           console.log(`使用缓存的对比标信息: ${benchId}`);
  //           setBenchmarkInfo(benchmarkCache[benchId]);
  //           return;
  //         }
          
  //         // 如果正在请求相同的benchmark，等待一下再重试
  //         if (fetchingBenchmarkRef.current === benchId) {
  //           console.log(`正在请求对比标信息: ${benchId}，稍后重试`);
  //           setTimeout(() => fetchBenchmarkInfo(), 100);
  //           return;
  //         }
          
  //         // 记录当前正在请求的benchmark
  //         fetchingBenchmarkRef.current = benchId;
          
  //         // 使用正确的API路径
  //         const response = await fetch(`/api/benchmark/${benchId}`);
  //         if (response.ok) {
  //           const info = await response.json();
  //           // 将数据存入缓存
  //           benchmarkCache[benchId] = info;
  //           console.log(`对比标信息已缓存: ${benchId}`);
  //           setBenchmarkInfo(info);
  //         } else {
  //           console.error(`Error fetching benchmark: ${response.statusText}`);
  //           setBenchmarkInfo(null);
  //         }
          
  //         // 清除正在请求的标记
  //         fetchingBenchmarkRef.current = null;
  //       } catch (error) {
  //         console.error(`Failed to fetch benchmark with id ${benchId}:`, error);
  //         setBenchmarkInfo(null);
  //         // 清除正在请求的标记
  //         fetchingBenchmarkRef.current = null;
  //       }
  //     } else {
  //       setBenchmarkInfo(null);
  //     }
  //   };
    
  //   fetchBenchmarkInfo();
  // }, [params.benchmark]);
  
  // 获取对比标的名称
  const getBenchmarkName = () => {
    return benchmarkInfo?.name || '';
  };
  
  // 获取对比标的颜色
  const getBenchmarkColor = () => {
    return benchmarkInfo?.color
  };


  
  // 计算总量 - 用于显示在tooltip中
  const calculateTotal = (dataPoint: Record<string, number | undefined>) => {
    let total = 0;
    
    // 添加所有活跃的GLI组件
    if (params.unl_active && dataPoint.netUsdLiquidity !== undefined) {
      total += dataPoint.netUsdLiquidity;
    }
    if (params.ecb_active && dataPoint.ecb !== undefined) {
      total += dataPoint.ecb;
    }
    if (params.pbc_active && dataPoint.pbc !== undefined) {
      total += dataPoint.pbc;
    }
    if (params.boj_active && dataPoint.boj !== undefined) {
      total += dataPoint.boj;
    }
    if (params.other_active && dataPoint.other_cb_total !== undefined) {
      total += dataPoint.other_cb_total;
    }
    if (params.usa_active && dataPoint.usa !== undefined) {
      total += dataPoint.usa;
    }
    if (params.europe_active && dataPoint.eu !== undefined) {
      total += dataPoint.eu;
    }
    if (params.china_active && dataPoint.china !== undefined) {
      total += dataPoint.china;
    }
    if (params.japan_active && dataPoint.japan !== undefined) {
      total += dataPoint.japan;
    }
    if (params.other_m2_active && dataPoint.other_m2_total !== undefined) {
      total += dataPoint.other_m2_total;
    }
    
    return total;
  };


  
  // 格式化数值显示
  const formatValue = (value: unknown): string => {
    if (value === undefined || value === null) return 'N/A';
    if (typeof value === 'number') {
      // 如果数值很大，以万亿为单位显示
      if (value > 1000000000000) {
        return `${(value / 1000000000000).toFixed(2)}T`;
      }
      // 否则正常显示两位小数
      return value.toFixed(2);
    }
    return String(value);
  };
  
  // 自定义Tooltip内容
  const CustomTooltip = ({ active, payload, label, isDarkMode }: { active?: boolean; payload?: Array<Record<string, unknown>>; label?: number; isDarkMode?: boolean }) => {
    if (active && payload && payload.length) {
      // 找到当前数据点 - 现在label是时间戳
      const currentDataPoint = chartData.find(item => item.timestamp === Number(label));
      if (!currentDataPoint) return null;
      
      // 获取对比标的值
      const benchmarkValue = currentDataPoint.benchmarkValue;
      
      // 格式化日期显示
      const formattedDate = formatDateByInterval(Number(label), params.interval || '1D');
      
      return (
        <div className={`custom-tooltip p-3 border shadow-md rounded-md ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-black'}`}>
          <p className="font-semibold">日期: {formattedDate}</p>
          
          {payload.map((entry, index) => {
            // 只显示非total和非benchmarkValue的数据系列
            if (entry.dataKey !== 'total' && entry.dataKey !== 'benchmarkValue' && entry.value !== undefined) {
              return (
                <p key={`item-${index}`} style={{ color: entry.color as string }}>
                  {String(entry.name)}: {formatValue(entry.value)}
                </p>
              );
            }
            return null;
          })}
          
          {/* 添加分隔线 */}
          {showBenchmark && benchmarkValue !== undefined && (
            <div className={`border-t my-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}></div>
          )}
          
          {/* 显示对比标的数据 */}
          {benchmarkValue !== null && benchmarkValue !== undefined && (
            <p className="mt-2 pt-2">
              {getBenchmarkName()}: {formatValue(benchmarkValue)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // 是否显示对比标的
  const showBenchmark = params.benchmark && params.benchmark !== 'none' && benchmarkData.length > 0;
  
  // 计算图表高度比例 - 上部图表更大
  const totalChartHeight = '70%';
  const componentsChartHeight = '30%';
  
  // 计算X轴的时间范围
  const timeRange = useMemo(() => {
    if (chartData.length === 0) return { min: 0, max: 0 };
    
    // 找出数据中的最小和最大时间戳
    const timestamps = chartData.map(item => item.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    
    const padding = 0
    
    return {
      min: minTime - padding,
      max: maxTime + padding
    };
  }, [chartData]);
      
  if (data.length === 0) {
    return <div className="text-center p-4">No data available</div>;
  }

  return (
    <div className="w-full h-[800px] flex flex-col" style={{ backgroundColor: themeColors.background, borderRadius: '8px', padding: '16px' }}>
      {/* 总量图表 - 显示GLI总量和对比标的的线图 */}
      <div className="w-full" style={{ height: totalChartHeight, backgroundColor: themeColors.background }}>
        <ResponsiveContainer width="100%" height="100%"> 
          <ComposedChart data={chartData} margin={{ top: 0, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid} />
            <XAxis 
              dataKey="timestamp" 
              scale="time" 
              type="number" 
              tick={{ fontSize: 12, fill: themeColors.text }}
              tickFormatter={(value) => formatDateByInterval(value, params.interval || '1D')}
              domain={[timeRange.min, timeRange.max]}
              hide
            />
            {/* 左侧Y轴，显示GLI总量数据 */}
            <YAxis 
              yAxisId="left"
              orientation="left"
              tickFormatter={(value) => `${value.toFixed(1)}T`}
              domain={['auto', 'auto']}
              tick={{ fill: themeColors.text, fontSize: 12  }}
              stroke={themeColors.grid}
            />
            
            {/* 如果有对比标的，显示右侧Y轴 */}
            {showBenchmark && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fill: themeColors.text, fontSize: 12  }}
                stroke={themeColors.grid}
                domain={['auto', 'auto']}
                // 如果启用了反转Y轴，则反转数据方向
                reversed={params.invertBenchmarkYAxis}
              />
            )}
            
            <Tooltip content={<CustomTooltip />} />
            
            {/* 显示GLI总量线 */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey={(data) => calculateTotal(data)}
              name="GLI总量"
              stroke={themeColors.total}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
            
            {/* 对比标的数据 */}
            {params.benchmark && params.benchmark !== 'none' && benchmarkData.length > 0 && (
              <Line
                type="monotone"
                dataKey="benchmarkValue"
                name={getBenchmarkName()}
                stroke={getBenchmarkColor()}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                yAxisId="right"
              />
            )}
            {/* 添加趋势时期背景 */}
            {trendPeriods.map((period, index) => {
              // 将日期字符串转换为时间戳
              const startTimestamp = dateToTimestamp(period.startDate);
              const endTimestamp = dateToTimestamp(period.endDate);
              
              return (
                <ReferenceArea
                  yAxisId="left"
                  key={`trend-total-${index}`}
                  x1={startTimestamp}
                  x2={endTimestamp}
                  fill={period.trend === 'up' ? themeColors.trend.up : themeColors.trend.down}
                  fillOpacity={0.2}
                  ifOverflow="hidden"
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* 组件图表 - 显示GLI各组成部分的堆叠面积图 */}
      <div className="w-full" style={{ height: componentsChartHeight, backgroundColor: themeColors.background }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart 
            data={chartData} 
            margin={{ top: 0, right: 5, left: 5, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid} />
            <XAxis 
              dataKey="timestamp" 
              scale="time" 
              type="number" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatDateByInterval(value, params.interval || '1D')}
              domain={[timeRange.min, timeRange.max]}
            />
            {/* 左侧Y轴，显示GLI组件数据 */}
            <YAxis
              yAxisId="left"
              tick={{ fill: themeColors.text, fontSize: 12 }}
              stroke={themeColors.grid}
              tickFormatter={(value) => `${value.toFixed(1)}T`}
              domain={['auto', 'auto']}
            />
            {/* 如果有对比标的，显示右侧Y轴 */}
            {showBenchmark && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fill: themeColors.text, fontSize: 12  }}
                stroke={themeColors.grid}
                domain={['auto', 'auto']}
              />
            )}
            
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {/* 添加趋势时期背景 */}
            {trendPeriods.map((period, index) => {
              // 将日期字符串转换为时间戳
              const startTimestamp = dateToTimestamp(period.startDate);
              const endTimestamp = dateToTimestamp(period.endDate);
              
              return (
                <ReferenceArea
                  key={`trend-comp-${index}`}
                  yAxisId="left"
                  x1={startTimestamp}
                  x2={endTimestamp}
                  fill={period.trend === 'up' ? themeColors.trend.up : themeColors.trend.down}
                  fillOpacity={0.2}
                  ifOverflow="hidden"
                />
              );
            })}

            {/* 根据参数显示不同的数据系列 */}
            {params.unl_active && (
              <Area
                type="monotone"
                dataKey="netUsdLiquidity"
                name="美元净流动性(UNL)"
                stackId="1"
                fill={themeColors.components.netUsdLiquidity}
                stroke={themeColors.components.netUsdLiquidity}
                isAnimationActive={false}
                yAxisId="left"
              />
            )}
            
            {params.ecb_active && (
              <Area
                type="monotone"
                dataKey="ecb"
                name="ECB"
                stackId="1"
                fill={themeColors.components.ecb}
                stroke={themeColors.components.ecb}
                isAnimationActive={false}
                yAxisId="left"
              />
            )}
            
            {params.pbc_active && (
              <Area
                type="monotone"
                dataKey="pbc"
                name="PBC"
                stackId="1"
                fill={themeColors.components.pbc}
                stroke={themeColors.components.pbc}
                isAnimationActive={false}
                yAxisId="left"
              />
            )}
            
            {params.boj_active && (
              <Area
                type="monotone"
                dataKey="boj"
                name="BOJ"
                stackId="1"
                fill={themeColors.components.boj}
                stroke={themeColors.components.boj}
                isAnimationActive={false}
                yAxisId="left"
              />
            )}
            
            {params.other_active && (
              <Area
                type="monotone"
                dataKey="other_cb_total"
                name="Other Central Banks"
                stackId="1"
                fill={themeColors.components.other_cb}
                stroke={themeColors.components.other_cb}
                isAnimationActive={false}
                yAxisId="left"
              />
            )}
            
            {/* M2货币供应数据 */}
            {params.usa_active && (
              <Area
                type="monotone"
                dataKey="usa"
                name="USA M2"
                stackId="1"
                fill={themeColors.components.usa}
                stroke={themeColors.components.usa}
                isAnimationActive={false}
                yAxisId="left"
              />
            )}
            
            {params.europe_active && (
              <Area
                type="monotone"
                dataKey="eu"
                name="Europe M2"
                stackId="1"
                fill={themeColors.components.europe}
                stroke={themeColors.components.europe}
                isAnimationActive={false}
                yAxisId="left"
              />
            )}
            
            {params.china_active && (
              <Area
                type="monotone"
                dataKey="china"
                name="China M2"
                stackId="1"
                fill={themeColors.components.china}
                stroke={themeColors.components.china}
                isAnimationActive={false}
                yAxisId="left"
              />
            )}
            
            {params.japan_active && (
              <Area
                type="monotone"
                dataKey="japan"
                name="Japan M2"
                stackId="1"
                fill={themeColors.components.japan}
                stroke={themeColors.components.japan}
                isAnimationActive={false}
                yAxisId="left"
              />
            )}
            
            {params.other_m2_active && (
              <Area
                type="monotone"
                dataKey="other_m2_total"
                name="Other M2"
                stackId="1"
                fill={themeColors.components.other_m2}
                stroke={themeColors.components.other_m2}
                isAnimationActive={false}
                yAxisId="left"
              />
            )}
            
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* 显示加载状态和错误信息 */}
      {loading && <div className="flex flex-col items-center justify-center h-full gap-2">
          <div className="h-5 w-5 border-t-2 border-primary rounded-full animate-spin"></div>
          <p className="text-muted-foreground">图表加载中...</p>
        </div>}
      {error && <div className="mt-4 text-center text-red-500">{error}</div>}
    </div>
  );
}
