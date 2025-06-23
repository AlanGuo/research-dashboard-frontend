import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface MaxShortPositionsControlProps {
  value: number; // 整数值
  onValueChange: (value: number) => void; // 回调传递整数值
  disabled?: boolean;
}

/**
 * 独立的最多做空标的数量控制组件
 * 具有防抖功能，优化输入体验
 */
const MaxShortPositionsControl = memo<MaxShortPositionsControlProps>(({
  value,
  onValueChange,
  disabled = false
}) => {
  // 本地显示状态
  const [displayValue, setDisplayValue] = useState<number>(value);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastExternalValueRef = useRef<number>(value);
  const currentInputValueRef = useRef<number>(value); // 记录当前输入的最新值
  
  console.log('MaxShortPositionsControl render:', { 
    value, 
    displayValue,
    lastExternal: lastExternalValueRef.current
  });

  // 处理输入变化 - 防抖版本
  const handleChange = useCallback((inputValue: string) => {
    const numValue = parseInt(inputValue) || 0;
    const clampedValue = Math.min(Math.max(numValue, 1), 50); // 限制在1-50范围内
    
    console.log('MaxShortPositions input:', { inputValue, numValue, clampedValue });
    
    // 立即更新显示值和记录当前输入值
    setDisplayValue(clampedValue);
    currentInputValueRef.current = clampedValue;
    
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      console.log('MaxShortPositions: 清除防抖定时器，重新计时');
    }

    // 设置新的防抖定时器
    debounceTimerRef.current = setTimeout(() => {
      const latestValue = currentInputValueRef.current;
      console.log('MaxShortPositions: 输入停止，发送最终值给父组件', latestValue);
      
      // 只有值真正变化时才通知父组件
      if (Math.abs(latestValue - lastExternalValueRef.current) > 0.5) { // 整数比较用0.5
        lastExternalValueRef.current = latestValue;
        onValueChange(latestValue);
        console.log('MaxShortPositions: 最终值已变化，通知父组件');
      } else {
        console.log('MaxShortPositions: 最终值未变化，跳过通知');
      }
      
      debounceTimerRef.current = null;
    }, 300); // 300ms防抖延迟
  }, [onValueChange]);

  // 同步外部值变化
  useEffect(() => {
    console.log('MaxShortPositions useEffect:', {
      value,
      displayValue,
      lastExternal: lastExternalValueRef.current,
      currentInput: currentInputValueRef.current
    });
    
    // 只在外部值真正变化且不同于当前输入值时才更新显示值
    const isExternalChange = Math.abs(value - lastExternalValueRef.current) > 0.5;
    const isDifferentFromInput = Math.abs(value - currentInputValueRef.current) > 0.5;
    
    if (isExternalChange && isDifferentFromInput) {
      console.log('MaxShortPositions: 外部值变化，更新显示值', value);
      setDisplayValue(value);
      lastExternalValueRef.current = value;
      currentInputValueRef.current = value; // 同步当前输入值
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
    <div className="space-y-3">
      <Label htmlFor="maxShortPositions" className="text-sm font-medium">最多做空标的数量</Label>
      <Input
        id="maxShortPositions"
        type="number"
        min="1"
        max="50"
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="请输入1-50的数字"
        disabled={disabled}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">控制同时做空的币种数量</p>
    </div>
  );
});

MaxShortPositionsControl.displayName = 'MaxShortPositionsControl';

export default MaxShortPositionsControl;
