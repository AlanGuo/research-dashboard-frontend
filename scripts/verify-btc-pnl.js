#!/usr/bin/env node

/**
 * BTC盈亏计算验证脚本
 * 
 * 目的：单独验证BTC、手续费、资金费的计算逻辑，
 * 通过模拟简单的情况来确保计算正确性
 */

console.log('=== BTC盈亏计算验证脚本 ===\n');

// 模拟参数配置
const mockParams = {
  initialCapital: 10000,          // 初始资金 $10,000
  btcRatio: 0.6,                  // BTC占比60%
  longBtc: true,
  shortAlt: true,
  spotTradingFeeRate: 0.0008,     // 现货手续费率0.08%
  futuresTradingFeeRate: 0.0002,  // 期货手续费率0.02%
};

// 模拟数据点 - 简化场景：只有BTC价格变化，ALT不变
const mockDataPoints = [
  {
    period: 1,
    btcPrice: 50000,           // BTC初始价格 $50,000
    btcPriceChange24h: 0,
    description: '初始状态'
  },
  {
    period: 2,
    btcPrice: 52000,           // BTC上涨到 $52,000 (+4%)
    btcPriceChange24h: 4.0,
    description: 'BTC上涨4%'
  },
  {
    period: 3,  
    btcPrice: 51000,           // BTC下跌到 $51,000 (-1.92%)
    btcPriceChange24h: -1.92,
    description: 'BTC下跌1.92%'
  }
];

// 计算交易手续费（返回负数，因为是扣除的费用）
function calculateTradingFee(amount, isSpotTrading = true) {
  const feeRate = isSpotTrading ? mockParams.spotTradingFeeRate : mockParams.futuresTradingFeeRate;
  return -(amount * feeRate);
}

// BTC持仓计算类
class BTCPositionCalculator {
  constructor(params) {
    this.params = params;
    this.snapshots = [];
  }

