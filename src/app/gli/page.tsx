'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GliChart } from '@/components/gli/gli-chart';
import { GliParams } from '@/components/gli/gli-params';
import { GliDataPoint, GliParams as GliParamsType } from '@/types/gli';
import { fetchGliData } from '@/app/api/gli';

export default function GliDashboard() {
  const [data, setData] = useState<GliDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('chart');

  const fetchData = async (params?: GliParamsType) => {
    try {
      setLoading(true);
      
      // 使用封装的API服务获取数据
      const result = await fetchGliData(params);
      
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch GLI data');
      }
    } catch (err) {
      setError('Error connecting to GLI API');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">全球流动性指数</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>全球流动性指数仪表盘</CardTitle>
          <CardDescription>
            监控来自各国央行和货币供应的全球流动性数据
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="chart" onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="chart">图表</TabsTrigger>
              <TabsTrigger value="params">参数</TabsTrigger>
            </TabsList>
            
            <TabsContent value="chart" className="space-y-4">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <p className="text-lg">加载数据中...</p>
                </div>
              ) : error ? (
                <div className="flex justify-center items-center h-64">
                  <p className="text-red-500">{error}</p>
                </div>
              ) : (
                <GliChart data={data} />
              )}
            </TabsContent>
            
            <TabsContent value="params">
              <GliParams onParamsChange={fetchData} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
