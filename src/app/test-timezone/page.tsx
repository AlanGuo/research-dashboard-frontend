'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangeControl } from '@/components/btcdom2/DateRangeControl';
import { getBTCDOM2Config, convertInputToUTCISO } from '@/config/index';

export default function TestTimezonePage() {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [testResults, setTestResults] = useState<any[]>([]);

  const handleLoadDefaultConfig = () => {
    const config = getBTCDOM2Config();
    setStartDate(config.startDate);
    setEndDate(config.endDate);
    
    addTestResult('加载默认配置', {
      startDate: config.startDate,
      endDate: config.endDate,
      currentTime: new Date().toISOString(),
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  };

  const handleTestTimeConversion = () => {
    const testCases = [
      '2025-06-25T23:00',
      '2025-06-25T16:00',
      '2025-06-25T08:00',
      '2025-06-25T00:00'
    ];

    const results = testCases.map(input => ({
      input,
      output: convertInputToUTCISO(input),
      expected: `${input}:00.000Z`
    }));

    addTestResult('时间转换测试', results);
  };

  const handleTestCurrentTime = () => {
    const now = new Date();
    const utcTime = now.toISOString();
    const localTime = now.toLocaleString();
    const utcComponents = {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      day: now.getUTCDate(),
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes()
    };
    const localComponents = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes()
    };

    addTestResult('当前时间测试', {
      utcTime,
      localTime,
      utcComponents,
      localComponents,
      timezoneOffset: now.getTimezoneOffset(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  };

  const handleTestBackendCall = async () => {
    if (!startDate || !endDate) {
      addTestResult('后端调用测试', { error: '请先设置开始和结束时间' });
      return;
    }

    try {
      // 模拟后端API调用
      const startTime = new Date(startDate).toISOString();
      const endTime = new Date(endDate).toISOString();
      
      addTestResult('后端调用测试', {
        originalStartDate: startDate,
        originalEndDate: endDate,
        convertedStartTime: startTime,
        convertedEndTime: endTime,
        note: '这些是将发送给后端的时间参数'
      });
    } catch (error) {
      addTestResult('后端调用测试', { 
        error: error instanceof Error ? error.message : '未知错误' 
      });
    }
  };

  const addTestResult = (testName: string, result: any) => {
    setTestResults(prev => [...prev, {
      timestamp: new Date().toISOString(),
      testName,
      result
    }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>时区处理测试页面</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DateRangeControl
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleLoadDefaultConfig}>
              加载默认配置
            </Button>
            <Button onClick={handleTestTimeConversion}>
              测试时间转换
            </Button>
            <Button onClick={handleTestCurrentTime}>
              测试当前时间
            </Button>
            <Button onClick={handleTestBackendCall}>
              测试后端调用
            </Button>
            <Button variant="outline" onClick={clearResults}>
              清空结果
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">当前参数值：</h3>
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm">
              <div>开始时间: {startDate || '未设置'}</div>
              <div>结束时间: {endDate || '未设置'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>测试结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4">
                  <div className="font-medium">{result.testName}</div>
                  <div className="text-sm text-gray-500">{result.timestamp}</div>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs mt-2 overflow-auto">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
