'use client';

import React, { useState, useCallback, useRef, memo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { devConsole } from '@/utils/devLogger';

interface TemperatureRuleControlProps {
  enabled: boolean;
  symbol: string;
  threshold: number;
  timeframe: string;
  onEnabledChange: (enabled: boolean) => void;
  onSymbolChange: (symbol: string) => void;
  onThresholdChange: (threshold: number) => void;
  onTimeframeChange: (timeframe: string) => void;
  disabled?: boolean;
}

export const TemperatureRuleControl = memo<TemperatureRuleControlProps>(({
  enabled,
  symbol,
  threshold,
  timeframe,
  onEnabledChange,
  onSymbolChange,
  onThresholdChange,
  onTimeframeChange,
  disabled = false
}: TemperatureRuleControlProps) => {
  // Symbol 本地状态和防抖
  const [displaySymbol, setDisplaySymbol] = useState<string>(symbol);
  const symbolDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastExternalSymbolRef = useRef<string>(symbol);
  const isInternalSymbolChangeRef = useRef<boolean>(false);

  // Threshold 本地状态和防抖
  const [displayThreshold, setDisplayThreshold] = useState<number>(threshold);
  const thresholdDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastExternalThresholdRef = useRef<number>(threshold);
  const isInternalThresholdChangeRef = useRef<boolean>(false);

  devConsole.log('🔄 TemperatureRuleControl render:', {
    propsSymbol: symbol,
    displaySymbol: displaySymbol,
    propsThreshold: threshold,
    displayThreshold: displayThreshold,
    propsTimeframe: timeframe
  });

  // Symbol 防抖处理
  const handleSymbolChange = useCallback((inputValue: string) => {
    devConsole.log('⌨️  Symbol用户输入:', inputValue);
    
    isInternalSymbolChangeRef.current = true;
    setDisplaySymbol(inputValue);
    
    if (symbolDebounceTimerRef.current) {
      clearTimeout(symbolDebounceTimerRef.current);
      symbolDebounceTimerRef.current = null;
    }

    symbolDebounceTimerRef.current = setTimeout(() => {
      devConsole.log('🚀 Symbol防抖触发:', inputValue);
      
      if (inputValue !== lastExternalSymbolRef.current) {
        lastExternalSymbolRef.current = inputValue;
        devConsole.log('✅ 通知父组件Symbol更新:', inputValue);
        onSymbolChange(inputValue);
      } else {
        devConsole.log('⏭️  Symbol值未变化，跳过通知');
      }
      
      symbolDebounceTimerRef.current = null;
    }, 300);
  }, [onSymbolChange]);

  // Threshold 防抖处理
  const handleThresholdChange = useCallback((inputValue: string) => {
    devConsole.log('⌨️  Threshold用户输入:', inputValue);
    
    const numValue = parseFloat(inputValue) || 0;
    const clampedValue = Math.min(Math.max(numValue, 0), 100);
    
    isInternalThresholdChangeRef.current = true;
    setDisplayThreshold(clampedValue);
    
    if (thresholdDebounceTimerRef.current) {
      clearTimeout(thresholdDebounceTimerRef.current);
      thresholdDebounceTimerRef.current = null;
    }

    thresholdDebounceTimerRef.current = setTimeout(() => {
      devConsole.log('🚀 Threshold防抖触发:', clampedValue);
      
      if (Math.abs(clampedValue - lastExternalThresholdRef.current) > 0.001) {
        lastExternalThresholdRef.current = clampedValue;
        devConsole.log('✅ 通知父组件Threshold更新:', clampedValue);
        onThresholdChange(clampedValue);
      } else {
        devConsole.log('⏭️  Threshold值未变化，跳过通知');
      }
      
      thresholdDebounceTimerRef.current = null;
    }, 300);
  }, [onThresholdChange]);

  // 同步外部Symbol变化
  React.useEffect(() => {
    if (symbol !== lastExternalSymbolRef.current && !isInternalSymbolChangeRef.current) {
      devConsole.log('🔄 外部Symbol变化，更新显示值:', symbol);
      setDisplaySymbol(symbol);
      lastExternalSymbolRef.current = symbol;
    } else if (isInternalSymbolChangeRef.current && symbol === lastExternalSymbolRef.current) {
      isInternalSymbolChangeRef.current = false;
    }
  }, [symbol]);

  // 同步外部Threshold变化
  React.useEffect(() => {
    if (Math.abs(threshold - lastExternalThresholdRef.current) > 0.001 && !isInternalThresholdChangeRef.current) {
      devConsole.log('🔄 外部Threshold变化，更新显示值:', threshold);
      setDisplayThreshold(threshold);
      lastExternalThresholdRef.current = threshold;
    } else if (isInternalThresholdChangeRef.current && Math.abs(threshold - lastExternalThresholdRef.current) <= 0.001) {
      isInternalThresholdChangeRef.current = false;
    }
  }, [threshold]);

  // 清理定时器
  React.useEffect(() => {
    return () => {
      if (symbolDebounceTimerRef.current) {
        clearTimeout(symbolDebounceTimerRef.current);
      }
      if (thresholdDebounceTimerRef.current) {
        clearTimeout(thresholdDebounceTimerRef.current);
      }
    };
  }, []);

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 监控Symbol */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    监控Symbol
                  </Label>
                  <Input
                    type="text"
                    value={displaySymbol}
                    onChange={(e) => handleSymbolChange(e.target.value)}
                    disabled={disabled}
                    placeholder="OTHERS"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    默认: OTHERS (cryptos exclude top 10)
                  </p>
                </div>

                {/* 时间间隔 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    时间间隔
                  </Label>
                  <Select
                    value={timeframe}
                    onValueChange={onTimeframeChange}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择时间间隔" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8H">8小时 (8H)</SelectItem>
                      <SelectItem value="1D">1天 (1D)</SelectItem>
                      <SelectItem value="1W">1周 (1W)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    8H: 与上一个8小时对比，1D: 与上一天对比，1W: 与上一周对比
                  </p>
                </div>

                {/* 温度计阈值 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    温度计阈值
                  </Label>
                  <Input
                    type="number"
                    value={displayThreshold}
                    onChange={(e) => handleThresholdChange(e.target.value)}
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
                  • <strong>8H模式:</strong> 与上一个8小时的温度计数值对比判断阈值<br/>
                  • <strong>1D模式:</strong> 与上一天的温度计数值对比判断阈值<br/>
                  • 温度计数据在执行回测时获取，使用回测的起止日期
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

TemperatureRuleControl.displayName = 'TemperatureRuleControl';