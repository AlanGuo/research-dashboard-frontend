'use client';

import { useState, useEffect } from 'react';
import { GliChart } from '@/components/gli/gli-chart';
import { GliParams } from '@/components/gli/gli-params';
import { GliTrendTable } from '@/components/gli/gli-trend-table';
import { GliBenchmarkTrendTable } from '@/components/gli/gli-benchmark-trend-table';
import { GliDataPoint, GliParams as GliParamsType, GliResponse, TrendPeriod } from '@/types/gli';
import type { HowellLiquidityDataPoint } from '@/types/howell-liquidity';

export default function GliDashboard() {
  const [data, setData] = useState<GliDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [trendPeriods, setTrendPeriods] = useState<{
    centralBankTrendPeriods: TrendPeriod[];
    m2TrendPeriods: TrendPeriod[];
  }>({ centralBankTrendPeriods: [], m2TrendPeriods: [] });
  
  // Howell Liquidity 数据状态
  const [howellLiquidityData, setHowellLiquidityData] = useState<HowellLiquidityDataPoint[]>([]);
  const [, setLoadingHowellData] = useState<boolean>(false);

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
    usa_active: true,
    europe_active: true,
    china_active: true,
    japan_active: true,
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
  
  // 获取GLI趋势时段数据 - 在API参数变化时重新获取
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    
    const fetchTrendPeriods = async () => {
      try {
        // 构建查询参数 - 与GLI数据请求保持一致
        const queryParams = new URLSearchParams();
        
        Object.entries(apiParams).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, value.toString());
          }
        });
        
        // 直接请求API路由
        const url = `/api/gli/trend-periods${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        const response = await fetch(url, { signal });
        
        if (!response.ok) {
          throw new Error('获取趋势时段数据失败');
        }
        
        const result = await response.json();
        if (result.success && result.data && result.data.centralBankTrendPeriods && result.data.m2TrendPeriods) {
          setTrendPeriods({
            centralBankTrendPeriods: result.data.centralBankTrendPeriods,
            m2TrendPeriods: result.data.m2TrendPeriods
          });
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
  }, [apiParams]); // 仅在API参数变化时重新获取数据

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
  
  // 获取 Howell Liquidity 数据
  useEffect(() => {
    const fetchHowellLiquidityData = async () => {
      try {
        setLoadingHowellData(true);
        const response = await fetch('/api/howell-liquidity');
        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.data && Array.isArray(data.data)) {
          setHowellLiquidityData(data.data);
        }
      } catch (err) {
        console.error('获取Howell Liquidity数据失败:', err);
        // 不设置错误状态，因为这是一个附加功能，不应影响主图表
      } finally {
        setLoadingHowellData(false);
      }
    };
    
    fetchHowellLiquidityData();
  }, []); // 只在组件挂载时获取一次数据
  
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
  
  return (
    <>
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
          
          {/* 当选择了对比标的时，显示对比标的趋势表格 */}
          {currentParams.benchmark !== 'none' && (
            <div className="bg-background rounded-lg p-6 pb-2 shadow-sm">
              <GliBenchmarkTrendTable 
                trendPeriods={trendPeriods} 
                benchmark={currentParams.benchmark}
                offset={currentParams.offset}
                interval={currentParams.interval}
              />
            </div>
          )}

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
                  <div className="flex-1 overflow-hidden">
                    <div className="h-full overflow-auto">
                      <GliChart 
                        data={data} 
                        params={currentParams} 
                        trendPeriods={trendPeriods} 
                        howellLiquidityData={howellLiquidityData} 
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-hidden">
                  <div className="h-full overflow-auto">
                    <GliChart 
                      data={data} 
                      params={currentParams} 
                      trendPeriods={trendPeriods} 
                      howellLiquidityData={howellLiquidityData} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* 趋势表格 - 显示各资产在不同趋势时期的表现 */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-auto">
              <GliTrendTable trendPeriods={trendPeriods} benchmark={currentParams.benchmark} offset={currentParams.offset} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
