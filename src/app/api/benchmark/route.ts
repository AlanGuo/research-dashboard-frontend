import config from '@/config/index';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiBaseUrl = config.api?.baseUrl;
    const url = `${apiBaseUrl}/v1/benchmark`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error fetching benchmarks: ${response.statusText}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch benchmarks:', error);
    return NextResponse.json({ error: 'Failed to fetch benchmarks' }, { status: 500 });
  }
}
