import { NextResponse } from 'next/server';
import config from '@/config';

export async function GET() {
  try {
    // 使用内部API获取GLI趋势时段数据
    const apiBaseUrl = config.api?.baseUrl;
    const url = `${apiBaseUrl}/gli/trend-periods`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`GLI趋势时段API请求失败: ${response.status}`);
    }
    
    const trendData = await response.json();
    
    return NextResponse.json({
      ...trendData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取GLI趋势时段数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取GLI趋势时段数据失败',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
