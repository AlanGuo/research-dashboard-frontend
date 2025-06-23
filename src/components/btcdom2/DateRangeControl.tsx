'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';

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
  onEndDateChange
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

  console.log('🔄 DateRangeControl render:', {
    propsStartDate: startDate,
    propsEndDate: endDate,
    displayStartDate: displayStartDate,
    displayEndDate: displayEndDate,
    lastStartExternal: lastStartDateExternalValueRef.current,
    lastEndExternal: lastEndDateExternalValueRef.current
  });

  // 开始日期处理函数
  const handleStartDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      // 使用本地时区格式化日期，避免时区转换问题
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      console.log('⌨️  开始日期用户输入:', dateString, '当前显示值:', displayStartDate);
      
      // 立即更新显示值，保证UI响应性
      setDisplayStartDate(dateString);
      
      // 清除之前的防抖定时器
      if (startDateDebounceTimerRef.current) {
        clearTimeout(startDateDebounceTimerRef.current);
        console.log('⏱️  清除开始日期防抖定时器');
      }
      
      // 防抖处理：延迟通知父组件
      startDateDebounceTimerRef.current = setTimeout(() => {
        console.log('🚀 开始日期防抖触发，处理数值:', dateString);
        
        // 更新记录值，避免下次外部值同步时覆盖用户输入
        lastStartDateExternalValueRef.current = dateString;
        console.log('✅ 通知父组件更新开始日期:', dateString);
        onStartDateChange(dateString);
      }, 200); // 200ms 防抖，日期选择响应要快一些
    } else {
      console.log('⌨️  开始日期清空');
      setDisplayStartDate('');
      lastStartDateExternalValueRef.current = '';
      onStartDateChange('');
    }
  }, [onStartDateChange, displayStartDate]);

  // 结束日期处理函数
  const handleEndDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      // 使用本地时区格式化日期，避免时区转换问题
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      console.log('⌨️  结束日期用户输入:', dateString, '当前显示值:', displayEndDate);
      
      // 立即更新显示值，保证UI响应性
      setDisplayEndDate(dateString);
      
      // 清除之前的防抖定时器
      if (endDateDebounceTimerRef.current) {
        clearTimeout(endDateDebounceTimerRef.current);
        console.log('⏱️  清除结束日期防抖定时器');
      }
      
      // 防抖处理：延迟通知父组件
      endDateDebounceTimerRef.current = setTimeout(() => {
        console.log('🚀 结束日期防抖触发，处理数值:', dateString);
        
        // 更新记录值，避免下次外部值同步时覆盖用户输入
        lastEndDateExternalValueRef.current = dateString;
        console.log('✅ 通知父组件更新结束日期:', dateString);
        onEndDateChange(dateString);
      }, 200); // 200ms 防抖，日期选择响应要快一些
    } else {
      console.log('⌨️  结束日期清空');
      setDisplayEndDate('');
      lastEndDateExternalValueRef.current = '';
      onEndDateChange('');
    }
  }, [onEndDateChange, displayEndDate]);

  // 只在外部值真正变化时同步（避免用户输入时被覆盖）
  useEffect(() => {
    console.log('📥 开始日期外部值同步检查:', {
      newValue: startDate,
      lastExternal: lastStartDateExternalValueRef.current,
      same: startDate === lastStartDateExternalValueRef.current
    });
    
    // 只有当外部值与记录值不同时才更新显示值
    if (startDate !== lastStartDateExternalValueRef.current) {
      console.log('🔄 开始日期外部值变化，更新显示值:', startDate);
      setDisplayStartDate(startDate);
      lastStartDateExternalValueRef.current = startDate;
    } else {
      console.log('⏭️  开始日期外部值未变化，跳过更新');
    }
  }, [startDate]);

  useEffect(() => {
    console.log('📥 结束日期外部值同步检查:', {
      newValue: endDate,
      lastExternal: lastEndDateExternalValueRef.current,
      same: endDate === lastEndDateExternalValueRef.current
    });
    
    // 只有当外部值与记录值不同时才更新显示值
    if (endDate !== lastEndDateExternalValueRef.current) {
      console.log('🔄 结束日期外部值变化，更新显示值:', endDate);
      setDisplayEndDate(endDate);
      lastEndDateExternalValueRef.current = endDate;
    } else {
      console.log('⏭️  结束日期外部值未变化，跳过更新');
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
        <Label htmlFor="startDate">开始日期</Label>
        <DatePicker
          date={displayStartDate ? new Date(displayStartDate + 'T00:00:00') : undefined}
          onDateChange={handleStartDateChange}
          placeholder="选择开始日期"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate">结束日期</Label>
        <DatePicker
          date={displayEndDate ? new Date(displayEndDate + 'T00:00:00') : undefined}
          onDateChange={handleEndDateChange}
          placeholder="选择结束日期"
        />
      </div>
    </>
  );
});
