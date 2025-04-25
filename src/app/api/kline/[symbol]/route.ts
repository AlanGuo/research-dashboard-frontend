import { NextRequest, NextResponse } from 'next/server';
import config from '@/config';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  // 获取URL中的symbol参数
  const { symbol } = await context.params;
  const symbolLower = symbol.toLowerCase();
  
  // 获取查询参数
  const searchParams = request.nextUrl.searchParams;
  const interval = searchParams.get('interval') || '1D';
  const bars = parseInt(searchParams.get('bars') || '1', 10);
  const from = searchParams.get('from'); // 新增from参数，表示开始时间戳
  
  try {
    // 使用内部的kline API获取数据
    const apiBaseUrl = config.api?.baseUrl;
    let url = `${apiBaseUrl}/kline/${symbolLower}?interval=${interval}&bars=${bars}`;
    
    // 如果提供了from参数，添加到请求URL中
    if (from) {
      url += `&from=${from}`;
    }
    
    const response = await fetch(url);
    
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
