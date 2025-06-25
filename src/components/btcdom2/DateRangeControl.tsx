'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { devConsole } from '@/utils/devLogger';

interface DateRangeControlProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  disabled?: boolean;
}

export const DateRangeControl = memo(function DateRangeControl({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabled = false
}: DateRangeControlProps) {
  // 完全自管理的显示状态
  const [displayStartDate, setDisplayStartDate] = useState<string>(startDate);
  const [displayEndDate, setDisplayEndDate] = useState<string>(endDate);

  // 防抖定时器
  const startDateDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const endDateDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 记录上次外部传入的值，避免循环更新
  const lastStartDateExternalValueRef = useRef<string>(startDate);
  const lastEndDateExternalValueRef = useRef<string>(endDate);

  devConsole.log('🔄 DateRangeControl render:', {
    propsStartDate: startDate,
    propsEndDate: endDate,
    displayStartDate: displayStartDate,
    displayEndDate: displayEndDate,
    lastStartExternal: lastStartDateExternalValueRef.current,
    lastEndExternal: lastEndDateExternalValueRef.current
  });

  // 开始日期处理函数
  const handleStartDateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const dateTimeValue = event.target.value;
    devConsole.log('⌨️  开始日期时间输入:', dateTimeValue);
    
    setDisplayStartDate(dateTimeValue);
    
    // 清除之前的防抖定时器
    if (startDateDebounceTimerRef.current) {
      clearTimeout(startDateDebounceTimerRef.current);
    }
    
    // 防抖处理：延迟通知父组件
    startDateDebounceTimerRef.current = setTimeout(() => {
      devConsole.log('🚀 开始日期时间防抖触发，处理数值:', dateTimeValue);
      
      // 更新记录值，避免下次外部值同步时覆盖用户输入
      lastStartDateExternalValueRef.current = dateTimeValue;
      devConsole.log('✅ 通知父组件更新开始日期时间:', dateTimeValue);
      onStartDateChange(dateTimeValue);
    }, 300); // 300ms 防抖
  }, [onStartDateChange]);

  // 结束日期处理函数
  const handleEndDateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const dateTimeValue = event.target.value;
    devConsole.log('⌨️  结束日期时间输入:', dateTimeValue);
    
    setDisplayEndDate(dateTimeValue);
    
    // 清除之前的防抖定时器
    if (endDateDebounceTimerRef.current) {
      clearTimeout(endDateDebounceTimerRef.current);
    }
    
    // 防抖处理：延迟通知父组件
    endDateDebounceTimerRef.current = setTimeout(() => {
      devConsole.log('🚀 结束日期时间防抖触发，处理数值:', dateTimeValue);
      
      // 更新记录值，避免下次外部值同步时覆盖用户输入
      lastEndDateExternalValueRef.current = dateTimeValue;
      devConsole.log('✅ 通知父组件更新结束日期时间:', dateTimeValue);
      onEndDateChange(dateTimeValue);
    }, 300); // 300ms 防抖
  }, [onEndDateChange]);

  // 只在外部值真正变化时同步（避免用户输入时被覆盖）
  useEffect(() => {
    devConsole.log('📥 开始日期外部值同步检查:', {
      newValue: startDate,
      lastExternal: lastStartDateExternalValueRef.current,
      same: startDate === lastStartDateExternalValueRef.current
    });
    
    // 只有当外部值与记录值不同时才更新显示值
    if (startDate !== lastStartDateExternalValueRef.current) {
      devConsole.log('🔄 开始日期外部值变化，更新显示值:', startDate);
      setDisplayStartDate(startDate);
      lastStartDateExternalValueRef.current = startDate;
    } else {
      devConsole.log('⏭️  开始日期外部值未变化，跳过更新');
    }
  }, [startDate]);

  useEffect(() => {
    devConsole.log('📥 结束日期外部值同步检查:', {
      newValue: endDate,
      lastExternal: lastEndDateExternalValueRef.current,
      same: endDate === lastEndDateExternalValueRef.current
    });
    
    // 只有当外部值与记录值不同时才更新显示值
    if (endDate !== lastEndDateExternalValueRef.current) {
      devConsole.log('🔄 结束日期外部值变化，更新显示值:', endDate);
      setDisplayEndDate(endDate);
      lastEndDateExternalValueRef.current = endDate;
    } else {
      devConsole.log('⏭️  结束日期外部值未变化，跳过更新');
    }
  }, [endDate]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (startDateDebounceTimerRef.current) {
        clearTimeout(startDateDebounceTimerRef.current);
      }
      if (endDateDebounceTimerRef.current) {
        clearTimeout(endDateDebounceTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="startDate">
          开始日期
          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(UTC)</span>
        </Label>
        <Input
          id="startDate"
          type="datetime-local"
          value={displayStartDate}
          onChange={handleStartDateChange}
          disabled={disabled}
          className="w-full"
          placeholder="选择开始日期时间"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate">
          结束日期
          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(UTC)</span>
        </Label>
        <Input
          id="endDate"
          type="datetime-local"
          value={displayEndDate}
          onChange={handleEndDateChange}
          disabled={disabled}
          className="w-full"
          placeholder="选择结束日期时间"
        />
      </div>
    </>
  );
});
