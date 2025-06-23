'use client';

import React, { memo, useCallback, useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { devConsole } from '@/utils/devLogger';

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
  // 完全自管理的显示状态
  const [displayValue, setDisplayValue] = useState<number>(value);
  
  // 记录上次外部传入的值，避免循环更新
  const lastExternalValueRef = useRef<number>(value);

  devConsole.log(`🔄 WeightControl[${label}] render:`, {
    propsValue: value,
    displayValue: displayValue,
    lastExternalValue: lastExternalValueRef.current
  });

  // 只在外部值真正变化时同步（避免用户输入时被覆盖）
  useEffect(() => {
    devConsole.log(`📥 WeightControl[${label}] 外部值同步检查:`, {
      newValue: value,
      lastExternal: lastExternalValueRef.current,
      difference: Math.abs(value - lastExternalValueRef.current)
    });
    
    // 只有当外部值与记录值不同时才更新显示值
    if (Math.abs(value - lastExternalValueRef.current) > 0.001) {
      devConsole.log(`🔄 WeightControl[${label}] 外部值变化，更新显示值:`, value);
      setDisplayValue(value);
      lastExternalValueRef.current = value;
    } else {
      devConsole.log(`⏭️  WeightControl[${label}] 外部值未变化，跳过更新`);
    }
  }, [value, label]);

  const handleDecrease = useCallback(() => {
    devConsole.log(`⌨️  WeightControl[${label}] 用户点击减少按钮，当前显示值:`, displayValue);
    
    const currentPercentage = displayValue * 100;
    const newPercentage = currentPercentage % 5 === 0 
      ? Math.max(0, currentPercentage - 5)
      : Math.max(0, Math.floor(currentPercentage / 5) * 5);
    const newValue = newPercentage / 100;
    
    devConsole.log(`🚀 WeightControl[${label}] 处理减少操作，新值:`, newValue);
    
    // 立即更新显示值
    setDisplayValue(newValue);
    
    // 更新记录值，避免外部值同步时覆盖
    lastExternalValueRef.current = newValue;
    
    devConsole.log(`✅ WeightControl[${label}] 通知父组件更新:`, newValue);
    onValueChange(newValue);
  }, [displayValue, onValueChange, label]);

  const handleIncrease = useCallback(() => {
    devConsole.log(`⌨️  WeightControl[${label}] 用户点击增加按钮，当前显示值:`, displayValue);
    
    const currentPercentage = displayValue * 100;
    const newPercentage = currentPercentage % 5 === 0 
      ? Math.min(100, currentPercentage + 5)
      : Math.min(100, Math.ceil(currentPercentage / 5) * 5);
    const newValue = newPercentage / 100;
    
    devConsole.log(`🚀 WeightControl[${label}] 处理增加操作，新值:`, newValue);
    
    // 立即更新显示值
    setDisplayValue(newValue);
    
    // 更新记录值，避免外部值同步时覆盖
    lastExternalValueRef.current = newValue;
    
    devConsole.log(`✅ WeightControl[${label}] 通知父组件更新:`, newValue);
    onValueChange(newValue);
  }, [displayValue, onValueChange, label]);

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
