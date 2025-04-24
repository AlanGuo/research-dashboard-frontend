'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { GliParams as GliParamsType } from '@/types/gli';
import { fetchGliData } from '@/app/api/gli';

interface GliParamsProps {
  onParamsChange: (params: GliParamsType) => void;
}

export function GliParams({ onParamsChange }: GliParamsProps) {
  const [params, setParams] = useState<GliParamsType>({
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
    interval: '1D',
    limit: 365
  });

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setParams(prev => ({ ...prev, [name]: checked }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (name: string, value: string) => {
    setParams(prev => ({ ...prev, [name]: parseInt(value) }));
  };

  // 当组件挂载时，立即应用默认参数
  useEffect(() => {
    // 触发初始数据加载
    handleApplyParams();
  }, []);

  const handleApplyParams = async () => {
    try {
      // 使用封装的API服务获取数据
      const result = await fetchGliData(params);
      
      if (result.success) {
        onParamsChange(params);
      } else {
        console.error('Error fetching GLI data:', result.error);
      }
    } catch (err) {
      console.error('Error applying GLI parameters:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleApplyParams();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-lg font-medium">央行数据</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="fed_active" 
                  checked={params.fed_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('fed_active', checked)}
                />
                <Label htmlFor="fed_active">美联储 (FED)</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="rrp_active" 
                  checked={params.rrp_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('rrp_active', checked)}
                />
                <Label htmlFor="rrp_active">逆回购 (RRP)</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="tga_active" 
                  checked={params.tga_active} 
                  onCheckedChange={(checked: boolean) => handleCheckboxChange('tga_active', checked)}
                />
                <Label htmlFor="tga_active">财政部账户 (TGA)</Label>
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
                <Label htmlFor="limit">数据点数量</Label>
                <Input
                  type="number"
                  id="limit"
                  value={params.limit}
                  onChange={(e) => handleNumberChange('limit', e.target.value)}
                  min={1}
                  max={365}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-end">
        <Button type="submit">
          应用参数
        </Button>
      </div>
    </form>
  );
}
