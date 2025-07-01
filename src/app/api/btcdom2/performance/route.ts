import { NextRequest, NextResponse } from 'next/server';
import config from '@/config/index';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 获取查询参数
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') || 'timestamp';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const limit = searchParams.get('limit');
    const count = searchParams.get('count');
    const endpoint = searchParams.get('endpoint') || 'all'; // all, latest, statistics, by-market-timestamp

    // 构建后端API URL
    const apiBaseUrl = config.api?.baseUrl;
    if (!apiBaseUrl) {
      throw new Error('API base URL not configured');
    }

    let backendUrl = `${apiBaseUrl}/v1/btcdom2/performance`;
    
    // 根据endpoint构建不同的URL
    switch (endpoint) {
      case 'latest':
        backendUrl += '/latest';
        break;
      case 'statistics':
        backendUrl += '/statistics';
        break;
      case 'by-market-timestamp':
        backendUrl += '/by-market-timestamp';
        break;
      case 'all':
      default:
        // 保持基础URL
        break;
    }

    // 构建查询参数
    const queryParams = new URLSearchParams();
    
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    if (sortBy) queryParams.append('sortBy', sortBy);
    if (sortOrder) queryParams.append('sortOrder', sortOrder);
    if (limit) queryParams.append('limit', limit);
    if (count) queryParams.append('count', count);

    // 添加查询参数到URL
    if (queryParams.toString()) {
      backendUrl += `?${queryParams.toString()}`;
    }

    console.log('调用后端实盘API:', backendUrl);

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
    console.error('实盘数据API错误:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取实盘数据失败'
    }, { status: 500 });
  }
}
