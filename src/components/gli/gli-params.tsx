'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [benchmarks, setBenchmarks] = useState<BenchmarkAsset[]>([]);
  // 保存对比标的分类
  const [benchmarkCategories, setBenchmarkCategories] = useState<{[key: string]: BenchmarkAsset[]}>({});
  // 加载状态
  const [loading, setLoading] = useState(false);
  
  // 使用 useRef 来跟踪是否已经加载过对比标的数据
  const benchmarksLoaded = useRef(false);
  
  // 从API获取对比标的的列表，只在组件首次挂载时获取一次
  useEffect(() => {
    // 如果已经加载过，不再重复加载
    if (benchmarksLoaded.current) return;
    
    const fetchBenchmarks = async () => {
      setLoading(true);
      try {
        console.log('Fetching benchmark list from API...');
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
          
          // 标记为已加载
          benchmarksLoaded.current = true;
          console.log('Benchmark list loaded and cached');
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
    offset: 13,  // 默认偏移为13w
    invertBenchmarkYAxis: false // 默认不反转Y轴
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
    
    // 更新本地状态
    setParams(newParams);
    
    // 对于 invertBenchmarkYAxis 参数，使用特殊处理避免触发 API 请求
    if (name === 'invertBenchmarkYAxis') {
      // 创建一个事件，通知父组件 UI 参数变化
      const event = new CustomEvent('ui-params-change', { 
        detail: { name, value: checked } 
      });
      window.dispatchEvent(event);
    } else {
      // 其他参数正常处理
      onParamsChange(newParams);
    }
  };

  // 根据时间间隔和时间范围计算limit
  const calculateLimit = (interval: string, timeRange: TimeRangeType): number => {
    // 计算每年的数据点数量
    let pointsPerYear = 0;
    switch (interval) {
      case '1D':
        pointsPerYear = 365; // 日线，每年约365个数据点
        break;
      case '1W':
        pointsPerYear = 52;  // 周线，每年约52个数据点
        break;
      case '1M':
        pointsPerYear = 12;  // 月线，每年约12个数据点
        break;
      default:
        pointsPerYear = 52;  // 默认使用周线
    }
    
    // 根据时间范围计算总数据点数量
    let years = 0;
    switch (timeRange) {
      case '1y': years = 1; break;
      case '3y': years = 3; break;
      case '5y': years = 5; break;
      case '10y': years = 10; break;
      case '20y': years = 20; break;
      default: years = 10; // 默认10年
    }
    
    return Math.ceil(pointsPerYear * years);
  };
  
  // 根据lagDays和时间间隔计算offset
  const calculateOffsetFromLagDays = (lagDays: number, interval: string): number => {
    // 根据不同的时间间隔，将lagDays转换为对应的offset
    switch (interval) {
      case '1D':
        return lagDays; // 日线，offset直接等于lagDays
      case '1W':
        return Math.round(lagDays / 7); // 周线，将天数转换为周数
      case '1M':
        return Math.round(lagDays / 30); // 月线，将天数转换为月数（近似）
      default:
        return Math.round(lagDays / 7); // 默认按周线处理
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    let newParams = { ...params, [name]: value };
    
    // 如果时间间隔或时间范围变化，自动计算limit
    if (name === 'interval' || name === 'timeRange') {
      const interval = name === 'interval' ? value : (params.interval || '1D');
      const timeRange = name === 'timeRange' ? value as TimeRangeType : (params.timeRange as TimeRangeType || '1y');
      const newLimit = calculateLimit(interval, timeRange);
      newParams = { ...newParams, limit: newLimit };
      
      // 如果时间间隔变化且有选择对比标的，重新计算offset
      if (name === 'interval' && params.benchmark && params.benchmark !== 'none') {
        const selectedBenchmark = benchmarks.find(b => b.id === params.benchmark);
        if (selectedBenchmark) {
          const offsetValue = calculateOffsetFromLagDays(selectedBenchmark.lagDays, interval);
          newParams = { ...newParams, offset: offsetValue };
        }
      }
    }
    
    setParams(newParams);
    onParamsChange(newParams);
  };
  
  // 处理对比标的选择变化
  const handleBenchmarkChange = (value: string) => {
    let newParams = { ...params, benchmark: value as BenchmarkType };
    
    // 如果选择了对比标的，根据lagDays自动计算offset
    if (value !== 'none') {
      const selectedBenchmark = benchmarks.find(b => b.id === value);
      if (selectedBenchmark) {
        // 根据当前interval计算offset
        const offsetValue = calculateOffsetFromLagDays(selectedBenchmark.lagDays, params.interval || '1W');
        newParams = { ...newParams, offset: offsetValue };
      }
    }
    
    setParams(newParams);
    onParamsChange(newParams);
    
    // 使用自定义事件通知父组件，避免触发 GLI 数据的重新请求
    const event = new CustomEvent('ui-params-change', { 
      detail: { name: 'benchmark', value: value } 
    });
    window.dispatchEvent(event);
  };

  // 添加防抖定时器引用
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [updatingLagDays, setUpdatingLagDays] = useState(false);
  
  const handleNumberChange = (name: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      // 更新本地状态立即显示
      const newParams = { ...params, [name]: numValue };
      setParams(newParams);
      
      // 如果是 offset 参数，使用特殊处理避免触发 API 请求
      if (name === 'offset') {
        // 清除之前的定时器
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        
        // 设置新的定时器，使用自定义事件通知父组件
        debounceTimerRef.current = setTimeout(() => {
          // 创建一个事件，通知父组件 UI 参数变化
          const event = new CustomEvent('ui-params-change', { 
            detail: { name, value: numValue } 
          });
          window.dispatchEvent(event);
          
          // 如果选择了对比标的，则更新该标的的lagDays并重新计算趋势表现
          if (params.benchmark && params.benchmark !== 'none') {
            updateAssetLagDays(params.benchmark, params.interval || '1W', numValue);
          }
        }, 500); // 减少延迟时间，提高响应速度
      } else {
        // 其他参数立即更新
        onParamsChange(newParams);
      }
    }
  };
  
  // 触发事件，请求计算资产在特定滞后天数下的趋势表现
  const updateAssetLagDays = (assetId: string, intervalType: string, intervalCount: number) => {
    if (updatingLagDays) return; // 避免重复请求
    
    try {
      setUpdatingLagDays(true);
      
      // 创建一个事件，通知趋势表格组件计算并更新数据
      const event = new CustomEvent('asset-trend-update-request', {
        detail: { 
          assetId,
          intervalType,
          intervalCount
        }
      });
      
      // 触发事件
      window.dispatchEvent(event);
      console.log(`已发送请求，计算资产 ${assetId} 在 ${intervalType} 间隔下偏移 ${intervalCount} 个单位的趋势表现`);
    } catch (error) {
      console.error('发送计算请求出错:', error);
    } finally {
      // 等待一小段时间再允许发送新请求，避免过快触发
      setTimeout(() => {
        setUpdatingLagDays(false);
      }, 300);
    }
  };

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
                  <Label htmlFor="offset" className="font-medium">滞后时间设置</Label>
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
                  正数：{params.benchmark}滞后GLI | 负数：{params.benchmark}领先GLI
                  </p>
                  
                  {/* 添加Y轴反转复选框 */}
                  <div className="flex items-center space-x-2 mt-4">
                    <Checkbox
                      id="invertBenchmarkYAxis"
                      checked={params.invertBenchmarkYAxis || false}
                      onCheckedChange={(checked) => handleCheckboxChange('invertBenchmarkYAxis', checked === true)}
                    />
                    <Label htmlFor="invertBenchmarkYAxis" className="text-sm">反转对比标的Y轴</Label>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    反转后可以更直观地显示负相关性
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
