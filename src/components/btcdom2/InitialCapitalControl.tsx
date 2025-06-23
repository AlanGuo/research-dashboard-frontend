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
  // 完全自管理的显示状态
  const [displayValue, setDisplayValue] = useState<string>(value.toString());
  
  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 记录上次外部传入的值，避免循环更新
  const lastExternalValueRef = useRef<number>(value);

  console.log('🔄 InitialCapitalControl render:', {
    propsValue: value,
    displayValue: displayValue,
    lastExternalValue: lastExternalValueRef.current
  });

  // 输入处理函数 - 立即更新显示，防抖通知父组件
  const handleInputChange = useCallback((inputValue: string) => {
    console.log('⌨️  用户输入:', inputValue, '当前显示值:', displayValue);
    
    // 立即更新显示值，保证UI响应性
    setDisplayValue(inputValue);
    
    // 清除之前的防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      console.log('⏱️  清除之前的防抖定时器');
    }
    
    // 防抖处理：延迟通知父组件
    debounceTimerRef.current = setTimeout(() => {
      const numericValue = parseFloat(inputValue);
      
      console.log('🚀 防抖触发，处理数值:', numericValue);
      
      // 验证并通知父组件
      if (!isNaN(numericValue) && numericValue > 0) {
        // 更新记录值，避免下次外部值同步时覆盖用户输入
        lastExternalValueRef.current = numericValue;
        console.log('✅ 通知父组件更新:', numericValue);
        onValueChange(numericValue);
      } else if (inputValue === '' || numericValue === 0) {
        // 空值或0时设为默认值
        const defaultValue = 10000;
        lastExternalValueRef.current = defaultValue;
        console.log('🔄 设置默认值:', defaultValue);
        onValueChange(defaultValue);
      }
    }, 300);
  }, [onValueChange, displayValue]);

  // 只在外部值真正变化时同步（避免用户输入时被覆盖）
  useEffect(() => {
    console.log('📥 外部值同步检查:', {
      newValue: value,
      lastExternal: lastExternalValueRef.current,
      difference: Math.abs(value - lastExternalValueRef.current)
    });
    
    // 只有当外部值与记录值不同时才更新显示值
    if (Math.abs(value - lastExternalValueRef.current) > 0.001) {
      console.log('🔄 外部值变化，更新显示值:', value);
      setDisplayValue(value.toString());
      lastExternalValueRef.current = value;
    } else {
      console.log('⏭️  外部值未变化，跳过更新');
    }
  }, [value]);

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
        onChange={(e) => handleInputChange(e.target.value)}
        className="w-full"
        placeholder="10000"
        disabled={disabled}
      />
    </div>
  );
});
