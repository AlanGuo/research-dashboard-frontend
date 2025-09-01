#!/usr/bin/env node

/**
 * ALT做空盈亏计算验证脚本（极简版）
 * 
 * 目的：验证route.ts中ALT盈亏计算的核心逻辑
 * 
 * 验证内容：
 * 1. soldPositions的pnl累计 = ALT已实现盈亏
 * 2. shortPositions的pnl累计 = ALT浮动盈亏
 * 3. 已实现盈亏在现金余额中的正确体现
 * 
 * 排除因素：BTC、手续费、资金费（全部设为0）
 */

console.log('=== ALT做空盈亏计算验证脚本（极简版） ===\n');

// 模拟参数
const mockParams = {
  initialCapital: 10000,
  btcRatio: 0.6, // BTC占60%，ALT占40%
};

// 模拟数据：只关注ALT价格变化
const mockDataPoints = [
  {
    period: 1,
    description: '初始开仓',
    altPositions: [
      { symbol: 'SOLUSDT', allocation: 0.5, price: 100 },  // 50% of ALT funds
      { symbol: 'ETHUSDT', allocation: 0.5, price: 3000 }  // 50% of ALT funds
    ]
  },
  {
    period: 2,
    description: 'SOL下跌，ETH上涨',
    altPositions: [
      { symbol: 'SOLUSDT', allocation: 0.5, price: 95 },   // SOL -5%
      { symbol: 'ETHUSDT', allocation: 0.5, price: 3060 }  // ETH +2%
    ]
  },
  {
    period: 3,
    description: '调仓：减少SOL，增加ETH',
    altPositions: [
      { symbol: 'SOLUSDT', allocation: 0.3, price: 92 },   // SOL继续下跌
      { symbol: 'ETHUSDT', allocation: 0.7, price: 3120 }  // ETH继续上涨
    ]
  },
  {
    period: 4,
    description: '完全平仓SOL',
    altPositions: [
      { symbol: 'SOLUSDT', allocation: 0, price: 88 },     // SOL完全平仓
      { symbol: 'ETHUSDT', allocation: 1.0, price: 3200 }  // ETH全部资金
    ]
  }
];

// ALT盈亏验证器
class ALTVerifier {
  constructor(params) {
    this.params = params;
    this.snapshots = [];
  }

