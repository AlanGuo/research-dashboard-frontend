import { NextRequest, NextResponse } from 'next/server';
import config from '@/config/index';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 获取查询参数
    const symbol = searchParams.get('symbol') || 'OTHERS';
    const timeframe = searchParams.get('timeframe') || '1D';
    const startDate = searchParams.get('startDate') || '2020-01-01T00:00:00.000Z';
    const endDate = searchParams.get('endDate') || new Date().toISOString();
    const threshold = searchParams.get('threshold') || '60';

    // 构建后端API URL
    const apiBaseUrl = config.api?.baseUrl;
    if (!apiBaseUrl) {
      throw new Error('API base URL not configured');
    }

    const backendUrl = `${apiBaseUrl}/v1/btcdom/temperature-periods?` +
      `symbol=${encodeURIComponent(symbol)}&` +
      `timeframe=${encodeURIComponent(timeframe)}&` +
      `startDate=${encodeURIComponent(startDate)}&` +
      `endDate=${encodeURIComponent(endDate)}&` +
      `threshold=${encodeURIComponent(threshold)}`;

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
    console.error('Temperature periods API error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}