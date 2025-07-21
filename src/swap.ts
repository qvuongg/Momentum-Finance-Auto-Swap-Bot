import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { fromHEX } from '@mysten/sui.js/utils';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';

// Import MMT Finance CLMM SDK for constants and types
import { MmtSDK, Utils, Types } from '@mmt-finance/clmm-sdk';

export interface SwapConfig {
  poolId: string;
  baseToken: string;
  quoteToken: string;
  amount: number;
  useAllBalance: boolean;  // If true, swap entire balance instead of fixed amount
  slippageTolerance: number;
  network: 'mainnet' | 'testnet';
  rpcUrl: string;
  clmmPackageId: string;
  globalConfig: string;
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  error?: string;
  timestamp: Date;
  amount: number;
  fromToken: string;
  toToken: string;
}

// Contract addresses sẽ được load từ .env thông qua config

export class MomentumSwapper {
  private suiClient: SuiClient;
  private keypair: Ed25519Keypair;
  private config: SwapConfig;

  constructor(privateKey: string, config: SwapConfig) {
    this.config = config;
    
    // Khởi tạo SUI client
    this.suiClient = new SuiClient({
      url: config.rpcUrl || getFullnodeUrl(config.network)
    });

    // Tạo keypair từ private key (hỗ trợ nhiều định dạng)
    this.keypair = this.createKeypairFromPrivateKey(privateKey);

    console.log(`✅ Momentum Swapper initialized for ${config.network}`);
    console.log(`📍 Pool ID: ${config.poolId}`);
    console.log(`💼 Wallet Address: ${this.keypair.getPublicKey().toSuiAddress()}`);
  }

  // Getter để access config từ outside class
  public getConfig(): SwapConfig {
    return this.config;
  }

  /**
   * Thực hiện swap từ QUOTE token sang BASE token
   * Ví dụ: SUI (quote) -> DEEP (base)
   */
  async swapQuoteToBase(): Promise<SwapResult> {
    const timestamp = new Date();
    
    try {
      const baseSymbol = this.config.baseToken.split('::').pop();
      const quoteSymbol = this.config.quoteToken.split('::').pop();
      
      // Get quote token coins first to check balance
      const quoteCoins = await this.suiClient.getCoins({
        owner: this.keypair.getPublicKey().toSuiAddress(),
        coinType: this.config.quoteToken
      });

      if (quoteCoins.data.length === 0) {
        throw new Error(`Không có ${quoteSymbol} coin để swap`);
      }

      const decimals = 1_000_000; // USDC decimals
      const totalBalance = quoteCoins.data.reduce((sum, coin) => sum + Number(coin.balance), 0);
      
      // Determine amount to swap
      let amountIn: number;
      let swapAmount: number;
      
      if (this.config.useAllBalance) {
        amountIn = totalBalance; // Use entire balance
        swapAmount = totalBalance / decimals;
        console.log(`🔄 Bắt đầu swap TOÀN BỘ ${swapAmount.toFixed(6)} ${quoteSymbol} -> ${baseSymbol}...`);
      } else {
        amountIn = Math.floor(this.config.amount * decimals);
        swapAmount = this.config.amount;
        console.log(`🔄 Bắt đầu swap ${swapAmount} ${quoteSymbol} -> ${baseSymbol}...`);
      }
      
      console.log(`💰 Tổng ${quoteSymbol} có sẵn: ${(totalBalance / decimals).toFixed(6)} ${quoteSymbol}`);
      console.log(`💱 Swapping ${swapAmount.toFixed(6)} ${quoteSymbol} (${amountIn} raw units)`);

      // Initialize MMT SDK
      const sdk = MmtSDK.NEW({
        network: this.config.network as 'mainnet' | 'testnet',
        suiClientUrl: this.config.rpcUrl,
      });

      // Create transaction 
      const txb = new TransactionBlock();
      txb.setSender(this.keypair.getPublicKey().toSuiAddress());
      
      // Merge coins if needed  
      let primaryCoin = txb.object(quoteCoins.data[0].coinObjectId);
      if (quoteCoins.data.length > 1) {
        console.log(`🔗 Merging ${quoteCoins.data.length} coins...`);
        const otherCoins = quoteCoins.data.slice(1).map(coin => txb.object(coin.coinObjectId));
        txb.mergeCoins(primaryCoin, otherCoins);
      }

      // Prepare input coin for swap
      let inputCoin;
      if (this.config.useAllBalance) {
        // Use entire merged coin
        inputCoin = primaryCoin;
        console.log(`💸 Sử dụng toàn bộ coin (${swapAmount.toFixed(6)} ${quoteSymbol})`);
      } else {
        // Split coin for specific amount
        [inputCoin] = txb.splitCoins(primaryCoin, [txb.pure(amountIn)]);
        console.log(`✂️  Split ${swapAmount} ${quoteSymbol} từ balance`);
      }

      // Use SDK's built-in swap method
      console.log('🚀 Using SDK built-in swap method...');
      
      try {
        const poolParams = {
          objectId: this.config.poolId,
          tokenXType: this.config.baseToken,
          tokenYType: this.config.quoteToken,
        };

        const swapResult = sdk.Pool.swap(
          txb as any,
          poolParams,
          BigInt(amountIn),
          inputCoin as any, // cast to bypass type issue
          false, // isXtoY = false (USDC -> USDT)
          this.keypair.getPublicKey().toSuiAddress(), // transfer to address
          BigInt(0), // no price limit
          false // useMvr
        );

        console.log('✅ SDK swap call completed');
      } catch (sdkError) {
        console.log(`⚠️  SDK swap failed: ${sdkError}. Fallback to manual...`);
        throw sdkError; // For now, don't fallback to avoid old errors
      }

      // Transfer remaining coins back (only if not using all balance)
      if (!this.config.useAllBalance) {
        const senderAddress = this.keypair.getPublicKey().toSuiAddress();
        txb.transferObjects([primaryCoin], senderAddress);
      }

      console.log('🚀 Executing transaction...');
      
      // Execute transaction
      const result = await this.suiClient.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: txb,
        options: {
          showEffects: true,
          showEvents: true,
        }
      });

