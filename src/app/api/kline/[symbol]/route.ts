import { NextRequest, NextResponse } from 'next/server';
import config from '@/config';

export async function GET(
  request: NextRequest,
  context: { params: { symbol: string } }
) {
  // 获取URL中的symbol参数
  const { symbol } = await context.params;
  const symbolLower = symbol.toLowerCase();
  
  // 获取查询参数
  const searchParams = request.nextUrl.searchParams;
  const interval = searchParams.get('interval') || '1D';
  const bars = parseInt(searchParams.get('bars') || '100', 10);
  
  try {
    // 使用内部的kline API获取数据
    const apiBaseUrl = config.api?.baseUrl || 'http://localhost:3001/api';
    const response = await fetch(`${apiBaseUrl}/kline/${symbolLower}?interval=${interval}&bars=${bars}`);
    
    if (!response.ok) {
      throw new Error(`Kline API请求失败: ${response.status}`);
    }
    
    const klineData = await response.json();
    
    return NextResponse.json(klineData);
  } catch (error) {
    console.error(`获取${symbol}K线数据失败:`, error);
    return NextResponse.json(
      {
        success: false,
        error: `获取${symbol}K线数据失败`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
