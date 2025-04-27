import { NextResponse } from 'next/server';
import config from '@/config';

export async function GET() {
  try {  
    // 使用内部API获取资产趋势数据
    const apiBaseUrl = config.api?.baseUrl;
    const url = `${apiBaseUrl}/asset-trend`;
    
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