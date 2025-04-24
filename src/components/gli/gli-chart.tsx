'use client';

import { useMemo, useEffect, useState } from 'react';
import { 
  ComposedChart, 
  Area, 
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceArea
} from 'recharts';
import { GliDataPoint, GliParams } from '@/types/gli';

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
}

// GLI趋势时段定义
interface TrendPeriod {
  startDate: string;
  endDate: string;
  trend: 'up' | 'down'; // 上升或下降
  label?: string; // 可选标签
}

// 趋势背景颜色
const TREND_COLORS = {
  up: '#90EE90',   // 上升趋势，浅绿色
  down: '#FFB6C1', // 下降趋势，浅红色
}

// GLI趋势时段数据
const gliTrendPeriods: TrendPeriod[] = [
  { startDate: '2024-12-31', endDate: '2025-04-23', trend: 'up', label: '上升' },
  { startDate: '2024-09-17', endDate: '2024-12-31', trend: 'down', label: '下降' },
  { startDate: '2024-07-01', endDate: '2024-09-17', trend: 'up' },
  { startDate: '2024-01-02', endDate: '2024-07-01', trend: 'down' },
  { startDate: '2023-10-02', endDate: '2024-01-02', trend: 'up' },
  { startDate: '2023-04-04', endDate: '2023-10-02', trend: 'down' },
  { startDate: '2022-11-04', endDate: '2023-02-01', trend: 'up' },
  { startDate: '2022-03-09', endDate: '2022-11-04', trend: 'down' },
  { startDate: '2020-03-20', endDate: '2021-09-16', trend: 'up' },
  { startDate: '2018-03-06', endDate: '2018-11-01', trend: 'up' },
  { startDate: '2016-12-30', endDate: '2018-03-06', trend: 'up' },
  { startDate: '2016-09-08', endDate: '2016-12-30', trend: 'down' },
  { startDate: '2016-01-29', endDate: '2016-09-08', trend: 'up' },
  { startDate: '2013-07-10', endDate: '2014-06-16', trend: 'up' },
  { startDate: '2009-03-10', endDate: '2013-01-29', trend: 'up' },
  { startDate: '2008-12-31', endDate: '2009-03-10', trend: 'down' },
  { startDate: '2008-09-11', endDate: '2008-12-31', trend: 'up' },
  { startDate: '2008-08-01', endDate: '2008-09-11', trend: 'down' },
  { startDate: '2007-06-29', endDate: '2008-08-01', trend: 'up' },
];

