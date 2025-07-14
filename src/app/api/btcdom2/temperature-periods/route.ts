import { NextRequest, NextResponse } from 'next/server';
import config from '@/config/index';

// 全局类型声明
declare global {
  // eslint-disable-next-line no-var
  var temperatureCache: Map<string, CachedTemperatureData> | undefined;
}

// 温度计数据缓存接口
interface TemperatureDataPoint {
  timestamp: string;
  value: number;
}

interface CachedTemperatureData {
  symbol: string;
  timeframe: string;
  data: TemperatureDataPoint[];
  lastUpdated: string;
}

// 内存缓存存储
let temperatureCache: Map<string, CachedTemperatureData>;

// 初始化缓存并暴露到全局供其他API访问
if (!global.temperatureCache) {
  temperatureCache = new Map<string, CachedTemperatureData>();
  global.temperatureCache = temperatureCache;
} else {
  temperatureCache = global.temperatureCache;
}

// 生成缓存键
function getCacheKey(symbol: string, timeframe: string): string {
  return `${symbol}_${timeframe}`;
}

// 从后端获取温度计数据（单次请求）
async function fetchTemperatureDataSingle(
  symbol: string,
  timeframe: string,
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  data?: {
    data: TemperatureDataPoint[];
  };
  message?: string;
}> {
  const apiBaseUrl = config.api?.baseUrl;
  if (!apiBaseUrl) {
    throw new Error('API base URL not configured');
  }

  const backendUrl = `${apiBaseUrl}/v1/btcdom/temperature-periods?` +
    `symbol=${encodeURIComponent(symbol)}&` +
    `timeframe=${encodeURIComponent(timeframe)}&` +
    `startDate=${encodeURIComponent(startDate)}&` +
    `endDate=${encodeURIComponent(endDate)}`;

  const response = await fetch(backendUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Backend API request failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// 插值生成8H数据点（基于1D数据）
function interpolate8HData(dailyData: TemperatureDataPoint[]): TemperatureDataPoint[] {
  const result: TemperatureDataPoint[] = [];
  
  for (let i = 0; i < dailyData.length; i++) {
    const currentPoint = dailyData[i];
    const currentTime = new Date(currentPoint.timestamp);
    
    // 为每一天生成3个8小时数据点：00:00, 08:00, 16:00
    for (let j = 0; j < 3; j++) {
      const timeOffset = j * 8; // 0, 8, 16 小时
      const interpolatedTime = new Date(currentTime);
      interpolatedTime.setUTCHours(timeOffset, 0, 0, 0);
      
      // 简单插值：在当前值基础上添加小幅随机波动
      // 实际应用中可以使用更复杂的插值算法
      let interpolatedValue = currentPoint.value;
      
      if (j === 1) {
        // 08:00 时刻：略微上调
        interpolatedValue += (Math.random() - 0.5) * 2;
      } else if (j === 2) {
        // 16:00 时刻：略微下调
        interpolatedValue += (Math.random() - 0.5) * 2;
      }
      
      // 确保值在合理范围内
      interpolatedValue = Math.max(0, Math.min(100, interpolatedValue));
      
      result.push({
        timestamp: interpolatedTime.toISOString(),
        value: interpolatedValue
      });
    }
  }
  
  return result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// 智能获取温度计数据（支持8H分段获取）
async function fetchTemperatureData(
  symbol: string,
  timeframe: string,
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  data?: {
    data: TemperatureDataPoint[];
  };
  message?: string;
}> {
  // 8H数据的实际可用起始时间（根据之前的测试结果）
  const H8_DATA_START = '2023-09-09T00:00:00.000Z';
  
  // 如果不是8H时间间隔，直接使用原有逻辑
  if (timeframe !== '8H' && timeframe !== '8h') {
    return fetchTemperatureDataSingle(symbol, timeframe, startDate, endDate);
  }
  
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  const h8StartTime = new Date(H8_DATA_START).getTime();
  
  let allData: TemperatureDataPoint[] = [];
  
  try {
    // 情况1：请求时间完全在8H数据可用期之前
    if (endTime <= h8StartTime) {
      console.log('[8H温度计] 请求时间在8H数据可用期之前，使用1D数据插值');
      const dailyResult = await fetchTemperatureDataSingle(symbol, '1D', startDate, endDate);
      if (dailyResult.success && dailyResult.data?.data) {
        allData = interpolate8HData(dailyResult.data.data);
      } else {
        return dailyResult;
      }
    }
    // 情况2：请求时间完全在8H数据可用期之内
    else if (startTime >= h8StartTime) {
      console.log('[8H温度计] 请求时间在8H数据可用期内，直接使用8H数据');
      return fetchTemperatureDataSingle(symbol, '8H', startDate, endDate);
    }
    // 情况3：请求时间跨越8H数据可用期（需要分段获取）
    else {
      console.log('[8H温度计] 请求时间跨越8H数据可用期，分段获取数据');
      
      // 第一段：使用1D数据插值（从startDate到8H数据开始）
      const beforeH8EndDate = new Date(h8StartTime - 24 * 60 * 60 * 1000).toISOString(); // 8H数据开始的前一天
      const dailyResult = await fetchTemperatureDataSingle(symbol, '1D', startDate, beforeH8EndDate);
      
      if (dailyResult.success && dailyResult.data?.data) {
        const interpolatedData = interpolate8HData(dailyResult.data.data);
        allData.push(...interpolatedData);
      }
      
      // 第二段：使用真实8H数据（从8H数据开始到endDate）
      const h8Result = await fetchTemperatureDataSingle(symbol, '8H', H8_DATA_START, endDate);
      
      if (h8Result.success && h8Result.data?.data) {
        allData.push(...h8Result.data.data);
      }
      
      // 去重和排序
      const dataMap = new Map<string, TemperatureDataPoint>();
      allData.forEach(point => {
        dataMap.set(point.timestamp, point);
      });
      allData = Array.from(dataMap.values()).sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }
    
    return {
      success: true,
      data: {
        data: allData
      }
    };
    
  } catch (error) {
    console.error('[8H温度计] 分段获取数据失败:', error);
    // 降级：尝试直接获取8H数据
    return fetchTemperatureDataSingle(symbol, timeframe, startDate, endDate);
  }
}

// 合并数据并去重
function mergeTemperatureData(
  existingData: TemperatureDataPoint[],
  newData: TemperatureDataPoint[]
): TemperatureDataPoint[] {
  // 创建时间戳到数据点的映射，用于去重
  const dataMap = new Map<string, TemperatureDataPoint>();
  
  // 先添加现有数据
  existingData.forEach(point => {
    dataMap.set(point.timestamp, point);
  });
  
  // 添加新数据，会自动覆盖重复的时间戳
  newData.forEach(point => {
    dataMap.set(point.timestamp, point);
  });
  
  // 转换回数组并按时间排序
  return Array.from(dataMap.values())
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// 过滤指定时间范围内的数据
function filterDataByDateRange(
  data: TemperatureDataPoint[],
  startDate: string,
  endDate: string
): TemperatureDataPoint[] {
  const startTimestamp = new Date(startDate).getTime();
  const endTimestamp = new Date(endDate).getTime();
  
  return data.filter(point => {
    const pointTimestamp = new Date(point.timestamp).getTime();
    return pointTimestamp >= startTimestamp && pointTimestamp <= endTimestamp;
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 获取查询参数
    const symbol = searchParams.get('symbol') || 'OTHERS';
    const timeframe = searchParams.get('timeframe') || '1D';
    const startDate = searchParams.get('startDate') || '2020-01-01T00:00:00.000Z';
    const endDate = searchParams.get('endDate') || new Date().toISOString();

    const cacheKey = getCacheKey(symbol, timeframe);
    const cachedData = temperatureCache.get(cacheKey);

    let finalData: TemperatureDataPoint[] = [];
    let needsFullFetch = false;

    if (!cachedData) {
      console.log(`[温度计缓存] 缓存未命中，首次获取数据: ${cacheKey}`);
      needsFullFetch = true;
    } else {
      console.log(`[温度计缓存] 缓存命中: ${cacheKey}, 数据点数: ${cachedData.data.length}`);
      
      // 检查是否需要增量更新
      const cachedLastTimestamp = cachedData.data.length > 0 
        ? cachedData.data[cachedData.data.length - 1].timestamp 
        : startDate;
      
      const cachedLastTime = new Date(cachedLastTimestamp).getTime();
      const requestedEndTime = new Date(endDate).getTime();
      
      // 如果请求的结束时间晚于缓存中的最新时间，需要增量更新
      if (requestedEndTime > cachedLastTime) {
        console.log(`[温度计缓存] 需要增量更新，从 ${cachedLastTimestamp} 到 ${endDate}`);
        
        try {
          // 增量获取新数据（根据时间间隔计算增量起始时间）
          let incrementalInterval: number;
          if (timeframe === '8H' || timeframe === '8h') {
            incrementalInterval = 8 * 60 * 60 * 1000; // 8小时
          } else {
            incrementalInterval = 24 * 60 * 60 * 1000; // 1天
          }
          const incrementalStartDate = new Date(cachedLastTime + incrementalInterval).toISOString();
          const incrementalData = await fetchTemperatureData(symbol, timeframe, incrementalStartDate, endDate);
          
          if (incrementalData.success && incrementalData.data?.data) {
            console.log(`[温度计缓存] 增量获取到 ${incrementalData.data.data.length} 个新数据点`);
            
            // 合并数据
            const mergedData = mergeTemperatureData(cachedData.data, incrementalData.data.data);
            
            // 更新缓存
            temperatureCache.set(cacheKey, {
              symbol,
              timeframe,
              data: mergedData,
              lastUpdated: new Date().toISOString()
            });
            
            finalData = mergedData;
          } else {
            console.log(`[温度计缓存] 增量更新失败，使用缓存数据`);
            finalData = cachedData.data;
          }
        } catch (error) {
          console.warn(`[温度计缓存] 增量更新出错，使用缓存数据:`, error instanceof Error ? error.message : String(error));
          finalData = cachedData.data;
        }
      } else {
        console.log(`[温度计缓存] 缓存数据已足够，无需更新`);
        finalData = cachedData.data;
      }
    }

    // 如果需要完整获取数据
    if (needsFullFetch) {
      const fullData = await fetchTemperatureData(symbol, timeframe, startDate, endDate);
      
      if (!fullData.success || !fullData.data?.data) {
        throw new Error(fullData.message || '温度计数据获取失败');
      }
      
      console.log(`[温度计缓存] 完整获取到 ${fullData.data.data.length} 个数据点`);
      
      // 缓存完整数据
      temperatureCache.set(cacheKey, {
        symbol,
        timeframe,
        data: fullData.data.data,
        lastUpdated: new Date().toISOString()
      });
      
      finalData = fullData.data.data;
    }

    // 根据请求的时间范围过滤数据
    const filteredData = filterDataByDateRange(finalData, startDate, endDate);
    
    console.log(`[温度计缓存] 返回 ${filteredData.length} 个数据点 (${startDate} ~ ${endDate})`);

    // 返回符合原始接口格式的数据
    return NextResponse.json({
      success: true,
      data: {
        symbol,
        timeframe,
        data: filteredData,
        totalDataPoints: filteredData.length,
        dateRange: {
          start: startDate,
          end: endDate,
        },
      },
    });

  } catch (error) {
    console.error('Temperature periods API error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

