'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';

interface TemperatureRuleControlProps {
  enabled: boolean;
  symbol: string;
  threshold: number;
  onEnabledChange: (enabled: boolean) => void;
  onSymbolChange: (symbol: string) => void;
  onThresholdChange: (threshold: number) => void;
  disabled?: boolean;
}

export function TemperatureRuleControl({
  enabled,
  symbol,
  threshold,
  onEnabledChange,
  onSymbolChange,
  onThresholdChange,
  disabled = false
}: TemperatureRuleControlProps) {
  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      onThresholdChange(value);
    }
  };

  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSymbolChange(e.target.value);
  };

  return (
    <Card className="border-gray-200 dark:border-gray-700">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* 温度计规则开关 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                启用温度计规则
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                当温度计高于阈值时，强制清空所有空头仓位
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={onEnabledChange}
              disabled={disabled}
            />
          </div>

          {/* 温度计配置 - 只在启用时显示 */}
          {enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 监控Symbol */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    监控Symbol
                  </Label>
                  <Input
                    type="text"
                    value={symbol}
                    onChange={handleSymbolChange}
                    disabled={disabled}
                    placeholder="OTHERS"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    默认: OTHERS (cryptos exclude top 10)
                  </p>
                </div>

                {/* 温度计阈值 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    温度计阈值
                  </Label>
                  <Input
                    type="number"
                    value={threshold}
                    onChange={handleThresholdChange}
                    disabled={disabled}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    范围: 0-100，步长: 5
                  </p>
                </div>
              </div>

              {/* 规则说明 */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>规则说明:</strong><br/>
                  • 温度计高于阈值时：不持有任何空头仓位，已有的全部卖掉<br/>
                  • 温度计低于阈值时：可以正常开空仓<br/>
                  • 温度计数据在执行回测时获取，使用回测的起止日期
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}