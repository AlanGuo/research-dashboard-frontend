#!/usr/bin/env node

/**
 * ALT做空盈亏计算验证脚本
 * 
 * 目的：单独验证ALT做空的盈亏计算逻辑，包括：
 * - 已实现盈亏（减仓/平仓时）
 * - 浮动盈亏（当前持仓）
 * - 手续费计算（期货交易）
 * - 资金费率计算
 */

console.log('=== ALT做空盈亏计算验证脚本 ===\n');

// 模拟参数配置
const mockParams = {
  initialCapital: 10000,          // 初始资金 $10,000
  altRatio: 0.4,                  // ALT占比40%
  futuresTradingFeeRate: 0.0002,  // 期货手续费率0.02%
};

// 模拟ALT候选标的数据
const mockAltCandidates = [
  {
    symbol: 'SOLUSDT',
    futureSymbol: 'SOLUSDT',
    allocation: 0.5,  // 分配50%的ALT资金
    entryPrice: 100,  // 入场价$100
  },
  {
    symbol: 'ETHUSDT', 
    futureSymbol: 'ETHUSDT',
    allocation: 0.5,  // 分配50%的ALT资金
    entryPrice: 3000, // 入场价$3000
  }
];

// 模拟数据点 - ALT做空场景
const mockDataPoints = [
  {
    period: 1,
    description: '初始状态：开仓ALT做空',
    prices: {
      'SOLUSDT': 100,  // SOL价格 $100
      'ETHUSDT': 3000, // ETH价格 $3000
    },
    priceChanges: {
      'SOLUSDT': 0,
      'ETHUSDT': 0,
    },
    fundingRates: {
      'SOLUSDT': 0.001,   // 0.1% 资金费率（正值，做空收益）
      'ETHUSDT': -0.0005, // -0.05% 资金费率（负值，做空亏损）
    }
  },
  {
    period: 2,
    description: 'SOL下跌5%，ETH上涨2%',
    prices: {
      'SOLUSDT': 95,   // SOL下跌到 $95 (-5%)
      'ETHUSDT': 3060, // ETH上涨到 $3060 (+2%)
    },
    priceChanges: {
      'SOLUSDT': -5.0,
      'ETHUSDT': 2.0,
    },
    fundingRates: {
      'SOLUSDT': 0.0008,  // 0.08% 资金费率
      'ETHUSDT': -0.0003, // -0.03% 资金费率
    }
  },
  {
    period: 3,
    description: '调仓：减少SOL仓位，增加ETH仓位',
    prices: {
      'SOLUSDT': 92,   // SOL继续下跌到 $92 (-3.16%)
      'ETHUSDT': 3120, // ETH继续上涨到 $3120 (+1.96%)
    },
    priceChanges: {
      'SOLUSDT': -3.16,
      'ETHUSDT': 1.96,
    },
    fundingRates: {
      'SOLUSDT': 0.0012, // 0.12% 资金费率
      'ETHUSDT': -0.0002, // -0.02% 资金费率
    },
    // 新的分配比例
    newAllocations: {
      'SOLUSDT': 0.3,  // 减少到30%
      'ETHUSDT': 0.7,  // 增加到70%
    }
  },
  {
    period: 4,
    description: '完全平仓SOL，保持ETH',
    prices: {
      'SOLUSDT': 88,   // SOL下跌到 $88 (-4.35%)
      'ETHUSDT': 3200, // ETH上涨到 $3200 (+2.56%)
    },
    priceChanges: {
      'SOLUSDT': -4.35,
      'ETHUSDT': 2.56,
    },
    fundingRates: {
      'SOLUSDT': 0.001,  // 0.1% 资金费率
      'ETHUSDT': -0.0001, // -0.01% 资金费率
    },
    newAllocations: {
      'SOLUSDT': 0,    // 完全平仓
      'ETHUSDT': 1.0,  // 全部资金投入ETH
    }
  }
];

// 计算交易手续费（期货交易，返回负数）
function calculateTradingFee(amount, isFutures = true) {
  const feeRate = isFutures ? mockParams.futuresTradingFeeRate : 0.0008;
  return -(amount * feeRate);
}

// 计算资金费率费用
function calculateFundingFee(positionValue, fundingRate) {
  // 资金费率：正值表示做空收益，负值表示做空亏损
  return positionValue * fundingRate;
}

