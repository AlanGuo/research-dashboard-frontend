'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InitialCapitalControlProps {
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

export function InitialCapitalControl({
  value,
  onValueChange,
  disabled = false
}: InitialCapitalControlProps) {
  // 独立的显示状态 - 完全隔离，不受其他参数影响
  const [displayValue, setDisplayValue] = useState<string>(value.toString());

  // 防抖定时器
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // 初始化显示值（只在挂载时同步一次）
  useEffect(() => {
    setDisplayValue(value.toString());
  }, []); // 只在组件挂载时执行一次

  // 初始本金处理函数 - 完全隔离，不影响其他参数
  const handleValueChange = useCallback((inputValue: string) => {
    console.log('初始本金显示值变化:', inputValue);
    
    // 立即更新显示值
    setDisplayValue(inputValue);
    
    // 清除之前的防抖定时器
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // 设置新的防抖定时器
    const timer = setTimeout(() => {
      const numericValue = parseFloat(inputValue) || 0;
      
      // 基础验证：必须为正数
      if (numericValue > 0) {
        console.log('初始本金实际值更新:', numericValue);
        onValueChange(numericValue);
      } else if (numericValue === 0 && inputValue === '') {
        // 允许清空，设为默认值
        onValueChange(10000);
      }
    }, 300); // 300ms 防抖
    
    setDebounceTimer(timer);
  }, [onValueChange, debounceTimer]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  return (
    <div className="space-y-2">
      <Label htmlFor="initialCapital">初始本金 (USDT)</Label>
      <Input
        id="initialCapital"
        type="number"
        min="1"
        step="1000"
        value={displayValue}
        onChange={(e) => handleValueChange(e.target.value)}
        className="w-full"
        placeholder="10000"
        disabled={disabled}
      />
    </div>
  );
}
