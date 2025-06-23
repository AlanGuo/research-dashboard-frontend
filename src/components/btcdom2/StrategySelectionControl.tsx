'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Bitcoin, ArrowDown } from 'lucide-react';

interface StrategySelectionControlProps {
  longBtc: boolean;
  shortAlt: boolean;
  btcRatio: number;
  onLongBtcChange: (value: boolean) => void;
  onShortAltChange: (value: boolean) => void;
  disabled?: boolean;
}

export const StrategySelectionControl = memo(function StrategySelectionControl({
  longBtc,
  shortAlt,
  btcRatio,
  onLongBtcChange,
  onShortAltChange,
  disabled = false
}: StrategySelectionControlProps) {
  // 独立的显示状态 - 完全隔离，不受其他参数影响
  const [displayLongBtc, setDisplayLongBtc] = useState<boolean>(longBtc);
  const [displayShortAlt, setDisplayShortAlt] = useState<boolean>(shortAlt);

  // 防抖定时器 - 使用 useRef 避免重新创建函数
  const longBtcDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const shortAltDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化显示值（只在组件挂载时同步一次）
  useEffect(() => {
    setDisplayLongBtc(longBtc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  useEffect(() => {
    setDisplayShortAlt(shortAlt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  // 做多BTC处理函数 - 完全隔离，不影响其他参数
  const handleLongBtcChange = useCallback((checked: boolean) => {
    console.log('做多BTC显示值变化:', checked);
    
    // 立即更新显示值
    setDisplayLongBtc(checked);
    
    // 清除之前的防抖定时器
    if (longBtcDebounceTimerRef.current) {
      clearTimeout(longBtcDebounceTimerRef.current);
      longBtcDebounceTimerRef.current = null;
    }
    
    // 设置新的防抖定时器
    longBtcDebounceTimerRef.current = setTimeout(() => {
      console.log('做多BTC实际值更新:', checked);
      onLongBtcChange(checked);
      longBtcDebounceTimerRef.current = null;
    }, 150); // 150ms 防抖，复选框响应要快一些
  }, [onLongBtcChange]);

  // 做空ALT处理函数 - 完全隔离，不影响其他参数
  const handleShortAltChange = useCallback((checked: boolean) => {
    console.log('做空ALT显示值变化:', checked);
    
    // 立即更新显示值
    setDisplayShortAlt(checked);
    
    // 清除之前的防抖定时器
    if (shortAltDebounceTimerRef.current) {
      clearTimeout(shortAltDebounceTimerRef.current);
      shortAltDebounceTimerRef.current = null;
    }
    
    // 设置新的防抖定时器
    shortAltDebounceTimerRef.current = setTimeout(() => {
      console.log('做空ALT实际值更新:', checked);
      onShortAltChange(checked);
      shortAltDebounceTimerRef.current = null;
    }, 150); // 150ms 防抖，复选框响应要快一些
  }, [onShortAltChange]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (longBtcDebounceTimerRef.current) {
        clearTimeout(longBtcDebounceTimerRef.current);
      }
      if (shortAltDebounceTimerRef.current) {
        clearTimeout(shortAltDebounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">策略组合选择</h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Checkbox
            id="longBtc"
            checked={displayLongBtc}
            onCheckedChange={handleLongBtcChange}
            disabled={disabled}
          />
          <div className="flex-1">
            <Label htmlFor="longBtc" className="font-medium cursor-pointer flex items-center gap-2">
              <Bitcoin className="w-4 h-4 text-orange-500" />
              做多 BTC
            </Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              配置资金的{(btcRatio * 100).toFixed(0)}%用于做多BTC
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Checkbox
            id="shortAlt"
            checked={displayShortAlt}
            onCheckedChange={handleShortAltChange}
            disabled={disabled}
          />
          <div className="flex-1">
            <Label htmlFor="shortAlt" className="font-medium cursor-pointer flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-red-500" />
              做空 ALT币
            </Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              配置资金的{((1 - btcRatio) * 100).toFixed(0)}%用于做空山寨币
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
