import * as dotenv from 'dotenv';
import { MomentumSwapper, SwapConfig, SwapResult } from './swap';

// Load environment variables
dotenv.config();

// Token price constants (approximate USD values)
const TOKEN_PRICES = {
  SUI: 3.5,     // SUI price ~$3.5
  USDT: 1.0,    // USDT ~$1.0 
  USDC: 1.0,    // USDC ~$1.0
};

interface BotStats {
  totalSwaps: number;
  successfulSwaps: number;
  failedSwaps: number;
  totalVolume: number;
  totalVolumeUSD: number;
  totalGasSpent: number;      // SUI amount spent on gas
  startTime: Date;
  lastSwapTime?: Date;
}

class MomentumBot {
  private swapper: MomentumSwapper;
  private stats: BotStats;
  private swapInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private swapDirection: 'QUOTE_TO_BASE' | 'BASE_TO_QUOTE' = 'BASE_TO_QUOTE';

  constructor() {
    // Validate environment variables
    this.validateEnvironment();

    // Parse SWAP_AMOUNT configuration
    const swapAmountConfig = process.env.SWAP_AMOUNT || '0.1';
    const useAllBalance = swapAmountConfig.toUpperCase() === 'ALL';
    const fixedAmount = useAllBalance ? 0 : parseFloat(swapAmountConfig);

    // Create swap configuration
    const config: SwapConfig = {
      poolId: process.env.MOMENTUM_POOL_ID!,
      baseToken: process.env.BASE_TOKEN || 'SUI',
      quoteToken: process.env.QUOTE_TOKEN || 'USDC',
      amount: fixedAmount,
      useAllBalance: useAllBalance,
      slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '0.02'),
      network: (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet',
      rpcUrl: process.env.SUI_RPC_URL!,
      clmmPackageId: process.env.MOMENTUM_CLMM_PACKAGE_ID!,
      globalConfig: process.env.MOMENTUM_GLOBAL_CONFIG!
    };

    // Initialize swapper
    this.swapper = new MomentumSwapper(process.env.SUI_PRIVATE_KEY!, config);

    // Initialize stats
    this.stats = {
      totalSwaps: 0,
      successfulSwaps: 0,
      failedSwaps: 0,
      totalVolume: 0,
      totalVolumeUSD: 0,
      totalGasSpent: 0,
      startTime: new Date()
    };

    console.log('🚀 Momentum Finance Bot đã khởi tạo thành công!');
    console.log(`⚙️  Network: ${config.network}`);
    console.log(`💱 Trading Pair: ${config.baseToken}/${config.quoteToken}`);
    console.log(`💰 Swap Strategy: ${config.useAllBalance ? 'ALL BALANCE' : `${config.amount} tokens`}`);
    console.log(`⏱️  Interval: ${process.env.SWAP_INTERVAL_SECONDS || 5} giây`);
    console.log(`🎯 Slippage: ${(config.slippageTolerance * 100).toFixed(1)}%`);
    console.log('─'.repeat(60));
  }

