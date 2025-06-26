// 测试 BTCDOM2 配置系统
const { getBTCDOM2Config, validateBTCDOM2Params } = require('./src/lib/btcdom2-utils.ts');
const { getConfigValue } = require('./src/config/index.ts');

console.log('=== 测试 BTCDOM2 配置系统 ===\n');

// 测试配置读取
console.log('1. 测试 getBTCDOM2Config():');
try {
  const config = getBTCDOM2Config();
  console.log('配置读取成功:');
  console.log(JSON.stringify(config, null, 2));
} catch (error) {
  console.error('配置读取失败:', error.message);
}

console.log('\n2. 测试 getConfigValue():');
try {
  const initialCapital = getConfigValue('btcdom2.initialCapital', 10000);
  const startDate = getConfigValue('btcdom2.startDate', '2020-01-01');
  const maxDuration = getConfigValue('btcdom2.maxBacktestDurationDays', undefined);
  
  console.log('initialCapital:', initialCapital);
  console.log('startDate:', startDate);
  console.log('maxBacktestDurationDays:', maxDuration);
} catch (error) {
  console.error('配置值读取失败:', error.message);
}

console.log('\n3. 测试 validateBTCDOM2Params():');
try {
  const testParams = {
    startDate: '2024-01-01',
    endDate: '2024-06-01',
    initialCapital: 10000,
    priceChangeWeight: 0.25,
    volumeWeight: 0.25,
    volatilityWeight: 0.25,
    fundingRateWeight: 0.25,
    longBtc: true,
    shortAlt: true
  };
  
  const validation = validateBTCDOM2Params(testParams);
  console.log('验证结果:', validation);
} catch (error) {
  console.error('参数验证失败:', error.message);
}
