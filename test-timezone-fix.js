// 测试时区修复效果
console.log('=== 时区修复测试 ===\n');

// 模拟配置生成
function testConfigGeneration() {
  console.log('1. 测试配置生成:');
  
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  const endDate = now.toISOString();
  
  console.log(`当前UTC时间: ${now.toISOString()}`);
  console.log(`生成的endDate: ${endDate}`);
  console.log(`格式正确: ${endDate.endsWith('Z')}`);
  console.log('---\n');
  
  return endDate;
}

// 模拟时间转换
function testTimeConversion() {
  console.log('2. 测试时间转换:');
  
  const testCases = [
    '2025-06-25T23:00:00.000Z',  // 完整ISO格式
    '2025-06-25T23:00',          // 简化格式（问题格式）
    '2020-01-01T00:00:00.000Z'   // 开始时间格式
  ];
  
  testCases.forEach(input => {
    console.log(`输入: ${input}`);
    
    // 模拟convertUTCISOToInput逻辑
    let output;
    if (input.endsWith('Z')) {
      const date = new Date(input);
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      output = `${year}-${month}-${day}T${hours}:${minutes}`;
    } else if (input.length === 16 && input.includes('T')) {
      output = input; // 直接返回
    }
    
    console.log(`输出: ${output}`);
    
    // 模拟convertInputToUTCISO逻辑
    let backToISO;
    if (output && output.length === 16) {
      backToISO = `${output}:00.000Z`;
    }
    
    console.log(`转换回ISO: ${backToISO}`);
    console.log(`往返转换正确: ${input === backToISO || (input.length === 16 && backToISO === `${input}:00.000Z`)}`);
    console.log('---');
  });
  
  console.log('');
}

// 模拟后端调用
function testBackendCall() {
  console.log('3. 测试后端调用:');
  
  const params = {
    startDate: '2020-01-01T00:00:00.000Z',
    endDate: '2025-06-25T23:00:00.000Z'
  };
  
  const startTime = new Date(params.startDate).toISOString();
  const endTime = new Date(params.endDate).toISOString();
  
  console.log(`参数startDate: ${params.startDate}`);
  console.log(`参数endDate: ${params.endDate}`);
  console.log(`发送给后端startTime: ${startTime}`);
  console.log(`发送给后端endTime: ${endTime}`);
  console.log(`时间保持不变: ${params.startDate === startTime && params.endDate === endTime}`);
  console.log('---\n');
}

// 运行测试
const generatedEndDate = testConfigGeneration();
testTimeConversion();
testBackendCall();

console.log('=== 预期修复效果 ===');
console.log('修复前问题:');
console.log('- 用户看到: 2025-06-25T23:00');
console.log('- 实际查询: 2025-06-25T15:00:00.000Z (错误)');
console.log('- 结果: 查询不到16:00的数据');
console.log('');
console.log('修复后效果:');
console.log('- 用户看到: 2025-06-25T23:00');
console.log('- 实际查询: 2025-06-25T23:00:00.000Z (正确)');
console.log('- 结果: 能查询到16:00的数据');
