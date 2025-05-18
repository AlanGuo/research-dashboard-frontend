import { NextResponse } from 'next/server';
import config from '@/config';

export async function GET(request: Request) {
  try {  
    // 从 URL 参数中获取趋势类型
    const { searchParams } = new URL(request.url);
    const trendType = searchParams.get('trendType') || 'centralBank'; // 默认为央行趋势
    
    // 使用内部API获取资产趋势数据
    const apiBaseUrl = config.api?.baseUrl;
    const url = `${apiBaseUrl}/v1/asset-trend?trendType=${encodeURIComponent(trendType)}`;
    
    const response = await fetch(url);
    
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