import { NextRequest, NextResponse } from 'next/server';
import config from '@/config';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  // 获取URL中的symbol参数
  const { symbol } = await context.params;
  const symbolLower = symbol.toLowerCase();
  
  // 获取查询参数 - 日期数组
  const searchParams = request.nextUrl.searchParams;
  const dates = searchParams.getAll('dates[]');
  
  if (!dates || dates.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: '未提供日期参数',
        timestamp: new Date().toISOString()
      },
      { status: 400 }
    );
  }
  
  try {
    // 使用内部的kline API获取数据
    const apiBaseUrl = config.api?.baseUrl || 'http://localhost:3001/v1';
    
    // 构建日期查询参数
    const dateParams = dates.map(date => `dates[]=${encodeURIComponent(date)}`).join('&');
    const url = `${apiBaseUrl}/kline/${symbolLower}/exact-dates?${dateParams}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Exact dates API请求失败: ${response.status}`);
    }
    
    const priceData = await response.json();
    
    return NextResponse.json(priceData);
  } catch (error) {
    console.error(`获取${symbol}精确日期价格数据失败:`, error);
    return NextResponse.json(
      {
        success: false,
        error: `获取${symbol}精确日期价格数据失败`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
