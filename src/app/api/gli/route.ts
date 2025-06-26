import { NextRequest, NextResponse } from 'next/server';
import config from '@/config/index';
import { GliParams } from '@/types/gli';

export async function GET(
  request: NextRequest
) {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const params: Partial<GliParams> = {};
    
    // 从查询参数中提取GLI参数
    // 布尔值参数
    ['fed_active', 'rrp_active', 'tga_active', 'ecb_active', 'pbc_active', 'boj_active', 
     'other_active', 'usa_active', 'europe_active', 'china_active', 'japan_active', 'other_m2_active'].forEach(key => {
      const value = searchParams.get(key);
      if (value !== null) {
        (params as Record<string, boolean | number | string>)[key] = value === 'true';
      }
    });
    
    // 数值参数
    ['limit', 'from'].forEach(key => {
      const value = searchParams.get(key);
      if (value !== null) {
        (params as Record<string, boolean | number | string>)[key] = Number(value);
      }
    });
    
    // 字符串参数
    ['interval'].forEach(key => {
      const value = searchParams.get(key);
      if (value !== null) {
        (params as Record<string, boolean | number | string>)[key] = value;
      }
    });
    
    // 构建查询参数
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
    
    // 使用内部API获取GLI数据
    const apiBaseUrl = config.api?.baseUrl;
    const url = `${apiBaseUrl}/v1/gli${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`GLI API请求失败: ${response.status}`);
    }
    
    const gliData = await response.json();
    
    return NextResponse.json({
      ...gliData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取GLI数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取GLI数据失败',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
