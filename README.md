# 🚀 Momentum Finance Auto Swap Bot

Bot tự động swap token trên **Momentum Finance** (Sui blockchain) để tích lũy volume và điểm **Bricks** cho airdrop **MMT token**.

## ✅ **HOẠT ĐỘNG THỰC TẾ TRÊN MAINNET!**

Bot đã được test thành công trên Sui Mainnet với các giao dịch thực:

- **TX #1**: `7949zdtuj1knWYDJNgqmbMZw3SVTJvYJWBNLddbZXgsr` (USDT → USDC)
- **TX #2**: `56L8L4Zu8GBGZhFwfaiZXqcajzV4pP4LcsNuXRE9yjyB` (USDT → USDC)
- **TX #3**: `FsHH2PiHJrTd4AA6Ubg49HPZKJabQnXsiezcreF7Df9V` (USDC → USDT)

## 🎯 **Tính năng**

- ✅ **Swap tự động USDT/USDC** trên Momentum Finance CLMM mỗi 5 giây
- ✅ **Tích hợp MMT SDK** chính thức (@mmt-finance/clmm-sdk)
- ✅ **Hoạt động trên Mainnet** với pool thực và liquidity cao
- ✅ **Bidirectional swap**: USDT ↔ USDC liên tục
- ✅ **Real-time pool info**: Giá, liquidity, fee từ SDK
- ✅ **Auto coin management**: Merge và split coins tự động
- ✅ **Error handling**: Xử lý lỗi và retry thông minh
- ✅ **Volume tracking**: Theo dõi volume để earn MMT airdrop
- ✅ **Secure config**: Private key an toàn trong .env
- ✅ **Cross-platform**: Hỗ trợ macOS và Windows

---

## 📋 **Yêu cầu hệ thống**

### **macOS**

- Node.js >= 18.0.0
- npm hoặc yarn
- Terminal/iTerm2

### **Windows**

- Node.js >= 18.0.0
- npm hoặc yarn
- PowerShell hoặc Command Prompt
- Git Bash (khuyến nghị)

---

## 🛠️ **Cài đặt**

### **📱 macOS**

#### 1. Cài đặt Node.js

```bash
# Homebrew (khuyến nghị)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node

# Hoặc tải từ https://nodejs.org/
```

#### 2. Clone dự án

```bash
git clone <repository-url>
cd momentum-finance-bot

# Hoặc download và giải nén
```

#### 3. Cài đặt dependencies

```bash
npm install
```

### **🪟 Windows**

#### 1. Cài đặt Node.js

1. Truy cập https://nodejs.org/
2. Tải **LTS version** (khuyến nghị)
3. Chạy installer và follow hướng dẫn
4. Restart computer sau khi cài

#### 2. Cài đặt Git (khuyến nghị)

1. Truy cập https://git-scm.com/
2. Tải Git for Windows
3. Cài đặt với **Git Bash** included

#### 3. Clone dự án

```bash
# Mở Git Bash hoặc PowerShell
git clone <repository-url>
cd momentum-finance-bot

# Hoặc download ZIP và giải nén
```

#### 4. Cài đặt dependencies

```bash
# Git Bash / PowerShell
npm install

# Nếu gặp lỗi permissions trên Windows:
npm install --no-optional
```

---

## 🔑 **Cấu hình Bot**

### 1. **Tạo file .env**

**macOS:**

```bash
cp env.example .env
```

**Windows (PowerShell):**

```powershell
Copy-Item env.example .env
```

**Windows (Command Prompt):**

```cmd
copy env.example .env
```

### 2. **Chỉnh sửa file .env**

Mở file `.env` và cập nhật:

````env
# Sui Network Configuration
SUI_PRIVATE_KEY=your_bech32_private_key_here
SUI_RPC_URL=https://fullnode.mainnet.sui.io
NETWORK=mainnet

# Momentum Finance Contract Addresses (Mainnet)
MOMENTUM_CLMM_PACKAGE_ID=0xc84b1ef2ac2ba5c3018e2b8c956ba5d0391e0e46d1daa1926d5a99a6a42526b4
MOMENTUM_GLOBAL_CONFIG=0x2375a0b1ec12010aaea3b2545acfa2ad34cfbba03ce4b59f4c39e1e25eed1b2a

