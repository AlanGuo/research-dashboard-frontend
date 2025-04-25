'use client';

import { useState, useEffect } from 'react';
import { GliChart } from '@/components/gli/gli-chart';
import { GliParams } from '@/components/gli/gli-params';
import { GliDataPoint, GliParams as GliParamsType, GliResponse, TrendPeriod } from '@/types/gli';

export default function GliDashboard() {
  const [data, setData] = useState<GliDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [trendPeriods, setTrendPeriods] = useState<TrendPeriod[]>([]);
  // 添加参数状态
  const [currentParams, setCurrentParams] = useState<GliParamsType>({
    unl_active: true,
    fed_active: true,
    rrp_active: true,
    tga_active: true,
    ecb_active: true,
    pbc_active: true,
    boj_active: true,
    other_active: false,
    usa_active: false,
    europe_active: false,
    china_active: false,
    japan_active: false,
    other_m2_active: false,
    benchmark: 'none',
    interval: '1W',
    timeRange: '10y',
    limit: 520,
    offset: 0
  });

  // 获取GLI趋势时段数据 - 只获取一次
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    
    const fetchTrendPeriods = async () => {
      try {
        const response = await fetch('/api/gli/trend-periods', { signal });
        if (!response.ok) {
          throw new Error('获取趋势时段数据失败');
        }
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setTrendPeriods(result.data);
        }
      } catch (err) {
        // 如果不是因为终止而导致的错误，才记录日志
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('获取趋势时段数据出错:', err);
        }
      }
    };
    
    fetchTrendPeriods();
    
    return () => {
      controller.abort();
    };
  }, []);

  // 使用useEffect来处理参数变化和数据获取
  useEffect(() => {
    const fetchGliData = async () => {
      try {
        setLoading(true);
        
        // 构建查询参数
        const queryParams = new URLSearchParams();
        
        Object.entries(currentParams).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, value.toString());
          }
        });
        
        // 直接请求API路由
        const url = `/api/gli${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        const response = await fetch(url);
        const result: GliResponse = await response.json();
        
        if (result.success && result.data) {
          setData(result.data);
          setError(null);
        } else {
          setError(result.error || '获取GLI数据失败');
        }
      } catch (err) {
        setError('连接GLI API时发生错误');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGliData();
  }, [currentParams]); // 仅在参数变化时重新获取数据
  
  // 更新参数的处理函数
  const handleParamsChange = (params: GliParamsType) => {
    setCurrentParams(params);
  };

  // 不再在组件加载时调用fetchData()
  // 因为GliParams组件会在挂载时通过onParamsChange触发带参数的fetchData调用
  // 这样可以避免初始时发送一个不带参数的冗余请求

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">全球流动性指数</h1>
      
      <div className="mb-8">
        <p className="text-gray-600 mb-6">
          监控来自各国央行和货币供应的全球流动性数据
        </p>
        
        {/* 参数选择放在图表上方 */}
        <div className="mb-8 rounded-lg">
          <h3 className="text-lg font-medium mb-4">参数设置</h3>
          <GliParams onParamsChange={handleParamsChange} />
        </div>
        
        {/* 图表显示 */}
        <div className="mt-8">
          {loading ? (
            <div className="flex justify-center items-center h-64 bg-white rounded-lg">
              <p className="text-lg">加载数据中...</p>
            </div>
          ) : error ? (
            <div className="flex justify-center items-center h-64 bg-white rounded-lg">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg">
              <GliChart data={data} params={currentParams} trendPeriods={trendPeriods} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
