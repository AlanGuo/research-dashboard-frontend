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
      console.log('[8H温度计] 请求时间在8H数据可用期之前，8H数据不可用');
      return {
        success: false,
        message: `8H数据仅从 ${H8_DATA_START} 开始可用，请求的时间范围过早`
      };
    }
    // 情况2：请求时间完全在8H数据可用期之内
    else if (startTime >= h8StartTime) {
      console.log('[8H温度计] 请求时间在8H数据可用期内，直接使用8H数据');
      return fetchTemperatureDataSingle(symbol, '8H', startDate, endDate);
    }
    // 情况3：请求时间跨越8H数据可用期（只返回8H数据可用期内的数据）
    else {
      console.log('[8H温度计] 请求时间跨越8H数据可用期，只返回8H数据可用期内的真实数据');
      
      // 只获取真实8H数据（从8H数据开始到endDate）
      const h8Result = await fetchTemperatureDataSingle(symbol, '8H', H8_DATA_START, endDate);
      
      if (h8Result.success && h8Result.data?.data) {
        allData = h8Result.data.data;
      } else {
        return h8Result;
      }
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
      
      // 获取缓存的时间范围
      const cachedFirstTimestamp = cachedData.data.length > 0 
        ? cachedData.data[0].timestamp 
        : endDate;
      const cachedLastTimestamp = cachedData.data.length > 0 
        ? cachedData.data[cachedData.data.length - 1].timestamp 
        : startDate;
      
      const cachedFirstTime = new Date(cachedFirstTimestamp).getTime();
      const cachedLastTime = new Date(cachedLastTimestamp).getTime();
      const requestedStartTime = new Date(startDate).getTime();
      const requestedEndTime = new Date(endDate).getTime();
      
      // 检查是否需要扩展缓存
      const needsBackwardExpansion = requestedStartTime < cachedFirstTime;
      const needsForwardExpansion = requestedEndTime > cachedLastTime;
      
      if (needsBackwardExpansion || needsForwardExpansion) {
        console.log(`[温度计缓存] 需要扩展缓存 - 向前: ${needsBackwardExpansion}, 向后: ${needsForwardExpansion}`);
        console.log(`[温度计缓存] 请求范围: ${startDate} ~ ${endDate}`);
        console.log(`[温度计缓存] 缓存范围: ${cachedFirstTimestamp} ~ ${cachedLastTimestamp}`);
        
        // 直接重新获取完整数据，避免复杂的增量逻辑
        needsFullFetch = true;
      } else {
        console.log(`[温度计缓存] 缓存数据已覆盖请求范围，无需更新`);
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

