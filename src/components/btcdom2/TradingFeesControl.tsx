'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { devConsole } from '@/utils/devLogger';

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
  // 完全自管理的显示状态
  const [displaySpotFee, setDisplaySpotFee] = useState<string>(spotFeeRate.toString());
  const [displayFuturesFee, setDisplayFuturesFee] = useState<string>(futuresFeeRate.toString());

  // 防抖定时器
  const spotDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const futuresDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 记录上次外部传入的值，避免循环更新
  const lastSpotExternalValueRef = useRef<number>(spotFeeRate);
  const lastFuturesExternalValueRef = useRef<number>(futuresFeeRate);

  devConsole.log('🔄 TradingFeesControl render:', {
    propsSpotValue: spotFeeRate,
    propsFuturesValue: futuresFeeRate,
    displaySpotValue: displaySpotFee,
    displayFuturesValue: displayFuturesFee,
    lastSpotExternal: lastSpotExternalValueRef.current,
    lastFuturesExternal: lastFuturesExternalValueRef.current
  });

  // 现货手续费处理函数
  const handleSpotFeeChange = useCallback((inputValue: string) => {
    devConsole.log('⌨️  现货手续费用户输入:', inputValue, '当前显示值:', displaySpotFee);
    
    // 立即更新显示值，保证UI响应性
    setDisplaySpotFee(inputValue);
    
    // 清除之前的防抖定时器
    if (spotDebounceTimerRef.current) {
      clearTimeout(spotDebounceTimerRef.current);
      devConsole.log('⏱️  清除现货手续费防抖定时器');
    }
    
    // 防抖处理：延迟通知父组件
    spotDebounceTimerRef.current = setTimeout(() => {
      const numericValue = parseFloat(inputValue);
      
      devConsole.log('🚀 现货手续费防抖触发，处理数值:', numericValue);
      
      // 验证并通知父组件
      if (!isNaN(numericValue) && numericValue >= 0 && numericValue <= 0.01) {
        // 更新记录值，避免下次外部值同步时覆盖用户输入
        lastSpotExternalValueRef.current = numericValue;
        devConsole.log('✅ 通知父组件更新现货手续费:', numericValue);
        onSpotFeeChange(numericValue);
      } else {
        devConsole.log('❌ 现货手续费值无效，跳过通知');
      }
    }, 300);
  }, [onSpotFeeChange, displaySpotFee]);

  // 期货手续费处理函数
  const handleFuturesFeeChange = useCallback((inputValue: string) => {
    devConsole.log('⌨️  期货手续费用户输入:', inputValue, '当前显示值:', displayFuturesFee);
    
    // 立即更新显示值，保证UI响应性
    setDisplayFuturesFee(inputValue);
    
    // 清除之前的防抖定时器
    if (futuresDebounceTimerRef.current) {
      clearTimeout(futuresDebounceTimerRef.current);
      devConsole.log('⏱️  清除期货手续费防抖定时器');
    }
    
    // 防抖处理：延迟通知父组件
    futuresDebounceTimerRef.current = setTimeout(() => {
      const numericValue = parseFloat(inputValue);
      
      devConsole.log('🚀 期货手续费防抖触发，处理数值:', numericValue);
      
      // 验证并通知父组件
      if (!isNaN(numericValue) && numericValue >= 0 && numericValue <= 0.01) {
        // 更新记录值，避免下次外部值同步时覆盖用户输入
        lastFuturesExternalValueRef.current = numericValue;
        devConsole.log('✅ 通知父组件更新期货手续费:', numericValue);
        onFuturesFeeChange(numericValue);
      } else {
        devConsole.log('❌ 期货手续费值无效，跳过通知');
      }
    }, 300);
  }, [onFuturesFeeChange, displayFuturesFee]);

  // 只在外部值真正变化时同步（避免用户输入时被覆盖）
  useEffect(() => {
    devConsole.log('📥 现货手续费外部值同步检查:', {
      newValue: spotFeeRate,
      lastExternal: lastSpotExternalValueRef.current,
      difference: Math.abs(spotFeeRate - lastSpotExternalValueRef.current)
    });
    
    // 只有当外部值与记录值不同时才更新显示值
    if (Math.abs(spotFeeRate - lastSpotExternalValueRef.current) > 0.0001) {
      devConsole.log('🔄 现货手续费外部值变化，更新显示值:', spotFeeRate);
      setDisplaySpotFee(spotFeeRate.toString());
      lastSpotExternalValueRef.current = spotFeeRate;
    } else {
      devConsole.log('⏭️  现货手续费外部值未变化，跳过更新');
    }
  }, [spotFeeRate]);

  useEffect(() => {
    devConsole.log('📥 期货手续费外部值同步检查:', {
      newValue: futuresFeeRate,
      lastExternal: lastFuturesExternalValueRef.current,
      difference: Math.abs(futuresFeeRate - lastFuturesExternalValueRef.current)
    });
    
    // 只有当外部值与记录值不同时才更新显示值
    if (Math.abs(futuresFeeRate - lastFuturesExternalValueRef.current) > 0.0001) {
      devConsole.log('🔄 期货手续费外部值变化，更新显示值:', futuresFeeRate);
      setDisplayFuturesFee(futuresFeeRate.toString());
      lastFuturesExternalValueRef.current = futuresFeeRate;
    } else {
      devConsole.log('⏭️  期货手续费外部值未变化，跳过更新');
    }
  }, [futuresFeeRate]);

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