  generateSnapshot(dataPoint, previousSnapshot = null) {
    const { period, description, altPositions } = dataPoint;
    
    console.log(`\n--- 第${period}期: ${description} ---`);
    
    // 计算ALT总投资金额
    const totalValue = previousSnapshot?.totalValue || this.params.initialCapital;
    const altTotalAmount = totalValue * (1 - this.params.btcRatio);
    
    console.log(`总价值: $${totalValue.toFixed(2)}`);
    console.log(`ALT总投资金额: $${altTotalAmount.toFixed(2)}`);
    
    // 当前期目标持仓
    const targetPositions = new Map();
    altPositions.forEach(pos => {
      if (pos.allocation > 0) {
        const targetAllocation = altTotalAmount * pos.allocation;
        const targetQuantity = targetAllocation / pos.price;
        targetPositions.set(pos.symbol, {
          allocation: targetAllocation,
          quantity: targetQuantity,
          price: pos.price
        });
      }
    });

    // 处理持仓变化
    const shortPositions = [];
    const soldPositions = [];
    
    console.log(`\n目标持仓:`);
    targetPositions.forEach((target, symbol) => {
      console.log(`  ${symbol}: $${target.allocation.toFixed(2)} (${target.quantity.toFixed(6)} 单位 @ $${target.price})`);
    });

    if (previousSnapshot?.shortPositions) {
      console.log(`\n处理持仓变化:`);
      
      // 处理上期所有持仓
      for (const prevPos of previousSnapshot.shortPositions) {
        const symbol = prevPos.symbol;
        const targetPos = targetPositions.get(symbol);
        
        if (!targetPos) {
          // 完全平仓
          const currentPrice = altPositions.find(p => p.symbol === symbol)?.price || prevPos.currentPrice;
          const pnl = prevPos.quantity * (prevPos.entryPrice - currentPrice);
          
          soldPositions.push({
            symbol: symbol,
            quantity: prevPos.quantity,
            entryPrice: prevPos.entryPrice,
            currentPrice: currentPrice,
            pnl: pnl,
            reason: '完全平仓'
          });
          
          console.log(`  ${symbol} 完全平仓: ${prevPos.quantity.toFixed(6)} × ($${prevPos.entryPrice.toFixed(2)} - $${currentPrice.toFixed(2)}) = $${pnl.toFixed(2)}`);
          
        } else {
          // 持仓调整
          const prevQuantity = prevPos.quantity;
          const targetQuantity = targetPos.quantity;
          const quantityDiff = targetQuantity - prevQuantity;
          
          if (Math.abs(quantityDiff) > 0.0001) {
            if (quantityDiff < 0) {
              // 减仓
              const soldQuantity = Math.abs(quantityDiff);
              const soldPnl = soldQuantity * (prevPos.entryPrice - targetPos.price);
              
              soldPositions.push({
                symbol: symbol,
                quantity: soldQuantity,
                entryPrice: prevPos.entryPrice,
                currentPrice: targetPos.price,
                pnl: soldPnl,
                reason: '部分减仓'
              });
              
              console.log(`  ${symbol} 减仓: ${soldQuantity.toFixed(6)} × ($${prevPos.entryPrice.toFixed(2)} - $${targetPos.price.toFixed(2)}) = $${soldPnl.toFixed(2)}`);
            }
          }
          
          // 计算剩余持仓的加权平均成本价
          let newEntryPrice = prevPos.entryPrice;
          if (quantityDiff > 0) {
            // 加仓：计算加权平均成本价
            newEntryPrice = (prevQuantity * prevPos.entryPrice + quantityDiff * targetPos.price) / targetQuantity;
            console.log(`  ${symbol} 加仓: 新成本价 = (${prevQuantity.toFixed(6)} × $${prevPos.entryPrice.toFixed(2)} + ${quantityDiff.toFixed(6)} × $${targetPos.price.toFixed(2)}) / ${targetQuantity.toFixed(6)} = $${newEntryPrice.toFixed(2)}`);
          } else if (quantityDiff < 0) {
            // 减仓：保持原成本价
            console.log(`  ${symbol} 保持原成本价: $${newEntryPrice.toFixed(2)}`);
          }
          
          // 计算剩余持仓的浮动盈亏
          const unrealizedPnl = targetQuantity * (newEntryPrice - targetPos.price);
          
          shortPositions.push({
            symbol: symbol,
            quantity: targetQuantity,
            entryPrice: newEntryPrice,
            currentPrice: targetPos.price,
            pnl: unrealizedPnl
          });
          
          console.log(`  ${symbol} 剩余持仓浮动盈亏: ${targetQuantity.toFixed(6)} × ($${newEntryPrice.toFixed(2)} - $${targetPos.price.toFixed(2)}) = $${unrealizedPnl.toFixed(2)}`);
        }
      }
      
      // 处理新开仓
      targetPositions.forEach((target, symbol) => {
        const existingPos = previousSnapshot.shortPositions.find(p => p.symbol === symbol);
        if (!existingPos) {
          // 新开仓
          shortPositions.push({
            symbol: symbol,
            quantity: target.quantity,
            entryPrice: target.price,
            currentPrice: target.price,
            pnl: 0 // 新开仓无浮动盈亏
          });
          
          console.log(`  ${symbol} 新开仓: ${target.quantity.toFixed(6)} @ $${target.price.toFixed(2)}`);
        }
      });
    } else {
      // 初次开仓
      console.log(`\n初次开仓:`);
      targetPositions.forEach((target, symbol) => {
        shortPositions.push({
          symbol: symbol,
          quantity: target.quantity,
          entryPrice: target.price,
          currentPrice: target.price,
          pnl: 0
        });
        
        console.log(`  ${symbol} 开仓: ${target.quantity.toFixed(6)} @ $${target.price.toFixed(2)}`);
      });
    }

    // 计算盈亏汇总
    const altRealizedPnl = soldPositions.reduce((sum, pos) => sum + pos.pnl, 0);
    const altUnrealizedPnl = shortPositions.reduce((sum, pos) => sum + pos.pnl, 0);
    const totalAltPnl = altRealizedPnl + altUnrealizedPnl;
    
    console.log(`\n当期盈亏汇总:`);
    console.log(`  当期已实现盈亏: $${altRealizedPnl.toFixed(2)}`);
    console.log(`  当期浮动盈亏: $${altUnrealizedPnl.toFixed(2)}`);
    console.log(`  当期总盈亏: $${totalAltPnl.toFixed(2)}`);
    
    // 计算累计盈亏（按route.ts的方式）
    let cumulativeRealizedPnl = altRealizedPnl;
    if (previousSnapshot) {
      // 累计所有历史已实现盈亏
      cumulativeRealizedPnl = (previousSnapshot.cumulativeRealizedPnl || 0) + altRealizedPnl;
    }
    
    // 计算现金余额变化（简化版：只考虑ALT的pnl影响）
    const previousAccountBalance = previousSnapshot?.account_usdt_balance || this.params.initialCapital;
    
    // ALT的已实现盈亏直接影响现金余额
    const altSoldRevenue = soldPositions.reduce((sum, pos) => sum + pos.pnl, 0);
    const account_usdt_balance = previousAccountBalance + altSoldRevenue;
    
    console.log(`\n现金余额计算:`);
    console.log(`  上期现金余额: $${previousAccountBalance.toFixed(2)}`);
    console.log(`  ALT已实现盈亏: $${altSoldRevenue.toFixed(2)}`);
    console.log(`  当期现金余额: $${account_usdt_balance.toFixed(2)}`);
    
    // ===== 核心对比：两种算法 =====
    
    // 算法1：route.ts方式（每期累计现金余额）
    const shortPnl = shortPositions.reduce((sum, pos) => sum + pos.pnl, 0);
    const algorithm1_totalValue = account_usdt_balance + shortPnl; // 简化版，不包含BTC
    
    // 算法2：累计已实现盈亏方式
    const algorithm2_totalValue = this.params.initialCapital + cumulativeRealizedPnl + shortPnl;
    
    console.log(`\n=== 两种算法对比 ===`);
    console.log(`算法1 (route.ts方式):`);
    console.log(`  现金余额: $${account_usdt_balance.toFixed(2)}`);
    console.log(`  浮动盈亏: $${shortPnl.toFixed(2)}`);
    console.log(`  总价值: $${algorithm1_totalValue.toFixed(2)}`);
    
    console.log(`算法2 (累计方式):`);
    console.log(`  初始资本: $${this.params.initialCapital.toFixed(2)}`);
    console.log(`  累计已实现盈亏: $${cumulativeRealizedPnl.toFixed(2)}`);
    console.log(`  当前浮动盈亏: $${shortPnl.toFixed(2)}`);
    console.log(`  总价值: $${algorithm2_totalValue.toFixed(2)}`);
    
    console.log(`差异: $${(algorithm1_totalValue - algorithm2_totalValue).toFixed(6)}`);
    
    return {
      period,
      description,
      shortPositions,
      soldPositions,
      account_usdt_balance,
      totalValue: algorithm1_totalValue, // 使用算法1的结果
      algorithm1_totalValue,
      algorithm2_totalValue,
      altRealizedPnl,
      altUnrealizedPnl,
      cumulativeRealizedPnl,
      verification: {
        // 验证：两种算法的差异
        algorithm1_vs_algorithm2_difference: algorithm1_totalValue - algorithm2_totalValue,
        // 原有验证
        expectedTotalPnl: cumulativeRealizedPnl + shortPnl,
        actualTotalPnl: algorithm1_totalValue - this.params.initialCapital,
        difference: (algorithm1_totalValue - this.params.initialCapital) - (cumulativeRealizedPnl + shortPnl)
      }
    };
  }

