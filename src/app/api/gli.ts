import { GliParams, GliResponse, GliDataPoint } from '@/types/gli';

const API_BASE_URL = 'http://localhost:3001/v1';

/**
 * 获取全球流动性指数数据
 * @param params GLI参数
 * @returns 处理后的响应数据
 */
export async function fetchGliData(params?: GliParams): Promise<{
  success: boolean;
  data: GliDataPoint[];
  error?: string;
}> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    // 构建URL
    const url = `${API_BASE_URL}/gli${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    // 发送请求
    const response = await fetch(url);
    const result: GliResponse = await response.json();
    
    if (result.success && result.data) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        data: [],
        error: result.error || '获取GLI数据失败'
      };
    }
  } catch (err) {
    console.error('Error connecting to GLI API:', err);
    return {
      success: false,
      data: [],
      error: '连接GLI API时发生错误'
    };
  }
}
