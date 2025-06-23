'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';

interface DateRangeControlProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  disabled?: boolean;
}

export function DateRangeControl({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabled = false
}: DateRangeControlProps) {
  // 独立的显示状态 - 完全隔离，不受其他参数影响
  const [displayStartDate, setDisplayStartDate] = useState<string>(startDate);
  const [displayEndDate, setDisplayEndDate] = useState<string>(endDate);

  // 防抖定时器
  const [startDateDebounceTimer, setStartDateDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [endDateDebounceTimer, setEndDateDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // 初始化显示值（只在挂载时同步一次）
  useEffect(() => {
    setDisplayStartDate(startDate);
  }, []); // 只在组件挂载时执行一次

  useEffect(() => {
    setDisplayEndDate(endDate);
  }, []); // 只在组件挂载时执行一次

  // 开始日期处理函数 - 完全隔离，不影响其他参数
  const handleStartDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      // 使用本地时区格式化日期，避免时区转换问题
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      console.log('开始日期显示值变化:', dateString);
      
      // 立即更新显示值
      setDisplayStartDate(dateString);
      
      // 清除之前的防抖定时器
      if (startDateDebounceTimer) {
        clearTimeout(startDateDebounceTimer);
      }
      
      // 设置新的防抖定时器
      const timer = setTimeout(() => {
        console.log('开始日期实际值更新:', dateString);
        onStartDateChange(dateString);
      }, 200); // 200ms 防抖，日期选择响应要快一些
      
      setStartDateDebounceTimer(timer);
    } else {
      setDisplayStartDate('');
      onStartDateChange('');
    }
  }, [onStartDateChange, startDateDebounceTimer]);

  // 结束日期处理函数 - 完全隔离，不影响其他参数
  const handleEndDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      // 使用本地时区格式化日期，避免时区转换问题
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      console.log('结束日期显示值变化:', dateString);
      
      // 立即更新显示值
      setDisplayEndDate(dateString);
      
      // 清除之前的防抖定时器
      if (endDateDebounceTimer) {
        clearTimeout(endDateDebounceTimer);
      }
      
      // 设置新的防抖定时器
      const timer = setTimeout(() => {
        console.log('结束日期实际值更新:', dateString);
        onEndDateChange(dateString);
      }, 200); // 200ms 防抖，日期选择响应要快一些
      
      setEndDateDebounceTimer(timer);
    } else {
      setDisplayEndDate('');
      onEndDateChange('');
    }
  }, [onEndDateChange, endDateDebounceTimer]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (startDateDebounceTimer) {
        clearTimeout(startDateDebounceTimer);
      }
      if (endDateDebounceTimer) {
        clearTimeout(endDateDebounceTimer);
      }
    };
  }, [startDateDebounceTimer, endDateDebounceTimer]);

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
}
