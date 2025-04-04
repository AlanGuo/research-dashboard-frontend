import { NextRequest, NextResponse } from 'next/server';
import config from '@/config';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  // 获取URL中的username参数
  const { username } = await context.params;
  
  // 获取查询参数
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const except = searchParams.get('except');
  
  try {
    const apiBaseUrl = config.api?.baseUrl || 'http://localhost:3001/api';
    let url = `${apiBaseUrl}/holding/${username}`;
    
    // 构建查询参数
    const params = new URLSearchParams();
    
    // 如果有status参数，添加到查询参数
    if (status) {
      params.append('status', status);
    }
    
    // 如果有except参数，添加到查询参数
    if (except) {
      params.append('except', except);
    }
    
    // 如果有查询参数，添加到URL
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Holding API请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error(`获取${username}持仓数据失败:`, error);
    return NextResponse.json(
      {
        success: false,
        error: `获取${username}持仓数据失败`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