      if (result.effects?.status?.status === 'success') {
        console.log(`✅ Swap thành công! TX: ${result.digest}`);
        return {
          success: true,
          txHash: result.digest,
          timestamp,
          amount: swapAmount, // Use actual swapped amount instead of config amount
          fromToken: this.config.quoteToken,
          toToken: this.config.baseToken
        };
      } else {
        throw new Error(`Transaction failed: ${result.effects?.status?.error}`);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Swap thất bại: ${errorMsg}`);
      
      return {
        success: false,
        error: errorMsg,
        timestamp,
        amount: this.config.amount,
        fromToken: this.config.quoteToken,
        toToken: this.config.baseToken
      };
    }
  }



  /**
   * Thực hiện swap từ BASE token sang QUOTE token
   * Ví dụ: DEEP (base) -> SUI (quote)
   */
  async swapBaseToQuote(): Promise<SwapResult> {
    const timestamp = new Date();
    
    try {
      const baseSymbol = this.config.baseToken.split('::').pop();
      const quoteSymbol = this.config.quoteToken.split('::').pop();
      
      // Get base token coins first to check balance
      const baseCoins = await this.suiClient.getCoins({
        owner: this.keypair.getPublicKey().toSuiAddress(),
        coinType: this.config.baseToken
      });

      if (baseCoins.data.length === 0) {
        throw new Error(`Không có ${baseSymbol} coin để swap`);
      }

      const decimals = 1_000_000; // USDT decimals
      const totalBalance = baseCoins.data.reduce((sum, coin) => sum + Number(coin.balance), 0);
      
      // Determine amount to swap
      let amountIn: number;
      let swapAmount: number;
      
      if (this.config.useAllBalance) {
        amountIn = totalBalance; // Use entire balance
        swapAmount = totalBalance / decimals;
        console.log(`🔄 Bắt đầu swap TOÀN BỘ ${swapAmount.toFixed(6)} ${baseSymbol} -> ${quoteSymbol}...`);
      } else {
        amountIn = Math.floor(this.config.amount * decimals);
        swapAmount = this.config.amount;
        console.log(`🔄 Bắt đầu swap ${swapAmount} ${baseSymbol} -> ${quoteSymbol}...`);
      }
      
      console.log(`💰 Tổng ${baseSymbol} có sẵn: ${(totalBalance / decimals).toFixed(6)} ${baseSymbol}`);
      console.log(`💱 Swapping ${swapAmount.toFixed(6)} ${baseSymbol} (${amountIn} raw units)`);

      // Initialize MMT SDK
      const sdk = MmtSDK.NEW({
        network: this.config.network as 'mainnet' | 'testnet',
        suiClientUrl: this.config.rpcUrl,
      });

      // Create transaction 
      const txb = new TransactionBlock();
      txb.setSender(this.keypair.getPublicKey().toSuiAddress());
      
      // Merge coins if needed  
      let primaryCoin = txb.object(baseCoins.data[0].coinObjectId);
      if (baseCoins.data.length > 1) {
        console.log(`🔗 Merging ${baseCoins.data.length} coins...`);
        const otherCoins = baseCoins.data.slice(1).map(coin => txb.object(coin.coinObjectId));
        txb.mergeCoins(primaryCoin, otherCoins);
      }

      // Prepare input coin for swap
      let inputCoin;
      if (this.config.useAllBalance) {
        // Use entire merged coin
        inputCoin = primaryCoin;
        console.log(`💸 Sử dụng toàn bộ coin (${swapAmount.toFixed(6)} ${baseSymbol})`);
      } else {
        // Split coin for specific amount
        [inputCoin] = txb.splitCoins(primaryCoin, [txb.pure(amountIn)]);
        console.log(`✂️  Split ${swapAmount} ${baseSymbol} từ balance`);
      }

      // Use SDK's built-in swap method
      console.log('🚀 Using SDK built-in swap method...');
      
      try {
        const poolParams = {
          objectId: this.config.poolId,
          tokenXType: this.config.baseToken,
          tokenYType: this.config.quoteToken,
        };

        const swapResult = sdk.Pool.swap(
          txb as any,
          poolParams,
          BigInt(amountIn),
          inputCoin as any, // cast to bypass type issue
          true, // isXtoY (USDT -> USDC)
          this.keypair.getPublicKey().toSuiAddress(), // transfer to address
          BigInt(0), // no price limit
          false // useMvr
        );

        console.log('✅ SDK swap call completed');
      } catch (sdkError) {
        console.log(`⚠️  SDK swap failed: ${sdkError}. Fallback to manual...`);
        
        // Fallback to working approach
        const swapResult = txb.moveCall({
          target: `${this.config.clmmPackageId}::trade::flash_swap`,
          arguments: [
            txb.object(this.config.poolId),
            txb.pure(true, 'bool'),
            txb.pure(true, 'bool'),
            txb.pure(amountIn, 'u64'),
            txb.pure("1000", 'u128'),
            txb.object('0x0000000000000000000000000000000000000000000000000000000000000006'),
            txb.object('0x2375a0b1ec12010aaea3b2545acfa2ad34cfbba03ce4b59f4c39e1e25eed1b2a'),
          ],
          typeArguments: [
            this.config.baseToken,
            this.config.quoteToken
          ],
        });
      }

      // Transfer remaining coins back (only if not using all balance)
      if (!this.config.useAllBalance) {
        const senderAddress = this.keypair.getPublicKey().toSuiAddress();
        txb.transferObjects([primaryCoin], senderAddress);
      }

      console.log('🚀 Executing transaction...');
      
      // Execute transaction
      const result = await this.suiClient.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: txb,
        options: {
          showEffects: true,
          showEvents: true,
        }
      });

      if (result.effects?.status?.status === 'success') {
        console.log(`✅ Swap thành công! TX: ${result.digest}`);
        return {
          success: true,
          txHash: result.digest,
          timestamp,
          amount: swapAmount, // Use actual swapped amount instead of config amount
          fromToken: this.config.baseToken,
          toToken: this.config.quoteToken
        };
      } else {
        throw new Error(`Transaction failed: ${result.effects?.status?.error}`);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Swap thất bại: ${errorMsg}`);
      
