import { NextRequest, NextResponse } from 'next/server';
import config from '@/config';

export async function GET(
  request: NextRequest
) {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const count = searchParams.get('count');
    
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (count) {
      queryParams.append('count', count);
    }
    
    // 使用内部API获取Howell Liquidity数据
    const apiBaseUrl = config.api?.baseUrl;
    const url = `${apiBaseUrl}/v1/howell-liquidity${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Howell Liquidity API请求失败: ${response.status}`);
    }
    
    const liquidityData = await response.json();
    
    // 处理数据，为每个数据点添加timestamp
    if (liquidityData.data && Array.isArray(liquidityData.data)) {
      liquidityData.data = liquidityData.data.map((point: { date: string; [key: string]: any }) => {
        return {
          ...point,
          timestamp: parseDate(point.date).getTime()
        };
      });
    }
    
    return NextResponse.json({
      ...liquidityData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取Howell Liquidity数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取Howell Liquidity数据失败',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * 解析日期字符串为Date对象
 * @param dateStr 日期字符串，格式为 YYYY-MM-DD 或 YYYY-MM
 */
function parseDate(dateStr: string): Date {
  if (dateStr.includes('-')) {
    // 处理 YYYY-MM-DD 或 YYYY-MM 格式
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD 格式
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (parts.length === 2) {
      // YYYY-MM 格式
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    }
  }
  
  // 默认返回当前日期
  console.warn(`无法解析日期格式: ${dateStr}`);
  return new Date();
}
