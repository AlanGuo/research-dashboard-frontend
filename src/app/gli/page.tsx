'use client';

import { useState, useEffect } from 'react';
import { GliChart } from '@/components/gli/gli-chart';
import { GliParams } from '@/components/gli/gli-params';
import { GliTrendTable } from '@/components/gli/gli-trend-table';
import { GliDataPoint, GliParams as GliParamsType, GliResponse, TrendPeriod } from '@/types/gli';

export default function GliDashboard() {
  const [data, setData] = useState<GliDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [trendPeriods, setTrendPeriods] = useState<TrendPeriod[]>([]);

  // 将参数分为两部分：API参数（需要重新请求数据）和UI参数（只影响显示）
  const [apiParams, setApiParams] = useState<Omit<GliParamsType, 'offset' | 'invertBenchmarkYAxis' | 'benchmark'>>({    
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
    interval: '1W',
    timeRange: '10y' as GliParamsType['timeRange'],
    limit: 520
  });
  
  // UI参数（不需要重新请求API）
  const [uiParams, setUiParams] = useState<Pick<GliParamsType, 'offset' | 'invertBenchmarkYAxis' | 'benchmark'>>({    
    offset: 0,
    invertBenchmarkYAxis: false,
    benchmark: 'none' as GliParamsType['benchmark']
  });
  
  // 合并两种参数，用于传递给子组件
  const currentParams: GliParamsType = {
    ...apiParams,
    ...uiParams
  };


  // 监听 UI 参数变化的自定义事件
  useEffect(() => {
    // 处理 UI 参数变化事件
    const handleUiParamsChange = (event: CustomEvent) => {
      const { name, value } = event.detail;
      
      // 更新 UI 参数
      setUiParams(prev => ({
        ...prev,
        [name]: value
      }));
    };
    
    // 添加事件监听器
    window.addEventListener('ui-params-change', handleUiParamsChange as EventListener);
    
    // 清理函数
    return () => {
      window.removeEventListener('ui-params-change', handleUiParamsChange as EventListener);
    };
  }, []);
  
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

  // 使用useEffect来处理API参数变化和数据获取
  useEffect(() => {
    const fetchGliData = async () => {
      try {
        setLoading(true);
        
        // 构建查询参数 - 只包含API参数
        const queryParams = new URLSearchParams();
        
        Object.entries(apiParams).forEach(([key, value]) => {
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
  }, [apiParams]); // 仅在API参数变化时重新获取数据
  
  // 更新参数的处理函数
  const handleParamsChange = (params: GliParamsType) => {
    // 分离API参数和UI参数
    const { offset, invertBenchmarkYAxis, benchmark, ...restParams } = params;
    
    // 更新UI参数（不触发API请求）
    setUiParams({ 
      offset: offset !== undefined ? offset : 0, 
      invertBenchmarkYAxis: invertBenchmarkYAxis !== undefined ? invertBenchmarkYAxis : false,
      benchmark: benchmark || 'none' as GliParamsType['benchmark']
    });
    
    // 更新API参数（会触发API请求）
    setApiParams(restParams as Omit<GliParamsType, 'offset' | 'invertBenchmarkYAxis' | 'benchmark'>);
  };

  // 不再在组件加载时调用fetchData()
  // 因为GliParams组件会在挂载时通过onParamsChange触发带参数的fetchData调用
  // 这样可以避免初始时发送一个不带参数的冗余请求

  return (
    <div className="container mx-auto p-6 max-w-[1920px]">
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
        <div className="mt-8 mb-12">
          <div className="bg-background rounded-lg transition-colors">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-[800px] gap-2">
                <div className="h-5 w-5 border-t-2 border-primary rounded-full animate-spin"></div>
                <p className="text-muted-foreground">图表加载中...</p>
              </div>
            ) : error ? (
              <div className="flex justify-center items-center h-[800px]">
                <p className="text-red-500">{error}</p>
              </div>
            ) : (
              <GliChart data={data} params={currentParams} trendPeriods={trendPeriods} />
            )}
          </div>
        </div>
        
        {/* 趋势表格 - 显示各资产在不同趋势时期的表现 */}
        <div className="mt-12 bg-background rounded-lg p-6 shadow-sm">
          <GliTrendTable 
            trendPeriods={trendPeriods} 
            benchmark={currentParams.benchmark} 
          />
        </div>
      </div>
    </div>
  );
}
