import { LivePerformanceData, BTCDOM2ChartData } from '@/types/btcdom2';

/**
 * 将实盘表现数据转换为图表数据格式
 * 只保留必要的收益率数据，其他字段给默认值
 */
export function convertLiveDataToChartFormat(
  liveData: LivePerformanceData[]
): BTCDOM2ChartData[] {
  if (!liveData || liveData.length === 0) {
    return [];
  }

  // 按时间排序
  const sortedData = [...liveData].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return sortedData.map((item) => {
    // 使用 market_data_timestamp 作为匹配时间
    const matchTimestamp = item.market_data_timestamp;

    // 计算小时数（从第一个数据点开始）
    const firstTimestamp = new Date(sortedData[0].market_data_timestamp).getTime();
    const currentTimestamp = new Date(matchTimestamp).getTime();
    const hour = Math.floor((currentTimestamp - firstTimestamp) / (1000 * 60 * 60));

    return {
      timestamp: matchTimestamp, // 使用 market_data_timestamp 进行匹配
      hour: hour,
      totalReturn: item.total_return_rate, // 这是我们真正需要的数据
      // 其他字段给默认值，不影响图表显示
      totalValue: 0,
      btcReturn: 0,
      btcValue: 0,
      shortValue: 0,
      cashValue: 0,
      drawdown: 0,
      isActive: false,
      btcPrice: 0,
      btcdomPrice: undefined
    };
  });
}

/**
 * 获取实盘表现数据
 */
export async function fetchLivePerformanceData(params: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<LivePerformanceData[]> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('endpoint', 'all');
    
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    
    const response = await fetch(`/api/btcdom2/performance?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`获取实盘数据失败: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '获取实盘数据失败');
    }
    
    return result.data || [];
  } catch (error) {
    console.error('获取实盘数据错误:', error);
    throw error;
  }
}

/**
 * 获取实盘统计信息
 */
export async function fetchLivePerformanceStats() {
  try {
    const response = await fetch('/api/btcdom2/performance?endpoint=statistics');
    
    if (!response.ok) {
      throw new Error(`获取实盘统计失败: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '获取实盘统计失败');
    }
    
    return result.data;
  } catch (error) {
    console.error('获取实盘统计错误:', error);
    throw error;
  }
}

/**
 * 获取最新实盘数据
 */
export async function fetchLatestLiveData(count: number = 10): Promise<LivePerformanceData[]> {
  try {
    const response = await fetch(`/api/btcdom2/performance?endpoint=latest&count=${count}`);
    
    if (!response.ok) {
      throw new Error(`获取最新实盘数据失败: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '获取最新实盘数据失败');
    }
    
    return result.data || [];
  } catch (error) {
    console.error('获取最新实盘数据错误:', error);
    throw error;
  }
}
