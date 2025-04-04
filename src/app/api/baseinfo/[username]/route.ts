import { NextRequest, NextResponse } from 'next/server';
import config from '@/config';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  // 获取URL中的username参数
  const { username } = await context.params;
  
  try {
    const apiBaseUrl = config.api?.baseUrl || 'http://localhost:3001/v1';
    const response = await fetch(`${apiBaseUrl}/baseinfo/${username}`);
    
    if (!response.ok) {
      throw new Error(`Base info API请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error(`获取${username}基础信息失败:`, error);
    return NextResponse.json(
      {
        success: false,
        error: `获取${username}基础信息失败`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
