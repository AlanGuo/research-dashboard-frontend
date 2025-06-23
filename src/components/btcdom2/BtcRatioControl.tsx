import React, { useState, useCallback, useRef, memo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface BtcRatioControlProps {
  value: number; // 0-1的小数值
  onValueChange: (value: number) => void; // 回调传递0-1的小数值
  disabled?: boolean;
}

/**
 * 完全独立的BTC占比控制组件
 * 专门用于测试性能，不受其他参数影响
 */
const BtcRatioControl = memo<BtcRatioControlProps>(({
  value,
  onValueChange,
  disabled = false
}) => {
  // 本地显示状态（百分比形式）- 完全独立
  const [displayValue, setDisplayValue] = useState<number>(value * 100);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastExternalValueRef = useRef<number>(value);
  
  // 标记是否是内部变化（用户输入导致的）
  const isInternalChangeRef = useRef<boolean>(false);
  
  console.log('🔄 BtcRatioControl render:', {
    propsValue: value,
    displayValue: displayValue,
    lastExternalValue: lastExternalValueRef.current
  });

  // 真正的防抖处理 - 只在停止输入后触发一次
  const handleChange = useCallback((inputValue: string) => {
    console.log('⌨️  用户输入:', inputValue, '当前显示值:', displayValue);
    
    const numValue = parseFloat(inputValue) || 0;
    const clampedValue = Math.min(Math.max(numValue, 0), 100);
    const decimalValue = clampedValue / 100;
    
    // 标记这是内部变化
    isInternalChangeRef.current = true;
    
    // 立即更新显示值
    setDisplayValue(clampedValue);
    
    // 真正的防抖：清除所有之前的定时器，重新开始计时
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      console.log('⏱️  清除之前的防抖定时器');
    }

    // 设置新的防抖定时器 - 只有这个定时器完成才会触发回调
    debounceTimerRef.current = setTimeout(() => {
      console.log('🚀 防抖触发，处理数值:', decimalValue);
      
      // 只有值真正变化时才通知父组件
      if (Math.abs(decimalValue - lastExternalValueRef.current) > 0.001) {
        lastExternalValueRef.current = decimalValue;
        console.log('✅ 通知父组件更新:', decimalValue);
        onValueChange(decimalValue);
      } else {
        console.log('⏭️  值未变化，跳过通知');
      }
      
      // 清理定时器引用
      debounceTimerRef.current = null;
    }, 300); // 增加到300ms，确保用户真正停止输入
  }, [onValueChange]);

  // 同步外部值变化 - 优化版本
  React.useEffect(() => {
    const newDisplayValue = value * 100;
    
    console.log('📥 外部值同步检查:', {
      newValue: value,
      lastExternal: lastExternalValueRef.current,
      difference: Math.abs(value - lastExternalValueRef.current)
    });
    
    // 检查是否是真正的外部值变化
    const isExternalChange = Math.abs(value - lastExternalValueRef.current) > 0.001;
    
    // 如果是内部变化导致的更新，只更新 ref，不同步显示值
    if (isInternalChangeRef.current && isExternalChange) {
      lastExternalValueRef.current = value; // 更新外部值引用
      isInternalChangeRef.current = false; // 重置标记
      console.log('⏭️  内部变化导致的外部值更新，跳过同步');
      return;
    }
    
    // 处理真正的外部值变化（非用户输入导致的）
    if (isExternalChange && !isInternalChangeRef.current) {
      console.log('🔄 外部值变化，更新显示值:', newDisplayValue);
      setDisplayValue(newDisplayValue);
      lastExternalValueRef.current = value;
    } else {
      console.log('⏭️  外部值未变化，跳过更新');
    }
  }, [value]);

  // 清理定时器
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      <Label htmlFor="isolatedBtcRatio">BTC占比</Label>
      <div className="relative">
        <Input
          id="isolatedBtcRatio"
          type="number"
          min="0"
          max="100"
          step="5"
          value={displayValue.toFixed(0)}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="BTC占比(%)"
          className="pr-8"
          disabled={disabled}
        />
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
          %
        </span>
      </div>
    </div>
  );
});

BtcRatioControl.displayName = 'BtcRatioControl';

export default BtcRatioControl;