      return {
        success: false,
        error: errorMsg,
        timestamp,
        amount: this.config.amount,
        fromToken: this.config.baseToken,
        toToken: this.config.quoteToken
      };
    }
  }


  /**
   * Kiểm tra số dư ví (legacy method - để backward compatibility)
   */
  async checkBalance(): Promise<{ sui: number; usdc: number }> {
    const balances = await this.checkWalletBalance();
    // Map về format cũ để không break existing code
    return { 
      sui: balances.quote, // Quote token cho balance check trong bot logic
      usdc: balances.base   // Base token cho balance check trong bot logic
    };
  }

  /**
   * Kiểm tra số dư ví đầy đủ: SUI gas + BASE token + QUOTE token
   */
  async checkWalletBalance(): Promise<{
    suiGas: number;
    base: number;
    quote: number;
    baseSymbol: string;
    quoteSymbol: string;
  }> {
    try {
      const address = this.keypair.getPublicKey().toSuiAddress();
      
      const baseSymbol = this.config.baseToken.split('::').pop() || 'BASE';
      const quoteSymbol = this.config.quoteToken.split('::').pop() || 'QUOTE';
      
      // 1. Luôn kiểm tra SUI gas balance
      const suiGasBalance = await this.suiClient.getBalance({
        owner: address,
        coinType: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI'
      });
      const suiGas = parseInt(suiGasBalance.totalBalance) / 1_000_000_000;

      // 2. Kiểm tra BASE token balance
      let baseBalance;
      try {
        baseBalance = await this.suiClient.getBalance({
          owner: address,
          coinType: this.config.baseToken
        });
      } catch {
        baseBalance = { totalBalance: '0' };
      }
      
      // 3. Kiểm tra QUOTE token balance  
      let quoteBalance;
      try {
        quoteBalance = await this.suiClient.getBalance({
          owner: address,
          coinType: this.config.quoteToken
        });
      } catch {
        quoteBalance = { totalBalance: '0' };
      }

      // Determine decimals based on token type
      const getTokenDecimals = (tokenType: string): number => {
        if (tokenType.includes('::sui::SUI')) return 1_000_000_000; // 9 decimals
        if (tokenType.includes('::usdc::') || tokenType.includes('::USDC')) return 1_000_000; // 6 decimals
        if (tokenType.includes('::usdt::') || tokenType.includes('::USDT')) return 1_000_000; // 6 decimals
        return 1_000_000_000; // Default 9 decimals for most tokens
      };

      const baseAmount = parseInt(baseBalance.totalBalance) / getTokenDecimals(this.config.baseToken);
      const quoteAmount = parseInt(quoteBalance.totalBalance) / getTokenDecimals(this.config.quoteToken);

      return {
        suiGas,
        base: baseAmount,
        quote: quoteAmount,
        baseSymbol,
        quoteSymbol
      };
    } catch (error) {
      console.error('❌ Lỗi khi kiểm tra số dư:', error);
      return {
        suiGas: 0,
        base: 0,
        quote: 0,
        baseSymbol: 'BASE',
        quoteSymbol: 'QUOTE'
      };
    }
  }

  /**
   * Hiển thị số dư ví với format đẹp
   */
  async displayWalletBalance(): Promise<void> {
    const balances = await this.checkWalletBalance();
    
    console.log('\n💰 SỐ DƯ VÍ:');
    console.log(`   🟡 SUI (Gas): ${balances.suiGas.toFixed(4)} SUI`);
    console.log(`   🔵 ${balances.baseSymbol} (Base): ${balances.base.toFixed(6)} ${balances.baseSymbol}`);
    console.log(`   🟢 ${balances.quoteSymbol} (Quote): ${balances.quote.toFixed(6)} ${balances.quoteSymbol}`);
    
    // Cảnh báo nếu số dư thấp
    if (balances.suiGas < 0.1) {
      console.log(`   ⚠️  SUI gas thấp! Cần ít nhất 0.1 SUI để trả phí giao dịch`);
    }
    
    const swapAmount = parseFloat(process.env.SWAP_AMOUNT || '0.1');
    if (balances.base < swapAmount && balances.quote < swapAmount) {
      console.log(`   ⚠️  Không đủ token để swap! Cần ít nhất ${swapAmount} ${balances.baseSymbol} hoặc ${balances.quoteSymbol}`);
    }
    
    console.log('');
  }

  /**
   * Tạo keypair từ private key với nhiều định dạng
   */
  private createKeypairFromPrivateKey(privateKey: string): Ed25519Keypair {
    try {
      // Nếu là Bech32 format (suiprivkey1...)
      if (privateKey.startsWith('suiprivkey1')) {
        console.log('🔓 Đang decode Bech32 private key...');
        const decoded = decodeSuiPrivateKey(privateKey);
        console.log(`✅ Decode thành công! Schema: ${decoded.schema}`);
        return Ed25519Keypair.fromSecretKey(decoded.secretKey);
      }
      
      // Nếu là hex string với prefix 0x
      if (privateKey.startsWith('0x')) {
        return Ed25519Keypair.fromSecretKey(fromHEX(privateKey));
      }
      
      // Nếu là hex string không có prefix
      if (privateKey.length === 64 && /^[0-9a-fA-F]{64}$/.test(privateKey)) {
        return Ed25519Keypair.fromSecretKey(fromHEX('0x' + privateKey));
      }
      
      // Nếu là base64 string
      if (privateKey.length === 44) {
        const bytes = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
        return Ed25519Keypair.fromSecretKey(bytes);
      }
      
      // Fallback: thử parse như hex với prefix
      return Ed25519Keypair.fromSecretKey(fromHEX(privateKey.startsWith('0x') ? privateKey : '0x' + privateKey));
      
    } catch (error) {
      throw new Error(`Không thể tạo keypair từ private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Lấy địa chỉ ví
   */
  getWalletAddress(): string {
    return this.keypair.getPublicKey().toSuiAddress();
  }

  /**
   * Lấy symbol của token
   */
  getTokenSymbol(tokenType: 'base' | 'quote'): string {
    const tokenAddress = tokenType === 'base' ? this.config.baseToken : this.config.quoteToken;
    return tokenAddress.split('::').pop() || tokenType.toUpperCase();
  }

} 