'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TradingFeesControlProps {
  spotFeeRate: number;
  futuresFeeRate: number;
  onSpotFeeChange: (value: number) => void;
  onFuturesFeeChange: (value: number) => void;
  disabled?: boolean;
}

export const TradingFeesControl = memo(function TradingFeesControl({
  spotFeeRate,
  futuresFeeRate,
  onSpotFeeChange,
  onFuturesFeeChange,
  disabled = false
}: TradingFeesControlProps) {
  // 独立的显示状态 - 完全隔离，不受其他参数影响
  const [displaySpotFee, setDisplaySpotFee] = useState<string>(spotFeeRate.toString());
  const [displayFuturesFee, setDisplayFuturesFee] = useState<string>(futuresFeeRate.toString());

  // 防抖定时器 - 使用 useRef 避免重新创建函数
  const spotDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const futuresDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化显示值（只在组件挂载时同步一次）
  useEffect(() => {
    setDisplaySpotFee(spotFeeRate.toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  useEffect(() => {
    setDisplayFuturesFee(futuresFeeRate.toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  // 现货手续费处理函数 - 完全隔离，不影响其他参数
  const handleSpotFeeChange = useCallback((value: string) => {
    console.log('现货手续费显示值变化:', value);
    
    // 立即更新显示值
    setDisplaySpotFee(value);
    
    // 清除之前的防抖定时器
    if (spotDebounceTimerRef.current) {
      clearTimeout(spotDebounceTimerRef.current);
      spotDebounceTimerRef.current = null;
    }
    
    // 设置新的防抖定时器
    spotDebounceTimerRef.current = setTimeout(() => {
      const numericValue = parseFloat(value) || 0;
      
      // 基础验证：必须在0-1%之间
      if (numericValue >= 0 && numericValue <= 0.01) {
        console.log('现货手续费实际值更新:', numericValue);
        onSpotFeeChange(numericValue);
      }
      spotDebounceTimerRef.current = null;
    }, 300); // 300ms 防抖
  }, [onSpotFeeChange]);

  // 期货手续费处理函数 - 完全隔离，不影响其他参数
  const handleFuturesFeeChange = useCallback((value: string) => {
    console.log('期货手续费显示值变化:', value);
    
    // 立即更新显示值
    setDisplayFuturesFee(value);
    
    // 清除之前的防抖定时器
    if (futuresDebounceTimerRef.current) {
      clearTimeout(futuresDebounceTimerRef.current);
      futuresDebounceTimerRef.current = null;
    }
    
    // 设置新的防抖定时器
    futuresDebounceTimerRef.current = setTimeout(() => {
      const numericValue = parseFloat(value) || 0;
      
      // 基础验证：必须在0-1%之间
      if (numericValue >= 0 && numericValue <= 0.01) {
        console.log('期货手续费实际值更新:', numericValue);
        onFuturesFeeChange(numericValue);
      }
      futuresDebounceTimerRef.current = null;
    }, 300); // 300ms 防抖
  }, [onFuturesFeeChange]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (spotDebounceTimerRef.current) {
        clearTimeout(spotDebounceTimerRef.current);
      }
      if (futuresDebounceTimerRef.current) {
        clearTimeout(futuresDebounceTimerRef.current);
      }
    };
  }, []);

  // 计算显示的百分比值
  const spotFeePercent = (parseFloat(displaySpotFee) || 0) * 100;
  const futuresFeePercent = (parseFloat(displayFuturesFee) || 0) * 100;

  return (
    <div className="space-y-3 p-4 rounded-lg border">
      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">交易手续费率配置</Label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 现货手续费 */}
        <div className="space-y-2">
          <Label htmlFor="spotTradingFeeRate" className="text-xs font-medium text-blue-700 dark:text-blue-400">
            现货手续费率 <span className="text-gray-400 dark:text-gray-500">(BTC交易使用)</span>
          </Label>
          <div className="flex items-center space-x-3">
            <Input
              id="spotTradingFeeRate"
              type="number"
              step="0.0001"
              min="0"
              max="0.01"
              value={displaySpotFee}
              onChange={(e) => handleSpotFeeChange(e.target.value)}
              className="flex-1"
              placeholder="0.0008"
              disabled={disabled}
            />
            <span className="text-xs font-medium w-16 text-right bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
              {spotFeePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* 期货手续费 */}
        <div className="space-y-2">
          <Label htmlFor="futuresTradingFeeRate" className="text-xs font-medium text-red-700 dark:text-red-400">
            期货手续费率 <span className="text-gray-400 dark:text-gray-500">(做空ALT使用)</span>
          </Label>
          <div className="flex items-center space-x-3">
            <Input
              id="futuresTradingFeeRate"
              type="number"
              step="0.0001"
              min="0"
              max="0.01"
              value={displayFuturesFee}
              onChange={(e) => handleFuturesFeeChange(e.target.value)}
              className="flex-1"
              placeholder="0.0002"
              disabled={disabled}
            />
            <span className="text-xs font-medium w-16 text-right bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
              {futuresFeePercent.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">现货手续费通常高于期货手续费</p>
    </div>
  );
});
