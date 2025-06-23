'use client';

import React, { memo, useCallback, useEffect, useState } from 'react';
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



  // 同步外部值变化
  useEffect(() => {
    if (Math.abs(value - displayValue) > 0.001) {
      setDisplayValue(value);
    }
  }, [value, label, displayValue]);

  const handleDecrease = useCallback(() => {
    const currentPercentage = displayValue * 100;
    const newPercentage = currentPercentage % 5 === 0 
      ? Math.max(0, currentPercentage - 5)
      : Math.max(0, Math.floor(currentPercentage / 5) * 5);
    const newValue = newPercentage / 100;
    
    setDisplayValue(newValue);
    onValueChange(newValue);
  }, [displayValue, onValueChange]);

  const handleIncrease = useCallback(() => {
    const currentPercentage = displayValue * 100;
    const newPercentage = currentPercentage % 5 === 0 
      ? Math.min(100, currentPercentage + 5)
      : Math.min(100, Math.ceil(currentPercentage / 5) * 5);
    const newValue = newPercentage / 100;
    
    setDisplayValue(newValue);
    onValueChange(newValue);
  }, [displayValue, onValueChange]);

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
