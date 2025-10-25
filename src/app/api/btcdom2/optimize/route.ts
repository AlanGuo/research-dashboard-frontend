import { NextRequest, NextResponse } from 'next/server';
import config from '@/config/index';
import { 
  BTCDOM2StrategyParams, 
  PositionAllocationStrategy 
} from '@/types/btcdom2';

export async function POST(request: NextRequest) {
  try {
    const rawParams = await request.json();

    // 设置默认值并构建完整参数（与backtest路由保持一致）
    const params: BTCDOM2StrategyParams = {
      ...rawParams,
      longBtc: rawParams.longBtc !== undefined ? rawParams.longBtc : true,
      shortAlt: rawParams.shortAlt !== undefined ? rawParams.shortAlt : true,
      priceChangeWeight: rawParams.priceChangeWeight !== undefined ? rawParams.priceChangeWeight : 0.4,
      volumeWeight: rawParams.volumeWeight !== undefined ? rawParams.volumeWeight : 0.2,
      volatilityWeight: rawParams.volatilityWeight !== undefined ? rawParams.volatilityWeight : 0.1,
      fundingRateWeight: rawParams.fundingRateWeight !== undefined ? rawParams.fundingRateWeight : 0.3,
      allocationStrategy: rawParams.allocationStrategy !== undefined ? rawParams.allocationStrategy : PositionAllocationStrategy.BY_VOLUME,
      maxSinglePositionPercent: rawParams.maxSinglePositionPercent !== undefined
        ? Math.min(Math.max(rawParams.maxSinglePositionPercent, 0), 1)
        : 0.2,
      // 温度计规则参数默认值
      useTemperatureRule: rawParams.useTemperatureRule !== undefined ? rawParams.useTemperatureRule : false,
      temperatureSymbol: rawParams.temperatureSymbol !== undefined ? rawParams.temperatureSymbol : 'OTHERS',
      temperatureThreshold: rawParams.temperatureThreshold !== undefined ? rawParams.temperatureThreshold : 60,
      temperatureTimeframe: rawParams.temperatureTimeframe !== undefined ? rawParams.temperatureTimeframe : '1D',
      temperatureData: rawParams.temperatureData || [],
      // 日志开关参数（优先使用请求参数，其次使用配置文件，最后使用默认值）
      enableSnapshotLogs: rawParams.enableSnapshotLogs !== undefined ? rawParams.enableSnapshotLogs : (config.btcdom2?.enableSnapshotLogs ?? false),
      enableMetricsLogs: rawParams.enableMetricsLogs !== undefined ? rawParams.enableMetricsLogs : (config.btcdom2?.enableMetricsLogs ?? false),
    };

    // console.log('收到BTCDOM2优化回测请求，参数:', params);

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
    // 添加optimizeOnly参数以跳过chartData生成，提升性能
    const fullBacktestResponse = await fetch(`${request.nextUrl.origin}/api/btcdom2/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        optimizeOnly: true  // 优化模式：跳过图表数据生成
      })
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
      console.log(`[OPTIMIZE] 优化回测完成，总耗时: ${totalTime}ms`);
      console.log(`[OPTIMIZE] 性能指标:`, {
        '总收益率': `${(performance.totalReturn * 100).toFixed(2)}%`,
        '夏普比率': performance.sharpeRatio?.toFixed(3) || 'N/A',
        '最大回撤': `${(performance.maxDrawdown * 100).toFixed(2)}%`
      });
      console.log(`[OPTIMIZE] 平均处理速度: ${(totalTime / 1000).toFixed(2)}s`);
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
