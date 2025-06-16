import { NextResponse } from 'next/server';
import { BTCDOM2StrategyStatus } from '@/types/btcdom2';

export async function GET() {
  try {
    // 模拟策略状态数据
    const status: BTCDOM2StrategyStatus = {
      isRunning: true,
      lastRebalance: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4小时前
      nextRebalance: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4小时后
      dataAvailability: {
        volumeRanking: Math.random() > 0.2, // 80%概率可用
        priceData: Math.random() > 0.1,     // 90%概率可用
        volatilityData: Math.random() > 0.3 // 70%概率可用
      },
      errors: [],
      warnings: []
    };

    // 根据数据可用性生成警告和错误
    if (!status.dataAvailability.volumeRanking) {
      status.warnings.push('成交量排行榜数据暂时不可用，使用历史数据');
    }
    
    if (!status.dataAvailability.priceData) {
      status.errors.push('价格数据获取失败，策略已暂停');
      status.isRunning = false;
    }
    
    if (!status.dataAvailability.volatilityData) {
      status.warnings.push('波动率数据计算中，可能影响选币精度');
    }

    // 添加一些随机的系统状态信息
    const randomWarnings = [
      'API调用频率接近限制',
      '部分交易对数据延迟',
      '系统负载较高，响应可能变慢'
    ];

    const randomErrors = [
      'Binance API连接超时',
      '数据库连接异常',
      '内存使用率过高'
    ];

    // 随机添加一些警告
    if (Math.random() > 0.7) {
      const warning = randomWarnings[Math.floor(Math.random() * randomWarnings.length)];
      if (!status.warnings.includes(warning)) {
        status.warnings.push(warning);
      }
    }

    // 随机添加一些错误（概率较低）
    if (Math.random() > 0.9) {
      const error = randomErrors[Math.floor(Math.random() * randomErrors.length)];
      if (!status.errors.includes(error)) {
        status.errors.push(error);
        status.isRunning = false;
      }
    }

    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('获取BTCDOM2.0策略状态失败:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误',
      data: {
        isRunning: false,
        lastRebalance: new Date().toISOString(),
        nextRebalance: new Date().toISOString(),
        dataAvailability: {
          volumeRanking: false,
          priceData: false,
          volatilityData: false
        },
        errors: ['服务器内部错误'],
        warnings: []
      }
    }, { status: 500 });
  }
}