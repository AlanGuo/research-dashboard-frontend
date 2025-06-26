/**
 * 时间处理工具函数的测试
 * 用于验证时区转换逻辑是否正确
 */

import { convertInputToUTCISO } from '@/config/index';

// 测试时间转换函数
function testTimeConversion() {
  console.log('=== 时间转换测试 ===');
  
  // 测试用例1：标准datetime-local格式
  const input1 = '2025-06-25T23:00';
  const output1 = convertInputToUTCISO(input1);
  console.log(`输入: ${input1}`);
  console.log(`输出: ${output1}`);
  console.log(`期望: 2025-06-25T23:00:00.000Z`);
  console.log(`正确: ${output1 === '2025-06-25T23:00:00.000Z'}`);
  console.log('---');
  
  // 测试用例2：已经是ISO格式
  const input2 = '2025-06-25T16:00:00.000Z';
  const output2 = convertInputToUTCISO(input2);
  console.log(`输入: ${input2}`);
  console.log(`输出: ${output2}`);
  console.log(`期望: 2025-06-25T16:00:00.000Z`);
  console.log(`正确: ${output2 === '2025-06-25T16:00:00.000Z'}`);
  console.log('---');
  
  // 测试用例3：空字符串
  const input3 = '';
  const output3 = convertInputToUTCISO(input3);
  console.log(`输入: "${input3}"`);
  console.log(`输出: "${output3}"`);
  console.log(`期望: ""`);
  console.log(`正确: ${output3 === ''}`);
  console.log('---');
  
  // 测试当前时间的转换
  const now = new Date();
  const currentUTC = now.toISOString();
  const currentLocal = `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}-${now.getUTCDate().toString().padStart(2, '0')}T${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;
  
  console.log(`当前UTC时间: ${currentUTC}`);
  console.log(`转换为输入格式: ${currentLocal}`);
  console.log(`再转换回UTC: ${convertInputToUTCISO(currentLocal)}`);
  
  return {
    test1: output1 === '2025-06-25T23:00:00.000Z',
    test2: output2 === '2025-06-25T16:00:00.000Z',
    test3: output3 === '',
    allPassed: output1 === '2025-06-25T23:00:00.000Z' && 
               output2 === '2025-06-25T16:00:00.000Z' && 
               output3 === ''
  };
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  // 添加到全局对象，方便在控制台调用
  (window as any).testTimeConversion = testTimeConversion;
}

export { testTimeConversion };