  // 生成单个快照
  generateSnapshot(dataPoint, previousSnapshot = null) {
    const { period, btcPrice, btcPriceChange24h, description } = dataPoint;
    
    console.log(`\n--- 第${period}期: ${description} ---`);
    console.log(`BTC价格: $${btcPrice.toLocaleString()}`);
    
    // 计算当前总价值（如果是第一个快照，则使用初始本金）
    const previousValue = previousSnapshot?.totalValue || this.params.initialCapital;
    console.log(`上期总价值: $${previousValue.toLocaleString()}`);
    
    // BTC持仓计算
    let btcPosition = null;
    let totalTradingFee = 0;
    let btcSaleRevenue = 0;        // BTC卖出收入
    let btcPurchaseExpense = 0;    // BTC买入支出
    let account_usdt_balance = 0;
    
    // 分离已实现盈亏和浮动盈亏
    let btcRealizedPnl = 0;    // 已实现盈亏（卖出部分）
    let btcUnrealizedPnl = 0;  // 浮动盈亏（持仓部分）
    let totalBtcPnl = 0;       // 总的BTC盈亏
    
    if (this.params.longBtc) {
      const btcAmount = previousValue * this.params.btcRatio; // 目标BTC投资金额
      const btcQuantity = btcAmount / btcPrice;               // 目标BTC数量
      
      console.log(`目标BTC投资金额: $${btcAmount.toFixed(2)}`);
      console.log(`目标BTC数量: ${btcQuantity.toFixed(6)} BTC`);
      
      // 计算BTC盈亏和手续费
      let btcTradingFee = 0;
      let btcIsNewPosition = false;
      
      if (previousSnapshot?.btcPosition) {
        // 使用上一期的BTC数量和价格变化来计算盈亏
        const previousBtcQuantity = previousSnapshot.btcPosition.quantity ?? 0;
        const previousBtcPrice = previousSnapshot.btcPosition.currentPrice ?? btcPrice;
        const previousEntryPrice = previousSnapshot.btcPosition.entryPrice ?? previousBtcPrice;
        
        console.log(`上期BTC数量: ${previousBtcQuantity.toFixed(6)} BTC`);
        console.log(`上期BTC价格: $${previousBtcPrice.toLocaleString()}`);
        console.log(`上期BTC成本价: $${previousEntryPrice.toLocaleString()}`);
        
        // 如果BTC仓位发生变化，计算交易手续费和已实现盈亏
        const quantityDiff = btcQuantity - previousBtcQuantity;
        console.log(`BTC数量变化: ${quantityDiff.toFixed(6)} BTC`);
        
        if (Math.abs(quantityDiff) > 0.0001) { // 避免浮点数精度问题
          const tradingAmount = Math.abs(quantityDiff) * btcPrice;
          btcTradingFee = calculateTradingFee(tradingAmount, true); // BTC现货交易
          totalTradingFee += btcTradingFee;
          
          console.log(`BTC交易金额: $${tradingAmount.toFixed(2)}`);
          console.log(`BTC交易手续费: $${btcTradingFee.toFixed(2)}`);
          
          if (quantityDiff > 0) {
            // 加仓BTC：需要现金买入
            btcPurchaseExpense = tradingAmount + Math.abs(btcTradingFee);
            console.log(`BTC加仓支出: $${btcPurchaseExpense.toFixed(2)} (包含手续费)`);
          } else {
            // 减仓BTC：卖出获得现金，计算已实现盈亏
            const soldQuantity = Math.abs(quantityDiff);
            const soldValue = soldQuantity * btcPrice;
            const soldTradingFee = calculateTradingFee(soldValue, true);
            
            // 已实现盈亏 = 卖出数量 × (卖出价 - 成本价)
            btcRealizedPnl = soldQuantity * (btcPrice - previousEntryPrice);
            
            // 卖出净收入 = 卖出金额 - 手续费
            btcSaleRevenue = soldValue + soldTradingFee; // soldTradingFee是负数
            
            console.log(`BTC减仓已实现盈亏: ${soldQuantity.toFixed(6)} × ($${btcPrice.toFixed(2)} - $${previousEntryPrice.toFixed(2)}) = $${btcRealizedPnl.toFixed(2)}`);
            console.log(`BTC减仓净收入: $${btcSaleRevenue.toFixed(2)} (已扣除手续费$${Math.abs(soldTradingFee).toFixed(2)})`);
          }
        } else {
          console.log('BTC仓位未发生变化，无交易手续费');
        }
      } else {
        // 第一次开仓BTC
        btcTradingFee = calculateTradingFee(btcAmount, true);
        totalTradingFee += btcTradingFee;
        btcIsNewPosition = true;
        btcPurchaseExpense = btcAmount + Math.abs(btcTradingFee);
        
        console.log(`BTC初始开仓金额: $${btcAmount.toFixed(2)}`);
        console.log(`BTC初始开仓手续费: $${btcTradingFee.toFixed(2)}`);
        console.log(`BTC初始开仓总支出: $${btcPurchaseExpense.toFixed(2)} (包含手续费)`);
      }
      
      // 计算加权平均成本价
      let entryPrice = btcPrice; // 默认当前价格
      if (previousSnapshot?.btcPosition && !btcIsNewPosition) {
        const prevQuantity = previousSnapshot.btcPosition.quantity ?? 0;
        const prevEntryPrice = previousSnapshot.btcPosition.entryPrice ?? btcPrice;
        const quantityDiff = btcQuantity - prevQuantity;
        
        if (quantityDiff > 0) {
          // 加仓：计算加权平均成本价
          entryPrice = (prevQuantity * prevEntryPrice + quantityDiff * btcPrice) / btcQuantity;
          console.log(`加权平均成本价: (${prevQuantity.toFixed(6)} × $${prevEntryPrice.toFixed(2)} + ${quantityDiff.toFixed(6)} × $${btcPrice.toFixed(2)}) / ${btcQuantity.toFixed(6)} = $${entryPrice.toFixed(2)}`);
        } else {
          // 减仓或持仓不变：保持原成本价
          entryPrice = prevEntryPrice;
          console.log(`保持原成本价: $${entryPrice.toFixed(2)}`);
        }
      }
      
      // 计算BTC浮动盈亏：基于加权平均成本价
      // 浮动盈亏 = 当前持仓数量 × (当前价格 - 加权平均成本价)
      btcUnrealizedPnl = btcQuantity * (btcPrice - entryPrice);
      
      // 总BTC盈亏 = 累计已实现盈亏 + 当前浮动盈亏
      const cumulativeRealizedPnl = (previousSnapshot?.btcRealizedPnl || 0) + btcRealizedPnl;
      totalBtcPnl = cumulativeRealizedPnl + btcUnrealizedPnl;
      
      console.log(`BTC盈亏分解:`);
      console.log(`  当期已实现盈亏: $${btcRealizedPnl.toFixed(2)}`);
      console.log(`  累计已实现盈亏: $${cumulativeRealizedPnl.toFixed(2)}`);
      console.log(`  浮动盈亏: ${btcQuantity.toFixed(6)} × ($${btcPrice.toFixed(2)} - $${entryPrice.toFixed(2)}) = $${btcUnrealizedPnl.toFixed(2)}`);
      console.log(`  总BTC盈亏: $${totalBtcPnl.toFixed(2)}`);
      
      btcPosition = {
        symbol: 'BTCUSDT',
        side: 'LONG',
        value: btcAmount,
        quantity: btcQuantity,
        entryPrice: entryPrice,
        currentPrice: btcPrice,
        pnl: btcUnrealizedPnl, // 浮动盈亏
        realizedPnl: cumulativeRealizedPnl, // 累计已实现盈亏
        totalPnl: totalBtcPnl, // 总盈亏
        tradingFee: btcTradingFee,
        isNewPosition: btcIsNewPosition
      };
      
      console.log(`BTC持仓详情:`);
      console.log(`  - 价值: $${btcPosition.value.toFixed(2)}`);
      console.log(`  - 数量: ${btcPosition.quantity.toFixed(6)} BTC`);  
      console.log(`  - 成本价: $${btcPosition.entryPrice.toFixed(2)}`);
      console.log(`  - 当前价: $${btcPosition.currentPrice.toFixed(2)}`);
      console.log(`  - 浮动盈亏: $${btcPosition.pnl.toFixed(2)}`);
    }
    
    // 计算现金余额变化
    let previousAccountBalance;
    if (previousSnapshot?.account_usdt_balance !== undefined) {
      previousAccountBalance = previousSnapshot.account_usdt_balance;
    } else {
      // 初始状态：全部资金都是现金余额
      previousAccountBalance = this.params.initialCapital;
    }
    
    console.log(`\n现金余额计算:`);
    console.log(`  上期现金余额: $${previousAccountBalance.toFixed(2)}`);
    console.log(`  BTC卖出收入: $${btcSaleRevenue.toFixed(2)}`);
    console.log(`  BTC买入支出: $${btcPurchaseExpense.toFixed(2)}`);
    console.log(`  交易手续费: $${Math.abs(totalTradingFee).toFixed(2)}`);
    
    // 现金余额 = 上期余额 + BTC卖出收入 - BTC买入支出
    // 注意：btcPurchaseExpense 和 btcSaleRevenue 中已经包含了手续费的处理
    account_usdt_balance = previousAccountBalance + btcSaleRevenue - btcPurchaseExpense;
    
    console.log(`  当期现金余额: $${account_usdt_balance.toFixed(2)}`);
    
    // 计算BTC市值
    const btcMarketValue = btcPosition ? btcPosition.quantity * btcPosition.currentPrice : 0;
    
    // 计算累计BTC已实现盈亏（按算法二方式）
    const cumulativeBtcPnl = (previousSnapshot?.cumulativeBtcPnl || 0) + btcRealizedPnl;
    
    // ===== 核心对比：两种算法 =====
    
    // 算法1：route.ts方式（现金余额追踪）
    const algorithm1_totalValue = account_usdt_balance + btcMarketValue;
    
    // 算法2：累计盈亏方式
    // 对于BTC现货：totalValue = initialCapital + totalBtcPnl - accumulatedFees
    // 其中 totalBtcPnl = cumulativeRealizedPnl + unrealizedPnl
    const currentAccumulatedFee = (previousSnapshot?.accumulatedTradingFee || 0) + Math.abs(totalTradingFee);
    const algorithm2_totalValue = this.params.initialCapital + cumulativeBtcPnl + btcUnrealizedPnl - currentAccumulatedFee;
    
    console.log(`\n=== 两种算法对比 ===`);
    console.log(`算法1 (route.ts方式):`);
    console.log(`  现金余额: $${account_usdt_balance.toFixed(2)}`);
    console.log(`  BTC市值: $${btcMarketValue.toFixed(2)}`);
    console.log(`  总价值: $${algorithm1_totalValue.toFixed(2)}`);
    
    console.log(`算法2 (累计盈亏方式):`);
    console.log(`  初始资本: $${this.params.initialCapital.toFixed(2)}`);
    console.log(`  累计BTC已实现盈亏: $${cumulativeBtcPnl.toFixed(2)}`);
    console.log(`  BTC浮动盈亏: $${btcUnrealizedPnl.toFixed(2)}`);
    console.log(`  累计手续费: -$${currentAccumulatedFee.toFixed(2)}`);
    console.log(`  总价值: $${algorithm2_totalValue.toFixed(2)}`);
    
    console.log(`差异: $${(algorithm1_totalValue - algorithm2_totalValue).toFixed(6)}`);
    
    // 计算总盈亏（使用算法1结果）
    const totalValue = algorithm1_totalValue;
    const totalPnl = totalValue - this.params.initialCapital;
    const totalPnlPercent = totalPnl / this.params.initialCapital;
    
    console.log(`\n总盈亏: $${totalPnl.toFixed(2)} (${(totalPnlPercent * 100).toFixed(2)}%)`);
    
    // 验证：总盈亏应该等于总BTC盈亏减去累计手续费
    const accumulatedTradingFee = (previousSnapshot?.accumulatedTradingFee || 0) + Math.abs(totalTradingFee);
    const expectedPnl = totalBtcPnl - accumulatedTradingFee;
    
    console.log(`\n原始验证:`);
    console.log(`  当期BTC已实现盈亏: $${btcRealizedPnl.toFixed(2)}`);
    console.log(`  累计BTC已实现盈亏: $${(btcPosition?.realizedPnl || 0).toFixed(2)}`);
    console.log(`  BTC浮动盈亏: $${btcUnrealizedPnl.toFixed(2)}`);
    console.log(`  总BTC盈亏: $${totalBtcPnl.toFixed(2)}`);
    console.log(`  累计手续费: $${accumulatedTradingFee.toFixed(2)}`);
    console.log(`  预期总盈亏: $${expectedPnl.toFixed(2)}`);
    console.log(`  实际总盈亏: $${totalPnl.toFixed(2)}`);
    console.log(`  差异: $${(totalPnl - expectedPnl).toFixed(6)}`);
    
    const snapshot = {
      period,
      btcPrice,
      btcPriceChange24h,
      description,
      btcPosition,
      account_usdt_balance,
      totalValue,
      algorithm1_totalValue,
      algorithm2_totalValue,
      totalPnl,
      totalPnlPercent,
      accumulatedTradingFee,
      btcRealizedPnl: btcPosition?.realizedPnl || 0, // 使用累计已实现盈亏
      btcUnrealizedPnl,
      totalBtcPnl,
      cumulativeBtcPnl, // 新增：累计BTC已实现盈亏
      btcMarketValue, // 新增：BTC市值
      verification: {
        expectedPnl: expectedPnl,
        actualPnl: totalPnl,
        difference: totalPnl - expectedPnl,
        // 新增：两种算法对比
        algorithm1_vs_algorithm2_difference: algorithm1_totalValue - algorithm2_totalValue
      }
    };
    
    return snapshot;
  }
  
