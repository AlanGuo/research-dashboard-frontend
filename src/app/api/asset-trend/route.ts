import { NextRequest, NextResponse } from 'next/server';
import config from '@/config';

export async function GET(
  request: NextRequest
) {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const forceUpdate = searchParams.get('forceUpdate');
    
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (forceUpdate) {
      queryParams.append('forceUpdate', forceUpdate);
    }
    
    // 使用内部API获取资产趋势数据
    const apiBaseUrl = config.api?.baseUrl;
    const url = `${apiBaseUrl}/asset-trend${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    console.log(`Fetching asset trend data from: ${url}`);
    
    const response = await fetch(url, {
      next: { revalidate: 3600 } // 缓存1小时
    });
    
    if (!response.ok) {
      throw new Error(`Asset Trend API请求失败: ${response.status}`);
    }
    
    const assetTrendData = await response.json();
    
    return NextResponse.json({
      ...assetTrendData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取资产趋势数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取资产趋势数据失败',
        data: [],
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}