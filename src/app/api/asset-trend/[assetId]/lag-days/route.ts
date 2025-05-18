import { NextRequest, NextResponse } from 'next/server';
import config from '@/config';

/**
 * 临时计算资产在特定滞后天数下的趋势表现，不更新数据库
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await context.params;
    
    // 从 URL 参数中获取间隔类型、数量和趋势类型
    const { searchParams } = new URL(request.url);
    const intervalType = searchParams.get('intervalType');
    const intervalCountStr = searchParams.get('intervalCount');
    const intervalCount = intervalCountStr ? parseInt(intervalCountStr, 10) : undefined;
    const trendType = searchParams.get('trendType') || 'centralBank'; // 默认为央行趋势
    
    if (!intervalType || intervalCount === undefined || isNaN(intervalCount)) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数或参数格式不正确',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }
    
    // 使用内部API临时计算资产在特定滞后天数下的趋势表现
    const apiBaseUrl = config.api?.baseUrl;
    const url = `${apiBaseUrl}/v1/asset-trend/${assetId}/lag-days`;
    
    // 构建带查询参数的URL
    const queryUrl = `${url}?intervalType=${encodeURIComponent(intervalType)}&intervalCount=${intervalCount}&trendType=${encodeURIComponent(trendType)}`;
    
    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      cache: 'no-store' // 不缓存结果
    });
    
    if (!response.ok) {
      throw new Error(`计算资产 ${assetId} 在特定滞后天数下的趋势表现失败: ${response.status}`);
    }
    
    const result = await response.json();
    
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('计算资产趋势表现失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '计算资产趋势表现失败',
        message: error instanceof Error ? error.message : String(error),
        data: null,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
