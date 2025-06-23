'use client';

import React, { memo, useCallback, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';

interface WeightControlProps {
  label: string;
  value: number; // 0-1 之间的值
  onValueChange: (value: number) => void;
  disabled?: boolean;
  description?: string;
}

export const WeightControl = memo(function WeightControl({
  label,
  value,
  onValueChange,
  disabled = false,
  description
}: WeightControlProps) {
  // 本地显示状态
  const [displayValue, setDisplayValue] = useState<number>(value);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastExternalValueRef = useRef<number>(value);

  console.log('WeightControl render:', { label, value, displayValue });

  // 防抖的值变化处理
  const triggerValueChange = useCallback((newValue: number) => {
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // 设置新的防抖定时器
    debounceTimerRef.current = setTimeout(() => {
      if (Math.abs(newValue - lastExternalValueRef.current) > 0.001) {
        lastExternalValueRef.current = newValue;
        onValueChange(newValue);
        console.log('WeightControl 防抖触发:', { label, newValue });
      }
      debounceTimerRef.current = null;
    }, 150); // 150ms 防抖延迟
  }, [onValueChange, label]);

  const handleDecrease = useCallback(() => {
    const currentPercentage = displayValue * 100;
    const newPercentage = currentPercentage % 5 === 0 
      ? Math.max(0, currentPercentage - 5)
      : Math.max(0, Math.floor(currentPercentage / 5) * 5);
    const newValue = newPercentage / 100;
    
    console.log('WeightControl decrease:', { label, currentPercentage, newPercentage, newValue });
    setDisplayValue(newValue);
    triggerValueChange(newValue);
  }, [displayValue, triggerValueChange, label]);

  const handleIncrease = useCallback(() => {
    const currentPercentage = displayValue * 100;
    const newPercentage = currentPercentage % 5 === 0 
      ? Math.min(100, currentPercentage + 5)
      : Math.min(100, Math.ceil(currentPercentage / 5) * 5);
    const newValue = newPercentage / 100;
    
    console.log('WeightControl increase:', { label, currentPercentage, newPercentage, newValue });
    setDisplayValue(newValue);
    triggerValueChange(newValue);
  }, [displayValue, triggerValueChange, label]);

  // 同步外部值变化
  useEffect(() => {
    if (Math.abs(value - lastExternalValueRef.current) > 0.001) {
      console.log('WeightControl 外部值变化:', { label, value, displayValue });
      setDisplayValue(value);
      lastExternalValueRef.current = value;
    }
  }, [value, label]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const percentage = displayValue * 100;

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center space-x-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDecrease}
          disabled={disabled || percentage <= 0}
          className="w-8 h-8 p-0"
        >
          -
        </Button>
        <div className="flex-1 flex items-center space-x-2">
          <Progress value={percentage} className="flex-1" />
          <span className="text-sm font-medium min-w-[40px] text-right">
            {percentage.toFixed(0)}%
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleIncrease}
          disabled={disabled || percentage >= 100}
          className="w-8 h-8 p-0"
        >
          +
        </Button>
      </div>
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  );
});
