'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { devConsole } from '@/utils/devLogger';

interface MaxSinglePositionPercentControlProps {
  value?: number; // 0-1的小数
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * 单标的最大仓位占比控制组件（百分比输入）
 * 内部使用百分比显示，外部传递0-1的小数
 */
export const MaxSinglePositionPercentControl = memo(function MaxSinglePositionPercentControl({
  value = 0.2,
  onValueChange,
  disabled = false
}: MaxSinglePositionPercentControlProps) {
  const initialPercent = useMemo(() => Math.round((value ?? 0) * 100), [value]);
  const [displayValue, setDisplayValue] = useState<number>(initialPercent);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastExternalValueRef = useRef<number>(value ?? 0.2);
  const isInternalChangeRef = useRef<boolean>(false);

  const clampPercent = useCallback((rawValue: number) => {
    if (Number.isNaN(rawValue)) return 0;
    return Math.min(Math.max(rawValue, 0), 100);
  }, []);

  const notifyChange = useCallback((percentValue: number) => {
    const decimalValue = percentValue / 100;
    if (Math.abs(decimalValue - lastExternalValueRef.current) > 0.0005) {
      lastExternalValueRef.current = decimalValue;
      onValueChange(decimalValue);
    } else {
      devConsole.log('⏭️  maxSinglePositionPercent 未发生有效变化，跳过通知');
    }
  }, [onValueChange]);

  const handleChange = useCallback((inputValue: string) => {
    const numericValue = clampPercent(parseFloat(inputValue));
    setDisplayValue(numericValue);
    isInternalChangeRef.current = true;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    debounceTimerRef.current = setTimeout(() => {
      notifyChange(numericValue);
      debounceTimerRef.current = null;
    }, 250);
  }, [clampPercent, notifyChange]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const newPercent = Math.round((value ?? 0) * 100);
    const isExternalChange = Math.abs((value ?? 0) - lastExternalValueRef.current) > 0.0005;

    if (isInternalChangeRef.current && isExternalChange) {
      lastExternalValueRef.current = value ?? 0;
      isInternalChangeRef.current = false;
      return;
    }

    if (isExternalChange && !isInternalChangeRef.current) {
      setDisplayValue(newPercent);
      lastExternalValueRef.current = value ?? 0;
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <Label htmlFor="maxSinglePositionPercent">单标的最大仓位占比</Label>
      <div className="relative">
        <Input
          id="maxSinglePositionPercent"
          type="number"
          min="0"
          max="100"
          step="5"
          value={displayValue}
          onChange={(event) => handleChange(event.target.value)}
          disabled={disabled}
          className="pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">%</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        限制单个标的的最大资金占比，超出部分会按当前分配策略自动再分配
      </p>
    </div>
  );
});

MaxSinglePositionPercentControl.displayName = 'MaxSinglePositionPercentControl';
