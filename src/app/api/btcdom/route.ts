import { NextRequest, NextResponse } from 'next/server';
import config from '@/config/index';
import { BtcDomResponse } from '@/types/btcdom';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sortField = searchParams.get('sortField');
    const direction = searchParams.get('direction') || 'ascending';
    
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (sortField) {
      queryParams.append('sortField', sortField);
    }
    queryParams.append('direction', direction);
    
    // 调用后端BTCDOM API
    const apiBaseUrl = config.api?.baseUrl;
    const url = `${apiBaseUrl}/v1/btcdom${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`后端API请求失败: ${response.status}`);
    }
    
    const result: BtcDomResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '获取BTCDOM策略数据失败');
    }
    
    return NextResponse.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('获取BTCDOM策略数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取BTCDOM策略数据失败',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}