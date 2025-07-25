import config from '@/config/index';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const apiBaseUrl = config.api?.baseUrl;
    const url = `${apiBaseUrl}/v1/benchmark`;
    const response = await fetch(`${url}/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: `Benchmark with ID ${id} not found` }, { status: 404 });
      }
      throw new Error(`Error fetching benchmark: ${response.statusText}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch benchmark:', error);
    return NextResponse.json({ error: 'Failed to fetch benchmark' }, { status: 500 });
  }
}
