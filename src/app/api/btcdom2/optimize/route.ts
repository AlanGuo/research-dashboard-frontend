import { NextRequest, NextResponse } from 'next/server';
import { 
  BTCDOM2StrategyParams, 
  PositionAllocationStrategy 
} from '@/types/btcdom2';

export async function POST(request: NextRequest) {
  try {
    const rawParams = await request.json();

    // 设置默认值并构建完整参数
    const params: BTCDOM2StrategyParams = {
      ...rawParams,
      longBtc: rawParams.longBtc !== undefined ? rawParams.longBtc : true,
      shortAlt: rawParams.shortAlt !== undefined ? rawParams.shortAlt : true,
      priceChangeWeight: rawParams.priceChangeWeight !== undefined ? rawParams.priceChangeWeight : 0.4,
      volumeWeight: rawParams.volumeWeight !== undefined ? rawParams.volumeWeight : 0.2,
      volatilityWeight: rawParams.volatilityWeight !== undefined ? rawParams.volatilityWeight : 0.1,
      fundingRateWeight: rawParams.fundingRateWeight !== undefined ? rawParams.fundingRateWeight : 0.3,
      allocationStrategy: rawParams.allocationStrategy !== undefined ? rawParams.allocationStrategy : PositionAllocationStrategy.BY_VOLUME,
      maxSinglePositionRatio: rawParams.maxSinglePositionRatio !== undefined ? rawParams.maxSinglePositionRatio : 0.25,
    };

    // 验证参数
    if (!params.startDate || !params.endDate || params.initialCapital <= 0) {
      return NextResponse.json({
        success: false,
        error: '参数验证失败'
      }, { status: 400 });
    }

    // 验证策略选择
    if (!params.longBtc && !params.shortAlt) {
      return NextResponse.json({
        success: false,
        error: '至少需要选择一种策略：做多BTC或做空ALT'
      }, { status: 400 });
    }

    // 验证权重之和
    const totalWeight = params.priceChangeWeight + params.volumeWeight + params.volatilityWeight + params.fundingRateWeight;
    if (Math.abs(totalWeight - 1) > 0.001) {
      return NextResponse.json({
        success: false,
        error: '跌幅权重、成交量权重、波动率权重和资金费率权重之和必须等于1'
      }, { status: 400 });
    }

    // 设置默认手续费率
    if (params.spotTradingFeeRate === undefined) {
      params.spotTradingFeeRate = 0.0008;
    }
    if (params.futuresTradingFeeRate === undefined) {
      params.futuresTradingFeeRate = 0.0002;
    }

    // 性能监控开始
    const backtestStartTime = Date.now();
    if (process.env.NODE_ENV === 'development') {
      console.log(`[OPTIMIZE] 开始优化回测`);
    }

    // 调用完整backtest接口，然后提取轻量数据
    const fullBacktestResponse = await fetch(`${request.nextUrl.origin}/api/btcdom2/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!fullBacktestResponse.ok) {
      throw new Error('内部回测调用失败');
    }

    const fullBacktestResult = await fullBacktestResponse.json();
    
    if (!fullBacktestResult.success || !fullBacktestResult.data) {
      throw new Error('内部回测返回错误');
    }

    // 只提取性能指标，丢弃snapshots和chartData
    const performance = fullBacktestResult.data.performance;

    const totalTime = Date.now() - backtestStartTime;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[OPTIMIZE] 优化回测完成，耗时: ${totalTime}ms`);
    }

    // 只返回性能指标
    return NextResponse.json({
      success: true,
      data: {
        performance
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('BTCDOM2优化回测错误:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    }, { status: 500 });
  }
}