  // 运行完整验证
  runVerification() {
    console.log('开始BTC盈亏计算验证...\n');
    console.log('参数配置:');
    console.log(`  初始资金: $${this.params.initialCapital.toLocaleString()}`);
    console.log(`  BTC占比: ${(this.params.btcRatio * 100).toFixed(1)}%`);
    console.log(`  现货手续费率: ${(this.params.spotTradingFeeRate * 100).toFixed(3)}%`);
    
    let previousSnapshot = null;
    
    for (const dataPoint of mockDataPoints) {
      const snapshot = this.generateSnapshot(dataPoint, previousSnapshot);
      this.snapshots.push(snapshot);
      previousSnapshot = snapshot;
    }
    
    // 最终汇总验证
    console.log('\n=== 最终汇总验证 ===');
    const finalSnapshot = this.snapshots[this.snapshots.length - 1];
    
    console.log(`最终总价值: $${finalSnapshot.totalValue.toFixed(2)}`);
    console.log(`最终总盈亏: $${finalSnapshot.totalPnl.toFixed(2)}`);
    console.log(`最终累计手续费: $${finalSnapshot.accumulatedTradingFee.toFixed(2)}`);
    console.log(`最终BTC已实现盈亏: $${finalSnapshot.btcRealizedPnl.toFixed(2)}`);
    console.log(`最终BTC浮动盈亏: $${finalSnapshot.btcUnrealizedPnl.toFixed(2)}`);
    console.log(`最终总BTC盈亏: $${finalSnapshot.totalBtcPnl.toFixed(2)}`);
    
    // 逐期两种算法对比
    console.log('\n=== 逐期两种算法对比 ===');
    this.snapshots.forEach(snapshot => {
      const algDiff = snapshot.verification.algorithm1_vs_algorithm2_difference;
      const status = Math.abs(algDiff) < 0.01 ? '✓' : '✗';
      console.log(`第${snapshot.period}期 ${status}: 算法1 vs 算法2 差异 $${algDiff.toFixed(6)}`);
    });
    
    console.log('\n逐期原始验证结果:');
    this.snapshots.forEach(snapshot => {
      const status = Math.abs(snapshot.verification.difference) < 0.01 ? '✓' : '✗';
      console.log(`第${snapshot.period}期 ${status}: 盈亏计算差异 $${snapshot.verification.difference.toFixed(6)}`);
    });
    
    return this.snapshots;
  }
}

// 执行验证
const calculator = new BTCPositionCalculator(mockParams);
const results = calculator.runVerification();

console.log('\n=== 验证完成 ===');
console.log('如果所有期的差异都接近0，说明BTC盈亏计算逻辑正确');
console.log('下一步可以在实际回测中启用日志来检查具体问题');