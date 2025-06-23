'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InitialCapitalControlProps {
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

export const InitialCapitalControl = memo(function InitialCapitalControl({
  value,
  onValueChange,
  disabled = false
}: InitialCapitalControlProps) {
  const [displayValue, setDisplayValue] = useState<string>(Math.round(value).toString());

  // 防抖定时器 - 使用 useRef 避免重新创建函数
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  console.log('InitialCapitalControl render:', {
    propsValue: value,
    displayValue: displayValue,
    isInteger: Number.isInteger(value),
    rounded: Math.round(value)
  });

  // 初始化显示值（只在组件挂载时同步一次）
  useEffect(() => {
    const roundedValue = Math.round(value);
    setDisplayValue(roundedValue.toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  // 初始本金处理函数 - 完全隔离，不影响其他参数
  const handleValueChange = useCallback((inputValue: string) => {
    console.log('初始本金显示值变化:', inputValue, '当前显示值:', displayValue);
    
    // 立即更新显示值
    setDisplayValue(inputValue);
    
    // 清除之前的防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // 设置新的防抖定时器
    debounceTimerRef.current = setTimeout(() => {
      const numericValue = parseFloat(inputValue) || 0;
      
      // 基础验证：必须为正数
      if (numericValue > 0) {
        console.log('初始本金实际值更新:', numericValue, '步长变化:', numericValue - parseFloat(displayValue || '0'));
        onValueChange(numericValue);
        // 注意：不在这里更新 lastExternalValueRef，让 useEffect 来处理
      } else if (numericValue === 0 && inputValue === '') {
        // 允许清空，设为默认值
        console.log('初始本金清空，设为默认值: 10000');
        onValueChange(10000);
      }
      debounceTimerRef.current = null;
    }, 300); // 300ms 防抖
  }, [onValueChange]);

  // 同步外部值变化 - 优化版本
  useEffect(() => {
    const newDisplayValue = value.toString();
    
    console.log('InitialCapital useEffect:', {
      value,
      displayValue,
      isInteger: Number.isInteger(value)
    });
    
    // 只在外部值真正变化且不同于当前输入值时才更新显示值
    const isExternalChange = Math.abs(value - parseFloat(displayValue || '0')) > 0.001;
    
    // 只有当外部值变化时，才更新显示值
    if (isExternalChange) {
      console.log('InitialCapital: 外部值变化，更新显示值', newDisplayValue);
      setDisplayValue(newDisplayValue);
    }
  }, [value, displayValue]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      <Label htmlFor="initialCapital">初始本金 (USDT)</Label>
      <Input
        id="initialCapital"
        type="number"
        min="0"
        step="1000"
        value={displayValue}
        onChange={(e) => handleValueChange(e.target.value)}
        className="w-full"
        placeholder="10000"
        disabled={disabled}
      />
    </div>
  );
});