// ALT做空持仓计算类
class ALTShortPositionCalculator {
  constructor(params) {
    this.params = params;
    this.snapshots = [];
  }

  // 生成单个快照
  generateSnapshot(dataPoint, previousSnapshot = null) {
    const { period, description, prices, priceChanges, fundingRates, newAllocations } = dataPoint;
    
    console.log(`\n--- 第${period}期: ${description} ---`);
    console.log(`价格: SOL=${prices.SOLUSDT}, ETH=${prices.ETHUSDT}`);
    
    // 计算当前总价值（如果是第一个快照，则使用初始本金）
    const previousValue = previousSnapshot?.totalValue || this.params.initialCapital;
    const altTotalAmount = previousValue * this.params.altRatio; // ALT总投资金额
    
    console.log(`上期总价值: $${previousValue.toLocaleString()}`);
    console.log(`ALT总投资金额: $${altTotalAmount.toFixed(2)}`);
    
    let shortPositions = [];
    let soldPositions = [];
    let totalTradingFee = 0;
    let totalFundingFee = 0;
    let altSaleRevenue = 0;
    let altPurchaseExpense = 0;
    let account_usdt_balance = 0;
    
    // 分离已实现盈亏和浮动盈亏
    let altRealizedPnl = 0;    // 已实现盈亏（卖出部分）
    let altUnrealizedPnl = 0;  // 浮动盈亏（持仓部分）
    let totalAltPnl = 0;       // 总的ALT盈亏
    
    // 计算现金余额变化
    let previousAccountBalance;
    if (previousSnapshot?.account_usdt_balance !== undefined) {
      previousAccountBalance = previousSnapshot.account_usdt_balance;
    } else {
      // 初始状态：BTC占60%，ALT占40%，现金余额为0（全部投入）
      previousAccountBalance = 0;
    }
    
    // 处理每个ALT标的
    for (const candidate of mockAltCandidates) {
      const symbol = candidate.symbol;
      const currentPrice = prices[symbol];
      const fundingRate = fundingRates[symbol];
      
      console.log(`\n处理 ${symbol}:`);
      console.log(`  当前价格: $${currentPrice}`);
      console.log(`  资金费率: ${(fundingRate * 100).toFixed(4)}%`);
      
      // 找到上期该标的的持仓
      const prevPosition = previousSnapshot?.shortPositions?.find(pos => pos.symbol === symbol);
      
      // 确定目标分配
      let targetAllocation;
      if (newAllocations && newAllocations[symbol] !== undefined) {
        targetAllocation = newAllocations[symbol];
        console.log(`  新分配比例: ${(targetAllocation * 100).toFixed(1)}%`);
      } else if (prevPosition) {
        // 保持原有分配比例
        targetAllocation = prevPosition.allocation || candidate.allocation;
        console.log(`  保持分配比例: ${(targetAllocation * 100).toFixed(1)}%`);
      } else {
        // 初次开仓
        targetAllocation = candidate.allocation;
        console.log(`  初始分配比例: ${(targetAllocation * 100).toFixed(1)}%`);
      }
      
      const targetAmount = altTotalAmount * targetAllocation; // 目标投资金额
      const targetQuantity = targetAmount / currentPrice;     // 目标持仓数量
      
      console.log(`  目标投资金额: $${targetAmount.toFixed(2)}`);
      console.log(`  目标持仓数量: ${targetQuantity.toFixed(6)}`);
      
      // 计算上期资金费用（基于上期持仓）
      let periodFundingFee = 0;
      if (prevPosition && prevPosition.quantity > 0) {
        const prevPositionValue = prevPosition.quantity * prevPosition.currentPrice;
        const prevFundingRate = previousSnapshot.fundingRates?.[symbol] || 0;
        periodFundingFee = calculateFundingFee(prevPositionValue, prevFundingRate);
        totalFundingFee += periodFundingFee;
        
        console.log(`  上期仓位价值: $${prevPositionValue.toFixed(2)}`);
        console.log(`  上期资金费率: ${(prevFundingRate * 100).toFixed(4)}%`);
        console.log(`  资金费用: $${periodFundingFee.toFixed(2)}`);
      }
      
      let positionTradingFee = 0;
      let positionRealizedPnl = 0;
      
      if (!prevPosition) {
        // === 初次开仓 ===
        if (targetQuantity > 0) {
          positionTradingFee = calculateTradingFee(targetAmount, true);
          totalTradingFee += positionTradingFee;
          altPurchaseExpense += targetAmount + Math.abs(positionTradingFee);
          
          console.log(`  ${symbol} 初次开仓:`);
          console.log(`    开仓金额: $${targetAmount.toFixed(2)}`);
          console.log(`    开仓数量: ${targetQuantity.toFixed(6)}`);
          console.log(`    开仓手续费: $${positionTradingFee.toFixed(2)}`);
          console.log(`    开仓总支出: $${(targetAmount + Math.abs(positionTradingFee)).toFixed(2)}`);
          
          shortPositions.push({
            symbol: symbol,
            side: 'SHORT',
            allocation: targetAllocation,
            value: targetAmount,
            quantity: targetQuantity,
            entryPrice: currentPrice,
            currentPrice: currentPrice,
            pnl: 0, // 开仓时浮动盈亏为0
            realizedPnl: 0, // 开仓时已实现盈亏为0
            totalPnl: 0,
            tradingFee: positionTradingFee,
            fundingFee: 0, // 开仓期无资金费用
            isNewPosition: true,
            periodTradingType: 'sell' // 做空开仓
          });
        }
      } else {
        // === 持仓调整 ===
        const prevQuantity = prevPosition.quantity;
        const prevEntryPrice = prevPosition.entryPrice;
        const quantityDiff = targetQuantity - prevQuantity;
        
        console.log(`  ${symbol} 持仓调整:`);
        console.log(`    上期数量: ${prevQuantity.toFixed(6)}`);
        console.log(`    上期成本价: $${prevEntryPrice.toFixed(2)}`);
        console.log(`    上期当前价: $${prevPosition.currentPrice.toFixed(2)}`);
        console.log(`    数量变化: ${quantityDiff.toFixed(6)}`);
        
        let newEntryPrice = prevEntryPrice;
        let periodTradingType = 'hold';
        
        if (Math.abs(quantityDiff) > 0.0001) { // 避免浮点数精度问题
          const tradingAmount = Math.abs(quantityDiff) * currentPrice;
          positionTradingFee = calculateTradingFee(tradingAmount, true);
          totalTradingFee += positionTradingFee;
          
          if (quantityDiff > 0) {
            // === 加仓 ===
            altPurchaseExpense += tradingAmount + Math.abs(positionTradingFee);
            // 计算加权平均成本价
            newEntryPrice = (prevQuantity * prevEntryPrice + quantityDiff * currentPrice) / targetQuantity;
            periodTradingType = 'sell'; // 做空加仓
            
            console.log(`    加仓金额: $${tradingAmount.toFixed(2)}`);
            console.log(`    加仓手续费: $${positionTradingFee.toFixed(2)}`);
            console.log(`    新加权成本价: $${newEntryPrice.toFixed(2)}`);
          } else {
            // === 减仓 ===
            const soldQuantity = Math.abs(quantityDiff);
            const soldValue = soldQuantity * currentPrice;
            
            // 计算已实现盈亏：做空盈亏 = 卖出数量 × (成本价 - 卖出价)
            positionRealizedPnl = soldQuantity * (prevEntryPrice - currentPrice);
            altRealizedPnl += positionRealizedPnl;
            
            // 卖出净收入 = 卖出金额 - 手续费
            const saleRevenue = soldValue + positionTradingFee; // positionTradingFee是负数
            altSaleRevenue += saleRevenue;
            
            // 保持原成本价（部分减仓不影响剩余持仓成本价）
            newEntryPrice = prevEntryPrice;
            periodTradingType = 'buy'; // 做空平仓
            
            console.log(`    减仓数量: ${soldQuantity.toFixed(6)}`);
            console.log(`    减仓价格: $${currentPrice.toFixed(2)}`);
            console.log(`    已实现盈亏: ${soldQuantity.toFixed(6)} × ($${prevEntryPrice.toFixed(2)} - $${currentPrice.toFixed(2)}) = $${positionRealizedPnl.toFixed(2)}`);
            console.log(`    减仓手续费: $${positionTradingFee.toFixed(2)}`);
            console.log(`    减仓净收入: $${saleRevenue.toFixed(2)}`);
          }
        }
        
        if (targetQuantity > 0) {
          // 计算浮动盈亏：做空盈亏 = 剩余数量 × (成本价 - 当前价)
          const positionUnrealizedPnl = targetQuantity * (newEntryPrice - currentPrice);
          altUnrealizedPnl += positionUnrealizedPnl;
          
          // 累计已实现盈亏
          const cumulativeRealizedPnl = (prevPosition.realizedPnl || 0) + positionRealizedPnl;
          const totalPositionPnl = cumulativeRealizedPnl + positionUnrealizedPnl;
          
          console.log(`    浮动盈亏: ${targetQuantity.toFixed(6)} × ($${newEntryPrice.toFixed(2)} - $${currentPrice.toFixed(2)}) = $${positionUnrealizedPnl.toFixed(2)}`);
          console.log(`    累计已实现盈亏: $${cumulativeRealizedPnl.toFixed(2)}`);
          console.log(`    总持仓盈亏: $${totalPositionPnl.toFixed(2)}`);
          
          shortPositions.push({
            symbol: symbol,
            side: 'SHORT',
            allocation: targetAllocation,
            value: targetAmount,
            quantity: targetQuantity,
            entryPrice: newEntryPrice,
            currentPrice: currentPrice,
            pnl: positionUnrealizedPnl, // 浮动盈亏
            realizedPnl: cumulativeRealizedPnl, // 累计已实现盈亏
            totalPnl: totalPositionPnl,
            tradingFee: positionTradingFee,
            fundingFee: periodFundingFee,
            isNewPosition: false,
            periodTradingType: periodTradingType
          });
        } else {
          // === 完全平仓 ===
          // 所有的盈亏都已经在减仓逻辑中计算了
          console.log(`    ${symbol} 完全平仓`);
          
          soldPositions.push({
            symbol: symbol,
            side: 'SHORT',
            allocation: 0,
            value: 0,
            quantity: 0,
            entryPrice: prevEntryPrice,
            currentPrice: currentPrice,
            pnl: 0,
            realizedPnl: (prevPosition.realizedPnl || 0) + positionRealizedPnl,
            totalPnl: (prevPosition.realizedPnl || 0) + positionRealizedPnl,
            tradingFee: positionTradingFee,
            fundingFee: periodFundingFee,
            isNewPosition: false,
            isSoldOut: true,
            periodTradingType: 'buy'
          });
        }
      }
    }
    
    // 计算总ALT盈亏
    const cumulativeRealizedPnl = (previousSnapshot?.altRealizedPnl || 0) + altRealizedPnl;
    totalAltPnl = cumulativeRealizedPnl + altUnrealizedPnl;
    
    console.log(`\nALT盈亏分解:`);
    console.log(`  当期已实现盈亏: $${altRealizedPnl.toFixed(2)}`);
    console.log(`  累计已实现盈亏: $${cumulativeRealizedPnl.toFixed(2)}`);
    console.log(`  浮动盈亏: $${altUnrealizedPnl.toFixed(2)}`);
    console.log(`  总ALT盈亏: $${totalAltPnl.toFixed(2)}`);
    
    // 计算现金余额变化
    console.log(`\n现金余额计算:`);
    console.log(`  上期现金余额: $${previousAccountBalance.toFixed(2)}`);
    console.log(`  ALT卖出收入: $${altSaleRevenue.toFixed(2)}`);
    console.log(`  ALT买入支出: $${altPurchaseExpense.toFixed(2)}`);
    console.log(`  交易手续费: $${Math.abs(totalTradingFee).toFixed(2)}`);
    console.log(`  资金费收入/支出: $${totalFundingFee.toFixed(2)}`);
    
    // 现金余额 = 上期余额 + ALT卖出收入 - ALT买入支出 + 资金费收入
    // 注意：altPurchaseExpense 和 altSaleRevenue 中已经包含了手续费的处理
    account_usdt_balance = previousAccountBalance + altSaleRevenue - altPurchaseExpense + totalFundingFee;
    
    console.log(`  当期现金余额: $${account_usdt_balance.toFixed(2)}`);
    
    // 计算ALT总市值
    const altValue = shortPositions.reduce((sum, pos) => sum + pos.value, 0);
    
    // 计算总价值（这里简化为只考虑ALT部分，实际应该包括BTC）
    // 为了验证，我们假设总价值 = 初始资本 + 总盈亏
    const totalValue = this.params.initialCapital + totalAltPnl - Math.abs(totalTradingFee) + totalFundingFee;
    
    console.log(`\n总价值计算:`);
    console.log(`  现金余额: $${account_usdt_balance.toFixed(2)}`);
    console.log(`  ALT市值: $${altValue.toFixed(2)}`);
    console.log(`  计算总价值: $${totalValue.toFixed(2)}`);
    
    // 计算总盈亏
    const totalPnl = totalValue - this.params.initialCapital;
    const totalPnlPercent = totalPnl / this.params.initialCapital;
    
    console.log(`  总盈亏: $${totalPnl.toFixed(2)} (${(totalPnlPercent * 100).toFixed(2)}%)`);
    
    // 验证：总盈亏应该等于总ALT盈亏减去累计手续费加上累计资金费
    const accumulatedTradingFee = (previousSnapshot?.accumulatedTradingFee || 0) + Math.abs(totalTradingFee);
    const accumulatedFundingFee = (previousSnapshot?.accumulatedFundingFee || 0) + totalFundingFee;
    const expectedPnl = totalAltPnl - accumulatedTradingFee + accumulatedFundingFee;
    
    console.log(`\n验证计算:`);
    console.log(`  当期ALT已实现盈亏: $${altRealizedPnl.toFixed(2)}`);
    console.log(`  累计ALT已实现盈亏: $${cumulativeRealizedPnl.toFixed(2)}`);
    console.log(`  ALT浮动盈亏: $${altUnrealizedPnl.toFixed(2)}`);
    console.log(`  总ALT盈亏: $${totalAltPnl.toFixed(2)}`);
    console.log(`  累计手续费: $${accumulatedTradingFee.toFixed(2)}`);
    console.log(`  累计资金费: $${accumulatedFundingFee.toFixed(2)}`);
    console.log(`  预期总盈亏: $${expectedPnl.toFixed(2)}`);
    console.log(`  实际总盈亏: $${totalPnl.toFixed(2)}`);
    console.log(`  差异: $${(totalPnl - expectedPnl).toFixed(6)}`);
    
    const snapshot = {
      period,
      description,
      prices,
      priceChanges,
      fundingRates,
      shortPositions,
      soldPositions,
      account_usdt_balance,
      totalValue,
      totalPnl,
      totalPnlPercent,
      accumulatedTradingFee,
      accumulatedFundingFee,
      altRealizedPnl: cumulativeRealizedPnl, // 使用累计已实现盈亏
      altUnrealizedPnl,
      totalAltPnl,
      verification: {
        expectedPnl: expectedPnl,
        actualPnl: totalPnl,
        difference: totalPnl - expectedPnl
      }
    };
    
    return snapshot;
  }
  
