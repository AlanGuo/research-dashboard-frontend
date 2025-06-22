'use client';

import React, { memo } from 'react';
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
  const percentage = value * 100;

  const handleDecrease = () => {
    const currentValue = percentage;
    const newValue = currentValue % 5 === 0 
      ? Math.max(0, currentValue - 5)
      : Math.max(0, Math.floor(currentValue / 5) * 5);
    onValueChange(newValue);
  };

  const handleIncrease = () => {
    const currentValue = percentage;
    const newValue = currentValue % 5 === 0 
      ? Math.min(100, currentValue + 5)
      : Math.min(100, Math.ceil(currentValue / 5) * 5);
    onValueChange(newValue);
  };

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
