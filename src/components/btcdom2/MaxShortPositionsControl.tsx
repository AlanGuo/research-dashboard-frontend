import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { devConsole } from '@/utils/devLogger';

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
  
  // 标记是否是内部变化（用户输入导致的）
  const isInternalChangeRef = useRef<boolean>(false);
  
  devConsole.log('🔄 MaxShortPositionsControl render:', {
    propsValue: value,
    displayValue: displayValue,
    lastExternalValue: lastExternalValueRef.current
  });

  // 处理输入变化 - 防抖版本
  const handleChange = useCallback((inputValue: string) => {
    devConsole.log('⌨️  用户输入:', inputValue, '当前显示值:', displayValue);
    
    const numValue = parseInt(inputValue) || 0;
    const clampedValue = Math.min(Math.max(numValue, 1), 50); // 限制在1-50范围内
    
    // 标记这是内部变化
    isInternalChangeRef.current = true;
    
    // 立即更新显示值
    setDisplayValue(clampedValue);
    
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      devConsole.log('⏱️  清除之前的防抖定时器');
    }

    // 设置新的防抖定时器
    debounceTimerRef.current = setTimeout(() => {
      devConsole.log('🚀 防抖触发，处理数值:', clampedValue);
      
      // 只有值真正变化时才通知父组件
      if (Math.abs(clampedValue - lastExternalValueRef.current) > 0.5) { // 整数比较用0.5
        lastExternalValueRef.current = clampedValue;
        devConsole.log('✅ 通知父组件更新:', clampedValue);
        onValueChange(clampedValue);
      } else {
        devConsole.log('⏭️  值未变化，跳过通知');
      }
      
      debounceTimerRef.current = null;
    }, 300); // 300ms防抖延迟
  }, [onValueChange, displayValue]);

  // 同步外部值变化
  useEffect(() => {
    devConsole.log('📥 外部值同步检查:', {
      newValue: value,
      lastExternal: lastExternalValueRef.current,
      difference: Math.abs(value - lastExternalValueRef.current)
    });
    
    // 检查是否是真正的外部值变化
    const isExternalChange = Math.abs(value - lastExternalValueRef.current) > 0.5;
    
    // 如果是内部变化导致的更新，只更新 ref，不同步显示值
    if (isInternalChangeRef.current && isExternalChange) {
      lastExternalValueRef.current = value; // 更新外部值引用
      isInternalChangeRef.current = false; // 重置标记
      devConsole.log('⏭️  内部变化导致的外部值更新，跳过同步');
      return;
    }
    
    // 处理真正的外部值变化（非用户输入导致的）
    if (isExternalChange && !isInternalChangeRef.current) {
      devConsole.log('🔄 外部值变化，更新显示值:', value);
      setDisplayValue(value);
      lastExternalValueRef.current = value;
    } else {
      devConsole.log('⏭️  外部值未变化，跳过更新');
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