  private validateEnvironment(): void {
    const requiredVars = [
      'SUI_PRIVATE_KEY',
      'SUI_RPC_URL',
      'MOMENTUM_POOL_ID',
      'MOMENTUM_CLMM_PACKAGE_ID',
      'MOMENTUM_GLOBAL_CONFIG'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.error('❌ Thiếu các biến môi trường sau:');
      missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
      });
      console.error('\n📋 Vui lòng tạo file .env dựa trên env.example');
      process.exit(1);
    }

    // Validate private key format
    const privateKey = process.env.SUI_PRIVATE_KEY!;
    
    // SUI private key có thể có các định dạng:
    // 1. Bech32 format (Sui Wallet mới): suiprivkey1...
    // 2. Hex string 64 ký tự (không có 0x prefix)
    // 3. Hex string 66 ký tự (có 0x prefix) 
    // 4. Base64 encoded string
    let isValidFormat = false;
    
    if (privateKey.startsWith('suiprivkey1')) {
      // Format: Bech32 (Sui Wallet format)
      isValidFormat = privateKey.length > 50 && /^suiprivkey1[a-z0-9]+$/.test(privateKey);
    } else if (privateKey.startsWith('0x') && privateKey.length === 66) {
      // Format: 0x + 64 hex chars
      isValidFormat = /^0x[0-9a-fA-F]{64}$/.test(privateKey);
    } else if (privateKey.length === 64) {
      // Format: 64 hex chars (no prefix)
      isValidFormat = /^[0-9a-fA-F]{64}$/.test(privateKey);
    } else if (privateKey.length === 44) {
      // Format: Base64 (thường dài 44 ký tự)
      isValidFormat = /^[A-Za-z0-9+/]={0,2}$/.test(privateKey);
    }
    
    if (!isValidFormat) {
      console.error('❌ SUI_PRIVATE_KEY không đúng định dạng');
      console.error('   Các định dạng hợp lệ:');
      console.error('   - Bech32: suiprivkey1...');
      console.error('   - Hex 64 ký tự: abcd1234...');
      console.error('   - Hex với prefix: 0xabcd1234...');
      console.error('   - Base64: ABC123+/...');
      process.exit(1);
    }

    console.log('✅ Tất cả biến môi trường đã được kiểm tra');
  }

  private async performSwap(): Promise<void> {
    console.log(`\n🔄 Bắt đầu swap #${this.stats.totalSwaps + 1} (${this.swapDirection})`);
    console.log(`📅 ${new Date().toLocaleString('vi-VN')}`);

    // Check balance before swap
    const balance = await this.swapper.checkBalance();
    const walletBalance = await this.swapper.checkWalletBalance();
    
    // Get token symbols for logging
    const baseSymbol = walletBalance.baseSymbol;
    const quoteSymbol = walletBalance.quoteSymbol;
    
    console.log(`💰 Số dư hiện tại: ${walletBalance.base.toFixed(4)} ${baseSymbol}, ${walletBalance.quote.toFixed(4)} ${quoteSymbol} (Gas: ${walletBalance.suiGas.toFixed(4)} SUI)`);
    
    // Determine if we can perform the swap
    let canSwap = false;
    
    // Check balance based on swap strategy
    if (this.swapper.getConfig().useAllBalance) {
      // For ALL mode, just need any positive balance
      if (this.swapDirection === 'QUOTE_TO_BASE' && walletBalance.quote > 0) {
        canSwap = true;
      } else if (this.swapDirection === 'BASE_TO_QUOTE' && walletBalance.base > 0) {
        canSwap = true;
      }
    } else {
      // For fixed amount mode, check if balance >= required amount
      const swapAmount = this.swapper.getConfig().amount;
      if (this.swapDirection === 'QUOTE_TO_BASE' && walletBalance.quote >= swapAmount) {
        canSwap = true;
      } else if (this.swapDirection === 'BASE_TO_QUOTE' && walletBalance.base >= swapAmount) {
        canSwap = true;
      }
    }

    if (!canSwap) {
      console.log('❌ Số dư không đủ để thực hiện swap');
      // Switch direction if balance insufficient
      this.swapDirection = this.swapDirection === 'QUOTE_TO_BASE' ? 'BASE_TO_QUOTE' : 'QUOTE_TO_BASE';
      const fromToken = this.swapDirection === 'QUOTE_TO_BASE' ? quoteSymbol : baseSymbol;
      const toToken = this.swapDirection === 'QUOTE_TO_BASE' ? baseSymbol : quoteSymbol;
      console.log(`🔀 Chuyển hướng swap sang: ${fromToken} -> ${toToken}`);
      return;
    }

    let result: SwapResult;

    // Perform swap based on direction
    if (this.swapDirection === 'QUOTE_TO_BASE') {
      result = await this.swapper.swapQuoteToBase();
    } else {
      result = await this.swapper.swapBaseToQuote();
    }

    // Update statistics
    this.stats.totalSwaps++;
    this.stats.lastSwapTime = new Date();

    if (result.success) {
      this.stats.successfulSwaps++;
      this.stats.totalVolume += result.amount;
      
      // Calculate volume in USD
      const fromTokenSymbol = result.fromToken.split('::').pop()?.toUpperCase() || 'UNKNOWN';
      const toTokenSymbol = result.toToken.split('::').pop()?.toUpperCase() || 'UNKNOWN';
      
      // Use from token price for volume calculation
      let volumeUSD = result.amount;
      if (fromTokenSymbol in TOKEN_PRICES) {
        volumeUSD = result.amount * TOKEN_PRICES[fromTokenSymbol as keyof typeof TOKEN_PRICES];
      }
      this.stats.totalVolumeUSD += volumeUSD;
      
      // Estimate gas spent (roughly 0.001-0.002 SUI per transaction)
      const estimatedGas = 0.0015; // SUI
      this.stats.totalGasSpent += estimatedGas;
      
      console.log(`✅ Swap thành công!`);
      console.log(`   📊 TX Hash: ${result.txHash}`);
      console.log(`   💸 Amount: ${result.amount} ${fromTokenSymbol} -> ${toTokenSymbol}`);
      console.log(`   💰 Volume: $${volumeUSD.toFixed(2)} USD`);
      console.log(`   ⛽ Gas: ~${estimatedGas.toFixed(4)} SUI`);
      
      // Switch direction for next swap to create volume
      this.swapDirection = this.swapDirection === 'QUOTE_TO_BASE' ? 'BASE_TO_QUOTE' : 'QUOTE_TO_BASE';
    } else {
      this.stats.failedSwaps++;
      console.log(`❌ Swap thất bại: ${result.error}`);
    }

    // Display statistics
    this.displayStats();
  }

  private displayStats(): void {
    const runTime = Math.floor((new Date().getTime() - this.stats.startTime.getTime()) / 1000 / 60);
    const successRate = this.stats.totalSwaps > 0 ? (this.stats.successfulSwaps / this.stats.totalSwaps * 100).toFixed(1) : '0';

    console.log('\n📊 THỐNG KÊ BOT:');
    console.log(`   ⏳ Thời gian chạy: ${runTime} phút`);
    console.log(`   🔄 Tổng số swap: ${this.stats.totalSwaps}`);
    console.log(`   ✅ Thành công: ${this.stats.successfulSwaps} (${successRate}%)`);
    console.log(`   ❌ Thất bại: ${this.stats.failedSwaps}`);
    console.log(`   💰 Tổng volume: ${this.stats.totalVolume.toFixed(4)} tokens ($${this.stats.totalVolumeUSD.toFixed(2)})`);
    console.log(`   ⛽ Tổng gas: ${this.stats.totalGasSpent.toFixed(4)} SUI`);
    if (this.stats.lastSwapTime) {
      console.log(`   🕐 Swap cuối: ${this.stats.lastSwapTime.toLocaleTimeString('vi-VN')}`);
    }
    console.log('─'.repeat(60));
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Bot đã đang chạy!');
      return;
    }

    console.log('🎯 Chuẩn bị khởi động bot...');
    
    // Kiểm tra và hiển thị số dư ví đầy đủ
    await this.swapper.displayWalletBalance();
    
    // Kiểm tra điều kiện cần thiết
    const balances = await this.swapper.checkWalletBalance();
    
    // Validation trước khi start
    if (balances.suiGas < 0.05) {
      console.log('❌ SUI gas quá thấp! Cần ít nhất 0.05 SUI để trả phí giao dịch.');
      console.log('💡 Hãy nạp thêm SUI từ faucet hoặc exchange.');
      return;
    }
    
    // Check balance based on swap strategy
    if (this.swapper.getConfig().useAllBalance) {
      if (balances.base <= 0 && balances.quote <= 0) {
        console.log('❌ Không có token nào để swap!');
        console.log(`💡 Cần có ít nhất một chút ${balances.baseSymbol} hoặc ${balances.quoteSymbol} để bắt đầu.`);
        return;
      }
    } else {
      const swapAmount = this.swapper.getConfig().amount;
      if (balances.base < swapAmount && balances.quote < swapAmount) {
        console.log('❌ Không đủ token để thực hiện swap!');
        console.log(`💡 Cần ít nhất ${swapAmount} ${balances.baseSymbol} hoặc ${balances.quoteSymbol} để bắt đầu.`);
        return;
      }
    }
    
    console.log('✅ Tất cả điều kiện đã đủ, bắt đầu chạy bot...\n');
    this.isRunning = true;

    // Perform first swap immediately
    await this.performSwap();

    // Set up interval for subsequent swaps
    const intervalSeconds = parseInt(process.env.SWAP_INTERVAL_SECONDS || '5');
    this.swapInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.performSwap();
      }
    }, intervalSeconds * 1000);

    console.log(`⏰ Bot sẽ thực hiện swap mỗi ${intervalSeconds} giây`);
    console.log('🛑 Nhấn Ctrl+C để dừng bot\n');
  }

  public stop(): void {
    if (!this.isRunning) {
      console.log('⚠️  Bot đã dừng!');
      return;
    }

    console.log('\n🛑 Đang dừng bot...');
    this.isRunning = false;

    if (this.swapInterval) {
      clearInterval(this.swapInterval);
      this.swapInterval = null;
    }

    this.displayStats();
    console.log('✅ Bot đã dừng thành công!');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Nhận signal SIGINT, đang dừng bot...');
  bot.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Nhận signal SIGTERM, đang dừng bot...');
  bot.stop();
  process.exit(0);
});

// Khởi tạo và chạy bot
const bot = new MomentumBot();

// Start the bot
bot.start().catch((error) => {
  console.error('❌ Lỗi khi khởi động bot:', error);
  process.exit(1);
});