# Pool Configuration (USDT/USDC Mainnet Pool)
MOMENTUM_POOL_ID=0xb0a595cb58d35e07b711ac145b4846c8ed39772c6d6f6716d89d71c64384543b
BASE_TOKEN=0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT
QUOTE_TOKEN=0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC

# Trading Configuration
SWAP_AMOUNT=ALL  # "ALL" = swap toàn bộ số dư, hoặc số cụ thể như "1"
SWAP_INTERVAL_SECONDS=5
SLIPPAGE_TOLERANCE=0.01

### **⚙️ SWAP_AMOUNT Options:**

```env
# Option 1: Swap toàn bộ số dư (khuyến nghị cho maximize volume)
SWAP_AMOUNT=ALL

# Option 2: Swap số lượng cố định
SWAP_AMOUNT=1        # Swap 1 token mỗi lần
SWAP_AMOUNT=0.5      # Swap 0.5 token mỗi lần
SWAP_AMOUNT=10       # Swap 10 token mỗi lần
````

**📈 Khuyến nghị:**

- **SWAP_AMOUNT=ALL**: Maximize volume để earn nhiều điểm Bricks nhất
- **Fixed amount**: Để test hoặc kiểm soát risk

# Logging

LOG_LEVEL=info

````

---

## 🔐 **Lấy Private Key**

### **Sui Wallet (Khuyến nghị)**

1. Mở Sui Wallet extension
2. **Settings** → **Security & Privacy**
3. **Export Private Key**
4. Copy private key format **Bech32** (`suiprivkey1...`)

### **Formats hỗ trợ:**

- ✅ **Bech32**: `suiprivkey1...` (Khuyến nghị)
- ✅ **Hex**: `0xabcd1234efgh5678...`
- ✅ **Base64**: `ABC123+/def456...`

### **⚠️ Bảo mật:**

- Chỉ dùng ví có ít token để test
- KHÔNG share private key với ai
- Backup ví an toàn

---

## 💰 **Chuẩn bị Token**

Bot cần các token sau trên **Sui Mainnet**:

1. **SUI**: ~2-3 SUI cho gas fees
2. **USDT**: ~5-10 USDT để swap
3. **USDC**: ~5-10 USDC để swap (optional)

### **Mua token:**

- **CEX**: Binance, Coinbase → withdraw to Sui wallet
- **DEX**: Cetus, Turbos, Aftermath
- **Bridge**: Wormhole, Portal

---

## ▶️ **Chạy Bot**

### **Development mode:**

**macOS/Linux:**

```bash
npm run dev
````

**Windows:**

```bash
# Git Bash / PowerShell
npm run dev

# Command Prompt
npm run dev
```

### **Production mode:**

```bash
# Build
npm run build

# Run
npm start
```

### **Expected Output:**

```
✅ Tất cả biến môi trường đã được kiểm tra
🔓 Đang decode Bech32 private key...
✅ Decode thành công! Schema: ED25519
✅ Momentum Swapper initialized for mainnet
📍 Pool ID: 0xb0a595cb58d35e07b711ac145b4846c8ed39772c6d6f6716d89d71c64384543b
💼 Wallet Address: 0xf852185fd42861d0ac653a353b6a4b08f703773ea6c6f71b8e758854dfa77218

🚀 Momentum Finance Bot đã khởi tạo thành công!
⚙️  Network: mainnet
💱 Trading Pair: USDT/USDC
💰 Swap Amount: 1 USDT
⏱️  Interval: 5 giây
🎯 Slippage: 1.0%

💰 SỐ DƯ VÍ:
   🟡 SUI (Gas): 2.5421 SUI
   🔵 USDT (Base): 12.740133 USDT
   🟢 USDC (Quote): 1.000209 USDC

✅ Tất cả điều kiện đã đủ, bắt đầu chạy bot...

🔄 Bắt đầu swap #1 (BASE_TO_QUOTE)
📅 14:43:23 20/7/2025
💰 Số dư hiện tại: 12.7401 USDT, 1.0002 USDC (Gas: 2.5421 SUI)
🔄 Bắt đầu swap 1 USDT -> USDC...
🔍 Querying pool information...
📊 Pool Info: {
  poolId: '0xb0a595cb58d35e07b711ac145b4846c8ed39772c6d6f6716d89d71c64384543b',
  tokenX: 'USDT',
  tokenY: 'USDC',
  currentSqrtPrice: '18449595087260495347',
  liquidity: '472249955782791175'
}
🚀 Using SDK built-in swap method...
✅ SDK swap call completed
🚀 Executing transaction...
✅ Swap thành công! TX: 56L8L4Zu8GBGZhFwfaiZXqcajzV4pP4LcsNuXRE9yjyB
```