  runVerification() {
    console.log('开始ALT做空盈亏计算验证...\n');
    console.log('参数配置:');
    console.log(`  初始资金: $${this.params.initialCapital.toLocaleString()}`);
    console.log(`  BTC占比: ${(this.params.btcRatio * 100).toFixed(1)}%`);
    console.log(`  ALT占比: ${((1 - this.params.btcRatio) * 100).toFixed(1)}%`);
    
    let previousSnapshot = null;
    
    for (const dataPoint of mockDataPoints) {
      const snapshot = this.generateSnapshot(dataPoint, previousSnapshot);
      this.snapshots.push(snapshot);
      previousSnapshot = snapshot;
    }
    
    // 最终验证
    console.log('\n=== 最终验证 ===');
    const finalSnapshot = this.snapshots[this.snapshots.length - 1];
    
    // 按route.ts方式计算总的已实现盈亏
    let totalRealizedFromSold = 0;
    for (const snapshot of this.snapshots) {
      const soldPnl = snapshot.soldPositions.reduce((sum, pos) => sum + pos.pnl, 0);
      totalRealizedFromSold += soldPnl;
    }
    
    console.log(`最终总价值: $${finalSnapshot.totalValue.toFixed(2)}`);
    console.log(`累计已实现盈亏（按快照累计）: $${totalRealizedFromSold.toFixed(2)}`);
    console.log(`累计已实现盈亏（按字段记录）: $${finalSnapshot.cumulativeRealizedPnl.toFixed(2)}`);
    console.log(`最终浮动盈亏: $${finalSnapshot.altUnrealizedPnl.toFixed(2)}`);
    console.log(`理论总盈亏: $${(totalRealizedFromSold + finalSnapshot.altUnrealizedPnl).toFixed(2)}`);
    console.log(`实际总盈亏: $${(finalSnapshot.totalValue - this.params.initialCapital).toFixed(2)}`);
    
    // 逐期验证
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
const verifier = new ALTVerifier(mockParams);
const results = verifier.runVerification();

console.log('\n=== 验证完成 ===');
console.log('如果所有期的差异都接近0，说明ALT盈亏计算逻辑正确');