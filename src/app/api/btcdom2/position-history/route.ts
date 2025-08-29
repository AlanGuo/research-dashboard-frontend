import { NextRequest, NextResponse } from 'next/server';
import config from '@/config/index';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 获取查询参数
    const marketDataTimestamp = searchParams.get('marketDataTimestamp');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') || 'market_data_timestamp';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const limit = searchParams.get('limit');
    const endpoint = searchParams.get('endpoint') || 'default';

    // 构建后端API URL
    const apiBaseUrl = config.api?.baseUrl;
    if (!apiBaseUrl) {
      throw new Error('API base URL not configured');
    }

    let backendUrl: string;
    const queryParams = new URLSearchParams();

    // 根据endpoint参数决定调用哪个接口
    if (endpoint === 'by-timestamp') {
      // 使用 by-timestamp 端点
      if (!marketDataTimestamp) {
        throw new Error('marketDataTimestamp参数是必需的');
      }
      backendUrl = `${apiBaseUrl}/v1/btcdom2/position-history/by-timestamp`;
      queryParams.append('marketDataTimestamp', marketDataTimestamp);
    } else {
      // 使用默认的范围查询端点
      backendUrl = `${apiBaseUrl}/v1/btcdom2/position-history`;
      
      // 构建查询参数
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      if (sortBy) queryParams.append('sortBy', sortBy);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);
      if (limit) queryParams.append('limit', limit);
    }

    // 添加查询参数到URL
    if (queryParams.toString()) {
      backendUrl += `?${queryParams.toString()}`;
    }

    console.log('调用后端持仓历史API:', backendUrl);

    // 调用后端API
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json(data);

  } catch (error) {
    console.error('持仓历史数据API错误:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取持仓历史数据失败'
    }, { status: 500 });
  }
}