---

## 🛑 **Dừng Bot**

**Tất cả platforms:**

```
Ctrl + C
```

Bot sẽ dừng an toàn và hiển thị thống kê cuối:

```
📊 THỐNG KÊ BOT:
   ⏳ Thời gian chạy: 15 phút
   🔄 Tổng số swap: 180
   ✅ Thành công: 175 (97.2%)
   ❌ Thất bại: 5
   💰 Tổng volume: 180.0000 tokens
```

---

## ⚙️ **Cấu hình nâng cao**

### **Thay đổi tần suất swap:**

```env
SWAP_INTERVAL_SECONDS=10  # Swap mỗi 10 giây
SWAP_INTERVAL_SECONDS=30  # Swap mỗi 30 giây
```

### **Thay đổi số lượng swap:**

```env
SWAP_AMOUNT=0.5   # Swap 0.5 USDT mỗi lần
SWAP_AMOUNT=2     # Swap 2 USDT mỗi lần
```

### **Thay đổi slippage:**

```env
SLIPPAGE_TOLERANCE=0.005  # 0.5% slippage (tight)
SLIPPAGE_TOLERANCE=0.02   # 2% slippage (loose)
```

### **Testnet mode:**

```env
NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io
# Update pool IDs to testnet addresses
```

---

## 🐛 **Xử lý lỗi thường gặp**

### **Windows specific:**

**"npm not recognized":**

```bash
# Restart Command Prompt sau khi cài Node.js
# Hoặc check PATH:
echo $env:PATH  # PowerShell
echo %PATH%     # Command Prompt
```

**"execution policy" error (PowerShell):**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Long path issue:**

```bash
git config --system core.longpaths true
```

### **Cross-platform:**

**"Cannot find module '@mmt-finance/clmm-sdk'":**

```bash
npm install @mmt-finance/clmm-sdk --save
```

**"Insufficient balance":**

- Check wallet có đủ SUI cho gas (>1 SUI)
- Check có đủ USDT/USDC để swap
- Giảm `SWAP_AMOUNT`

**"Pool not found":**

- Check `MOMENTUM_POOL_ID` đúng format
- Ensure mainnet/testnet consistency

**"Private key invalid":**

- Check private key format (Bech32 khuyến nghị)
- Ensure no extra spaces/characters

**"Transaction failed":**

- Tăng `SLIPPAGE_TOLERANCE`
- Check network connection
- Wait và retry

---

## 📊 **Monitoring & Stats**

Bot tracking các metrics:

- **Total swaps**: Số lần swap thành công
- **Success rate**: Tỷ lệ thành công (%)
- **Volume accumulated**: Tổng volume để earn MMT
- **Gas used**: Tổng SUI spent on gas
- **Real-time balances**: USDT, USDC, SUI

**Logs** được lưu trong:

- Console output (real-time)
- File logs (nếu configure)

---

## 🎁 **MMT Airdrop Benefits**

Bot giúp bạn:

- ✅ **Accumulate trading volume** trên Momentum Finance
- ✅ **Earn Bricks points** qua active trading
- ✅ **Qualify for MMT airdrop** khi launch
- ✅ **Auto compound** benefits 24/7

**Note**: Follow Momentum Finance announcements cho airdrop criteria updates.

---

## 🔗 **Resources**

- **Momentum Finance**: https://mmt.finance/
- **Momentum Docs**: https://developers.mmt.finance/
- **Momentum Discord**: https://discord.gg/momentum-finance
- **Sui Documentation**: https://docs.sui.io/
- **MMT SDK**: https://www.npmjs.com/package/@mmt-finance/clmm-sdk

---

## ⚠️ **Disclaimer**

- Bot chỉ dành cho **educational purposes**
- Trading bots có **rủi ro mất tiền**
- Luôn test trên **testnet** trước
- Chỉ sử dụng số tiền **bạn có thể mất**
- DYOR về Momentum Finance và MMT tokenomics

---

## 📄 **License**

MIT License - See LICENSE file for details.

---

**🎯 Happy Trading & Good Luck với MMT Airdrop! 🚀**
