import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:4001';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 从查询参数中获取参数
    const startTimestamp = searchParams.get('startTimestamp');
    const endTimestamp = searchParams.get('endTimestamp');
    const marketDataTimestamp = searchParams.get('marketDataTimestamp');

    // 构建后端API URL
    const backendUrl = new URL(`${BACKEND_BASE_URL}/v1/btcdom2/trading-logs`);
    
    // 添加查询参数
    if (startTimestamp) {
      backendUrl.searchParams.set('startTimestamp', startTimestamp);
    }
    if (endTimestamp) {
      backendUrl.searchParams.set('endTimestamp', endTimestamp);
    }
    if (marketDataTimestamp) {
      backendUrl.searchParams.set('marketDataTimestamp', marketDataTimestamp);
    }

    // 调用后端API
    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // 设置超时
      signal: AbortSignal.timeout(30000), // 30秒超时
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error(`[Trading Logs API] 后端API错误 (${backendResponse.status}):`, errorText);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `后端API调用失败: ${backendResponse.status}`,
          details: errorText
        },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[Trading Logs API] API调用异常:', error);
    
    let errorMessage = '获取交易日志失败';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
        errorMessage = '后端API调用超时';
        statusCode = 504;
      } else if ('code' in error && error.code === 'ECONNREFUSED') {
        errorMessage = '无法连接到后端服务';
        statusCode = 503;
      } else {
        errorMessage = `API调用失败: ${error.message}`;
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: error instanceof Error ? error.message : String(error)
      },
      { status: statusCode }
    );
  }
}