import { NextRequest, NextResponse } from 'next/server';
import config from '@/config';

export async function GET(
  request: NextRequest,
  context: { params: { symbol: string } }
) {
  // 获取URL中的symbol参数
  const { symbol } = await context.params;
  const symbolLower = symbol.toLowerCase();
  
  try {
    // 将币种符号转换为交易对格式
    const pair = `${symbolLower}`;
    
    // 使用内部的kline API获取数据
    const apiBaseUrl = config.api?.baseUrl || 'http://localhost:3001/api';
    const response = await fetch(`${apiBaseUrl}/kline/${pair}?interval=1D&bars=8`); // 获取7天+今天的数据
    
    if (!response.ok) {
      throw new Error(`Kline API请求失败: ${response.status}`);
    }
    
    const klineData = await response.json();
    
    if (!klineData.success || !klineData.data || !klineData.data.candles || klineData.data.candles.length < 8) {
      throw new Error(`无法获取${symbol}的K线数据或数据不足`);
    }
    
    // 将K线数据按时间排序（从早到晚）
    const sortedCandles = [...klineData.data.candles].sort((a, b) => {
      return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
    });
    
    // 使用最新的收盘价作为当前价格
    const latestCandle = sortedCandles[sortedCandles.length - 1];
    const previousDayCandle = sortedCandles[sortedCandles.length - 2];
    const sevenDaysAgoCandle = sortedCandles[0]; // 第一个应该是7天前的数据
    
    // 计算24小时和7天价格变化百分比
    const price = latestCandle.close;
    const previousDayPrice = previousDayCandle.close;
    const sevenDaysAgoPrice = sevenDaysAgoCandle.close;
    
    const priceChange24h = ((price - previousDayPrice) / previousDayPrice) * 100;
    const priceChange7d = ((price - sevenDaysAgoPrice) / sevenDaysAgoPrice) * 100;
    
    return NextResponse.json({
      success: true,
      data: {
        symbol: symbolLower,
        price,
        priceChange24h,
        priceChange7d: priceChange7d,
        lastUpdated: latestCandle.datetime
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`获取${symbol}价格数据失败:`, error);
    return NextResponse.json(
      {
        success: false,
        error: `获取${symbol}价格数据失败`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