export function GliChart({ data, params }: GliChartProps) {
  // 对比标的数据
  const [benchmarkData, setBenchmarkData] = useState<KlineDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // 获取对比标的数据
  useEffect(() => {
    // 如果选择了对比标的且不是'none'
    if (params.benchmark && params.benchmark !== 'none') {
      setLoading(true);
      setError(null);
      
      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (params.interval) queryParams.append('interval', params.interval);
      if (params.limit) queryParams.append('bars', params.limit.toString());
      
      const url = `/api/kline/${params.benchmark}?${queryParams.toString()}`;
      
      // 请求对比标的数据
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`获取${params.benchmark}数据失败: ${response.status}`);
          }
          return response.json();
        })
        .then(result => {
          // 处理不同的数据格式
          let processedData: KlineDataPoint[] = [];
          
          // 根据用户提供的API返回格式处理
          if (result.success && result.data && result.data.candles && Array.isArray(result.data.candles)) {
            // 特定格式: data.candles数组包含K线数据
            processedData = result.data.candles;
          } else if (result.success && Array.isArray(result.data)) {
            // 标准格式
            processedData = result.data;
          } else if (Array.isArray(result)) {
            // 有时API直接返回数组
            processedData = result;
          } else if (result.data && typeof result.data === 'object') {
            // 尝试处理其他可能的格式
            const dataEntries = Object.entries(result.data);
            if (dataEntries.length > 0) {
              processedData = dataEntries.map(([timestamp, value]) => ({
                timestamp: parseInt(timestamp),
                datetime: new Date(parseInt(timestamp)).toISOString(),
                close: typeof value === 'object' ? (value as any).close || 0 : Number(value),
                open: 0,
                high: 0,
                low: 0,
                volume: 0
              }));
            }
          }
          
          if (processedData.length > 0) {
            setBenchmarkData(processedData);
          } else {
            console.error('无法解析对比标的数据:', result);
            setError('无法解析对比标的数据');
            setBenchmarkData([]);
          }
        })
        .catch(err => {
          console.error('获取对比标的数据错误:', err);
          setError(err.message);
          setBenchmarkData([]);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // 如果没有选择对比标的或选择了'none'，清空数据
      setBenchmarkData([]);
    }
  }, [params.benchmark, params.interval, params.limit]);
  
  // 根据时间间隔格式化日期
  const formatDateByInterval = (timestamp: number, interval: string): string => {
    const date = new Date(timestamp);
    
    switch(interval) {
      case '1W':
        // 周线显示年份和周数，如 "2025-W17"
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = Math.floor((date.getTime() - firstDayOfYear.getTime()) / 86400000);
        const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        return `${date.getFullYear()}-W${weekNumber}`;
        
      case '1M':
        // 月线显示年月，如 "2025-04"
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
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
      case '1W':
        // 周线使用周的第一天作为键
        const dayOfWeek = date.getDay(); // 0是周日，1-6是周一到周六
        const firstDayOfWeek = new Date(date);
        firstDayOfWeek.setDate(date.getDate() - dayOfWeek);
        return new Date(firstDayOfWeek.getFullYear(), firstDayOfWeek.getMonth(), firstDayOfWeek.getDate()).getTime();
        
      case '1M':
        // 月线使用月份的第一天作为键
        return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
        
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
  
  // 准备图表数据
  const chartData = useMemo(() => {
    // 确保数据是按时间排序的（从旧到新，因为图表通常从左到右显示）
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const trillion = 1000000000000;
    const interval = params.interval || '1D';
    
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
      
      benchmarkData.forEach(item => {
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
      
      return {
        date: dateStr,
        timestamp: d.timestamp,
        dateKey: dateKey, // 添加一个日期键用于匹配
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
        
        // 对比标的数据
        benchmarkValue: benchmarkMap[dateKey]
      };
    });
    
    // 检查是否有对比标的数据
    const hasBenchmarkData = result.some(item => item.benchmarkValue !== undefined);
    console.log('图表数据中包含对比标的数据:', hasBenchmarkData);
    if (!hasBenchmarkData && benchmarkData.length > 0) {
      console.log('警告: 对比标的数据没有成功映射到图表数据中');
      
      // 如果没有成功映射，尝试直接添加对比标的数据点
      if (benchmarkData.length > 0) {
        console.log('尝试直接添加对比标的数据点');
        // 将对比标的数据转换为图表数据格式
        const benchmarkChartData = benchmarkData.map(item => {
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
  }, [data, benchmarkData]);

  if (data.length === 0) {
    return <div className="text-center p-4">No data available</div>;
  }

  // 获取对比标的名称
  const getBenchmarkName = () => {
    switch(params.benchmark) {
      case 'btcusdt': return 'Bitcoin';
      case 'gold': return '黄金';
      case 'ndx': return 'Nasdaq';
      case 'spx': return 'S&P 500';
      default: return '';
    }
  };
  
  // 获取对比标的颜色
  const getBenchmarkColor = () => {
    switch(params.benchmark) {
      case 'btcusdt': return '#f7931a'; // Bitcoin橙色
      case 'gold': return '#ffd700';   // 黄金色
      case 'ndx': return '#4d90fe';    // Nasdaq蓝色
      case 'spx': return '#21ce99';    // S&P 500绿色
      default: return '#8884d8';       // 默认紫色
    }
  };


  
  // 计算总量 - 用于显示在tooltip中
  const calculateTotal = (dataPoint: any) => {
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

  // 自定义tooltip内容
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // 找到当前数据点
      const currentDataPoint = chartData.find(item => item.date === label);
      if (!currentDataPoint) return null;
      
      // 计算总量
      const total = calculateTotal(currentDataPoint);
      let benchmarkValue = currentDataPoint.benchmarkValue;
      
      return (
        <div className="bg-white p-2 border rounded shadow">
          <p className="font-semibold">Day: {label}</p>

          {payload.map((entry: any, index: number) => {
            // 只显示非total和非benchmarkValue的数据系列
            if (entry.dataKey !== 'total' && entry.dataKey !== 'benchmarkValue' && entry.value !== undefined) {
              return (
                <p key={`item-${index}`} style={{ color: entry.color }}>
                  {entry.name}: {Number(entry.value).toFixed(2)}T
                </p>
              );
            }
            return null;
          })}
          
          {/* 显示对比标的数据 */}
          {benchmarkValue !== null && benchmarkValue !== undefined && (
            <p className="mt-2 pt-2 border-t border-gray-200" style={{ color: '#8884d8' }}>
              {getBenchmarkName()}: {Number(benchmarkValue).toFixed(2)}
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
  const totalChartHeight = '60%';
  const componentsChartHeight = '40%';

  return (
    <div className="w-full h-[600px] flex flex-col">
      {/* 总量图表 - 显示GLI总量和对比标的的线图 */}
      <div className="w-full" style={{ height: totalChartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => value}
              hide // 隐藏X轴，只在底部图表显示
            />
            {/* 左侧Y轴，显示GLI总量数据 */}
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value.toFixed(1)}T`}
              domain={['auto', 'auto']}
            />
            
            {/* 右侧Y轴，显示对比标的数据 */}
            {showBenchmark && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                domain={['auto', 'auto']}
              />
            )}
            
            <Tooltip content={CustomTooltip} />
            <Legend />
            
            <CartesianGrid strokeDasharray="3 3" />
            
            {/* 趋势时段背景标注 - 使用自定义矩形实现 */}
            {chartData.map((point, index) => {
              // 判断该点是否在趋势时段内
              const timestamp = point.timestamp;
              let trendColor = null;
              let trendLabel = null;
              
              // 使用gliTrendPeriods检查每个趋势时段
              for (const period of gliTrendPeriods) {
                if (timestamp >= dateToTimestamp(period.startDate) && timestamp <= dateToTimestamp(period.endDate)) {
                  trendColor = TREND_COLORS[period.trend];
                  trendLabel = period.label;
                  break;
                }
              }
              
              // 如果在趋势时段内，返回一个矩形元素
              if (trendColor && index < chartData.length - 1) {
                // 计算矩形宽度
                const nextPoint = chartData[index + 1];
                const width = 100 / chartData.length;
                const xPos = (index / chartData.length) * 100;
                
                return (
                  <rect 
                    key={`trend-bg-${index}`}
                    x={`${xPos}%`}
                    y="0"
                    width={`${width}%`}
                    height="100%"
                    fill={trendColor}
                    fillOpacity={0.3}
                  >
                    {trendLabel && (
                      <title>{trendLabel}</title>
                    )}
                  </rect>
                );
              }
              return null;
            })} 
            {/* 总量线图 */}
            <Line 
              type="monotone" 
              dataKey={(data) => calculateTotal(data)}
              yAxisId="left"
              stroke="#000000" 
              dot={false}
              name="GLI"
              isAnimationActive={false}
              strokeWidth={1} // 增加线宽使黑线更明显
            />
            
            {/* 对比标的数据 - 使用线形图和右侧Y轴 */}
            {showBenchmark && (
              <Line 
                type="monotone" 
                dataKey="benchmarkValue" 
                yAxisId="right"
                stroke={getBenchmarkColor()} 
                dot={false}
                name={getBenchmarkName()}
                connectNulls={true}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* 组件图表 - 显示GLI各组成部分的堆叠面积图 */}
      <div className="w-full" style={{ height: componentsChartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 0, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => value}
            />
            {/* 左侧Y轴，显示GLI组件数据 */}
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value.toFixed(1)}T`}
              domain={['auto', 'auto']}
            />
            
            <Tooltip content={CustomTooltip} />
            <Legend />
            
            {/* 美元净流动性 */}
            {params.unl_active && chartData[0]?.netUsdLiquidity !== undefined && (
              <Area 
                type="monotone" 
                dataKey="netUsdLiquidity" 
                stackId="1"
                yAxisId="left"
                stroke="#ff7300" 
                fill="#ff7300" 
                name="UNL"
              />
            )}
            
            {/* 欧洲央行 */}
            {params.ecb_active && chartData[0]?.ecb !== undefined && (
              <Area 
                type="monotone" 
                dataKey="ecb" 
                stackId="1"
                yAxisId="left"
                stroke="#0088fe" 
                fill="#0088fe" 
                name="ECB"
              />
            )}
            
            {/* 中国人民银行 */}
            {params.pbc_active && chartData[0]?.pbc !== undefined && (
              <Area 
                type="monotone" 
                dataKey="pbc" 
                stackId="1"
                yAxisId="left"
                stroke="#00c49f" 
                fill="#00c49f" 
                name="PBC"
              />
            )}
            
            {/* 日本银行 */}
            {params.boj_active && chartData[0]?.boj !== undefined && (
              <Area 
                type="monotone" 
                dataKey="boj" 
                stackId="1"
                yAxisId="left"
                stroke="#ff8042" 
                fill="#ff8042" 
                name="BOJ"
              />
            )}
            
            {/* 其他央行 */}
            {params.other_active && chartData[0]?.other_cb_total !== undefined && (
              <Area 
                type="monotone" 
                dataKey="other_cb_total" 
                stackId="1"
                yAxisId="left"
                stroke="#8884d8" 
                fill="#8884d8" 
                name="其他央行"
              />
            )}
            
            {/* M2货币供应 */}
            {params.usa_active && chartData[0]?.usa !== undefined && (
              <Area 
                type="monotone" 
                dataKey="usa" 
                stackId="1"
                yAxisId="left"
                stroke="#82ca9d" 
                fill="#82ca9d" 
                name="美国M2"
              />
            )}
            
            {params.europe_active && chartData[0]?.eu !== undefined && (
              <Area 
                type="monotone" 
                dataKey="eu" 
                stackId="1"
                yAxisId="left"
                stroke="#8dd1e1" 
                fill="#8dd1e1" 
                name="欧洲M2"
              />
            )}
            
            {params.china_active && chartData[0]?.china !== undefined && (
              <Area 
                type="monotone" 
                dataKey="china" 
                stackId="1"
                yAxisId="left"
                stroke="#a4de6c" 
                fill="#a4de6c" 
                name="中国M2"
              />
            )}
            
            {params.japan_active && chartData[0]?.japan !== undefined && (
              <Area 
                type="monotone" 
                dataKey="japan" 
                stackId="1"
                yAxisId="left"
                stroke="#d0ed57" 
                fill="#d0ed57" 
                name="日本M2"
              />
            )}
            
            {params.other_m2_active && chartData[0]?.other_m2_total !== undefined && (
              <Area 
                type="monotone" 
                dataKey="other_m2_total" 
                stackId="1"
                yAxisId="left"
                stroke="#ffc658" 
                fill="#ffc658" 
                name="其他M2"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
