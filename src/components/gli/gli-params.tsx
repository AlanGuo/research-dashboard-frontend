'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GliParams as GliParamsType, BenchmarkType, TimeRangeType } from '@/types/gli';
import type { BenchmarkAsset } from '@/types/benchmark';

interface GliParamsProps {
  onParamsChange: (params: GliParamsType) => void;
}

export function GliParams({ onParamsChange }: GliParamsProps) {
  // 保存从API获取的对比标的列表
  const [, setBenchmarks] = useState<BenchmarkAsset[]>([]);
  // 保存对比标的分类
  const [benchmarkCategories, setBenchmarkCategories] = useState<{[key: string]: BenchmarkAsset[]}>({});
  // 加载状态
  const [loading, setLoading] = useState(false);
  
  // 从API获取对比标的的列表
  useEffect(() => {
    const fetchBenchmarks = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/benchmark');
        if (response.ok) {
          const data = await response.json();
          setBenchmarks(data);
          
          // 按类别分组
          const categorized: {[key: string]: BenchmarkAsset[]} = {};
          data.forEach((benchmark: BenchmarkAsset) => {
            if (!categorized[benchmark.category]) {
              categorized[benchmark.category] = [];
            }
            categorized[benchmark.category].push(benchmark);
          });
          setBenchmarkCategories(categorized);
        } else {
          console.error('Failed to fetch benchmarks');
        }
      } catch (error) {
        console.error('Error fetching benchmarks:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBenchmarks();
  }, []);
  
  // 获取分类的中文名称
  const getCategoryName = (category: string): string => {
    const categoryNames: {[key: string]: string} = {
      'crypto': '加密货币',
      'precious_metals': '贵金属',
      'commodities': '大宗商品',
      'us_indices': '美国指数',
      'bonds': '债券',
      'asia_indices': '亚洲指数',
      'europe_indices': '欧洲指数'
    };
    return categoryNames[category] || category;
  };
  
  const [params, setParams] = useState<GliParamsType>({
    // 添加美元净流动性控制
    unl_active: true,
    // 默认开启这三项，但将由unl_active控制
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
    // 添加对比标的，默认为无
    benchmark: 'none',
    interval: '1W',  // 默认时间间隔为一周
    timeRange: '10y', // 默认时间范围为10年
    limit: 520,
    offset: 0  // 默认偏移为0
  });

  const handleCheckboxChange = (name: string, checked: boolean) => {
    let newParams = { ...params, [name]: checked };
    
    // 如果是美元净流动性复选框发生变化
    if (name === 'unl_active') {
      // 联动设置 FED、RRP 和 TGA
      newParams = {
        ...newParams,
        fed_active: checked,
        rrp_active: checked,
        tga_active: checked
      };
    }
    
    // 如果是单独的 FED、RRP 或 TGA 复选框，不允许单独更改
    // 这里实际上不会执行，因为我们将禁用这些复选框
    
    setParams(newParams);
    onParamsChange(newParams);
  };

  // 根据时间间隔和时间范围计算limit
  const calculateLimit = (interval: string, timeRange: TimeRangeType): number => {
    // 各个时间间隔的一年数据点数量
    const pointsPerYear = {
      '1D': 365, // 日线，一年约365个数据点
      '1W': 52,  // 周线，一年约52个数据点
      '1M': 12   // 月线，一年约12个数据点
    };
    
    // 各个时间范围的年数
    const years = {
      '1y': 1,
      '3y': 3,
      '5y': 5,
      '10y': 10,
      '20y': 20
    };
    
    // 计算数据点数量
    const basePoints = pointsPerYear[interval as keyof typeof pointsPerYear] || 365;
    const yearMultiplier = years[timeRange];
    
    return basePoints * yearMultiplier;
  };

  const handleSelectChange = (name: string, value: string) => {
    let newParams = { ...params, [name]: value };
    
    // 如果时间间隔或时间范围变化，自动计算limit
    if (name === 'interval' || name === 'timeRange') {
      const interval = name === 'interval' ? value : (params.interval || '1D');
      const timeRange = name === 'timeRange' ? value as TimeRangeType : (params.timeRange as TimeRangeType || '1y');
      
      const newLimit = calculateLimit(interval, timeRange);
      newParams = { ...newParams, limit: newLimit };
    }
    
    setParams(newParams);
    onParamsChange(newParams);
  };
  
  // 处理对比标的选择变化
  const handleBenchmarkChange = (value: string) => {
    const newParams = { ...params, benchmark: value as BenchmarkType };
    setParams(newParams);
    onParamsChange(newParams);
  };

  const handleNumberChange = (name: string, value: string) => {
    // 确保输入是有效数字
    const numValue = value === '' ? 0 : parseInt(value);
    if (!isNaN(numValue)) {
      const newParams = { ...params, [name]: numValue };
      setParams(newParams);
      onParamsChange(newParams);
    }
  };

  // 移除这个useEffect钩子，因为它会在组件挂载时自动触发参数变化
  // 现在我们只在用户主动改变参数时才触发onParamsChange

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-lg font-medium">央行数据</h3>
            
            <div className="space-y-4">
              {/* 添加美元净流动性复选框 */}
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="unl_active" 
                  checked={params.unl_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('unl_active', checked)}
                />
                <Label htmlFor="unl_active" className="font-medium">美元净流动性 (UNL)</Label>
              </div>
              
              {/* 下面三项由UNL控制，显示但禁用 */}
              <div className="ml-6 space-y-2 border-l-2 pl-4 border-gray-200">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="fed_active" 
                    checked={params.fed_active} 
                    disabled={true}
                    onCheckedChange={(checked: boolean) => handleCheckboxChange('fed_active', checked)}
                  />
                  <Label htmlFor="fed_active" className="text-gray-500">美联储 (FED)</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="rrp_active" 
                    checked={params.rrp_active} 
                    disabled={true}
                    onCheckedChange={(checked: boolean) => handleCheckboxChange('rrp_active', checked)}
                  />
                  <Label htmlFor="rrp_active" className="text-gray-500">逆回购 (RRP)</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="tga_active" 
                    checked={params.tga_active} 
                    disabled={true}
                    onCheckedChange={(checked: boolean) => handleCheckboxChange('tga_active', checked)}
                  />
                  <Label htmlFor="tga_active" className="text-gray-500">财政部账户 (TGA)</Label>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="ecb_active" 
                  checked={params.ecb_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('ecb_active', checked)}
                />
                <Label htmlFor="ecb_active">欧洲央行 (ECB)</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="pbc_active" 
                  checked={params.pbc_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('pbc_active', checked)}
                />
                <Label htmlFor="pbc_active">中国人民银行 (PBC)</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="boj_active" 
                  checked={params.boj_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('boj_active', checked)}
                />
                <Label htmlFor="boj_active">日本银行 (BOJ)</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="other_active" 
                  checked={params.other_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('other_active', checked)}
                />
                <Label htmlFor="other_active">其他央行</Label>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-lg font-medium">货币供应</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="usa_active" 
                  checked={params.usa_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('usa_active', checked)}
                />
                <Label htmlFor="usa_active">美国 M2</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="europe_active" 
                  checked={params.europe_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('europe_active', checked)}
                />
                <Label htmlFor="europe_active">欧洲 M2</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="china_active" 
                  checked={params.china_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('china_active', checked)}
                />
                <Label htmlFor="china_active">中国 M2</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="japan_active" 
                  checked={params.japan_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('japan_active', checked)}
                />
                <Label htmlFor="japan_active">日本 M2</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="other_m2_active" 
                  checked={params.other_m2_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('other_m2_active', checked)}
                />
                <Label htmlFor="other_m2_active">其他国家 M2</Label>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-lg font-medium">数据设置</h3>
            
            <div className="space-y-4">

              <div className="space-y-2">
                <Label htmlFor="interval">时间间隔</Label>
                <Select 
                  value={params.interval} 
                  onValueChange={(value: string) => handleSelectChange('interval', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择时间间隔" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1D">日 (1D)</SelectItem>
                    <SelectItem value="1W">周 (1W)</SelectItem>
                    <SelectItem value="1M">月 (1M)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="timeRange">时间范围</Label>
                <Select 
                  value={params.timeRange || '1y'} 
                  onValueChange={(value: string) => handleSelectChange('timeRange', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择时间范围" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1y">1 年</SelectItem>
                    <SelectItem value="3y">3 年</SelectItem>
                    <SelectItem value="5y">5 年</SelectItem>
                    <SelectItem value="10y">10 年</SelectItem>
                    <SelectItem value="20y">20 年</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* 添加对比标的选择 */}
              <div className="space-y-2">
                <Label htmlFor="benchmark">对比标的</Label>
                <Select 
                  value={params.benchmark || 'none'} 
                  onValueChange={handleBenchmarkChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择对比标的" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无</SelectItem>
                    
                    {loading ? (
                      <SelectItem value="loading" disabled>加载中...</SelectItem>
                    ) : (
                      Object.entries(benchmarkCategories).map(([category, items]) => (
                        <div key={category}>
                          {/* 显示分类标题 */}
                          <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                            {getCategoryName(category)}
                          </div>
                          {/* 显示该分类下的所有对比标的 */}
                          {items.map((benchmark) => (
                            <SelectItem key={benchmark.id} value={benchmark.id}>
                              {benchmark.name} ({benchmark.symbol})
                            </SelectItem>
                          ))}
                        </div>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* 添加时间偏移控制 */}
              {params.benchmark && params.benchmark !== 'none' && (
                <div className="space-y-2 border p-3 rounded-md mt-4">
                  <Label htmlFor="offset" className="font-medium">领先时间设置</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Input
                      type="number"
                      id="offset"
                      value={params.offset || 0}
                      onChange={(e) => handleNumberChange('offset', e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-gray-700">个{params.interval || '1W'}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    正数：GLI领先{params.benchmark} | 负数：GLI滞后{params.benchmark}
                  </p>
                </div>
              )}

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
