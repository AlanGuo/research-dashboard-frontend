'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { GliParams as GliParamsType, BenchmarkType, TimeRangeType } from '@/types/gli';

interface GliParamsProps {
  onParamsChange: (params: GliParamsType) => void;
}

export function GliParams({ onParamsChange }: GliParamsProps) {
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
    interval: '1D',
    timeRange: '1y', // 默认时间范围为1年
    limit: 365
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
    const newParams = { ...params, [name]: parseInt(value) };
    setParams(newParams);
    onParamsChange(newParams);
  };

  // 当组件挂载时，立即应用默认参数
  useEffect(() => {
    // 触发初始数据加载
    onParamsChange(params);
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
                    <SelectItem value="btcusdt">Bitcoin (BTCUSDT)</SelectItem>
                    <SelectItem value="gold">黄金 (Gold)</SelectItem>
                    <SelectItem value="ndx">Nasdaq (NDX)</SelectItem>
                    <SelectItem value="spx">S&P 500 (SPX)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="interval">时间间隔</Label>
                <Select 
                  value={params.interval} 
                  onValueChange={(value) => handleSelectChange('interval', value)}
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
                  onValueChange={(value) => handleSelectChange('timeRange', value)}
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
              
              {/* <div className="space-y-2">
                <Label htmlFor="limit">数据点数量</Label>
                <Input
                  type="number"
                  id="limit"
                  value={params.limit}
                  onChange={(e) => handleNumberChange('limit', e.target.value)}
                  min={1}
                  disabled={true} // 禁用输入，由时间范围和时间间隔自动计算
                />
                <p className="text-xs text-gray-500 mt-1">根据时间间隔和时间范围自动计算</p>
              </div> */}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
