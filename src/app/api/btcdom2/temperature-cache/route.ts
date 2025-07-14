import { NextRequest, NextResponse } from 'next/server';

// 引用温度计缓存（需要从temperature-periods导入）
// 由于模块限制，我们需要重新声明类型和访问缓存
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

// 由于JavaScript模块系统的限制，我们需要通过全局对象来访问缓存
// 在temperature-periods/route.ts中，我们需要将缓存暴露到全局
declare global {
  var temperatureCache: Map<string, CachedTemperatureData> | undefined;
}

// 获取缓存状态
export async function GET(request: NextRequest) {
  try {
    // 访问全局缓存对象
    const cache = global.temperatureCache;
    
    if (!cache) {
      return NextResponse.json({
        success: true,
        data: {
          cacheStatus: 'not_initialized',
          totalEntries: 0,
          entries: [],
          message: '缓存尚未初始化'
        }
      });
    }

    // 收集缓存统计信息
    const entries = Array.from(cache.entries()).map(([key, data]) => ({
      cacheKey: key,
      symbol: data.symbol,
      timeframe: data.timeframe,
      dataPoints: data.data.length,
      dateRange: data.data.length > 0 ? {
        start: data.data[0].timestamp,
        end: data.data[data.data.length - 1].timestamp
      } : null,
      lastUpdated: data.lastUpdated,
      memorySizeKB: Math.round(JSON.stringify(data).length / 1024)
    }));

    // 计算总内存使用
    const totalMemoryKB = entries.reduce((sum, entry) => sum + entry.memorySizeKB, 0);
    const totalDataPoints = entries.reduce((sum, entry) => sum + entry.dataPoints, 0);

    return NextResponse.json({
      success: true,
      data: {
        cacheStatus: 'active',
        totalEntries: cache.size,
        totalDataPoints,
        totalMemoryKB,
        totalMemoryMB: Math.round(totalMemoryKB / 1024 * 100) / 100,
        entries: entries.sort((a, b) => b.dataPoints - a.dataPoints), // 按数据点数量排序
        lastChecked: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Temperature cache status error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get cache status'
    }, { status: 500 });
  }
}

// 清除特定缓存项
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe');
    const clearAll = searchParams.get('clearAll') === 'true';

    const cache = global.temperatureCache;
    
    if (!cache) {
      return NextResponse.json({
        success: false,
        message: '缓存未初始化'
      }, { status: 404 });
    }

    if (clearAll) {
      const count = cache.size;
      cache.clear();
      return NextResponse.json({
        success: true,
        message: `已清除所有温度计缓存，共 ${count} 项`,
        clearedEntries: count
      });
    }

    if (symbol && timeframe) {
      const cacheKey = `${symbol}_${timeframe}`;
      const deleted = cache.delete(cacheKey);
      return NextResponse.json({
        success: true,
        message: deleted ? `缓存已清除: ${cacheKey}` : `缓存不存在: ${cacheKey}`,
        deleted
      });
    }

    return NextResponse.json({
      success: false,
      message: '请提供 symbol + timeframe 或设置 clearAll=true'
    }, { status: 400 });

  } catch (error) {
    console.error('Temperature cache delete error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to clear cache'
    }, { status: 500 });
  }
}

// 预热缓存（可选功能）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol = 'OTHERS', timeframe = '1D', startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        message: '请提供 startDate 和 endDate'
      }, { status: 400 });
    }

    // 调用温度计数据API来预热缓存
    const baseUrl = request.nextUrl.origin;
    const warmupUrl = `${baseUrl}/api/btcdom2/temperature-periods?` +
      `symbol=${encodeURIComponent(symbol)}&` +
      `timeframe=${encodeURIComponent(timeframe)}&` +
      `startDate=${encodeURIComponent(startDate)}&` +
      `endDate=${encodeURIComponent(endDate)}`;

    const response = await fetch(warmupUrl);
    const result = await response.json();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `缓存预热成功: ${symbol}_${timeframe}`,
        dataPoints: result.data?.totalDataPoints || 0,
        dateRange: result.data?.dateRange
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `缓存预热失败: ${result.message}`
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Temperature cache warmup error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to warmup cache'
    }, { status: 500 });
  }
}