  // 运行完整验证
  runVerification() {
    console.log('开始ALT做空盈亏计算验证...\n');
    console.log('参数配置:');
    console.log(`  初始资金: $${this.params.initialCapital.toLocaleString()}`);
    console.log(`  ALT占比: ${(this.params.altRatio * 100).toFixed(1)}%`);
    console.log(`  期货手续费率: ${(this.params.futuresTradingFeeRate * 100).toFixed(3)}%`);
    
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
    console.log(`最终累计资金费: $${finalSnapshot.accumulatedFundingFee.toFixed(2)}`);
    console.log(`最终ALT已实现盈亏: $${finalSnapshot.altRealizedPnl.toFixed(2)}`);
    console.log(`最终ALT浮动盈亏: $${finalSnapshot.altUnrealizedPnl.toFixed(2)}`);
    console.log(`最终总ALT盈亏: $${finalSnapshot.totalAltPnl.toFixed(2)}`);
    
    // 逐期验证
    console.log('\n逐期验证结果:');
    this.snapshots.forEach(snapshot => {
      const status = Math.abs(snapshot.verification.difference) < 0.01 ? '✓' : '✗';
      console.log(`第${snapshot.period}期 ${status}: 差异 $${snapshot.verification.difference.toFixed(6)}`);
    });
    
    return this.snapshots;
  }
}

// 执行验证
const calculator = new ALTShortPositionCalculator(mockParams);
const results = calculator.runVerification();

console.log('\n=== 验证完成 ===');
console.log('如果所有期的差异都接近0，说明ALT做空盈亏计算逻辑正确');
console.log('下一步可以在实际回测中启用日志来检查具体问题');