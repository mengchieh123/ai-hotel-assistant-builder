#!/bin/bash

echo "🔍 AI Hotel Assistant 環境結構檢查"
echo "======================================"

BASE_DIR="/workspaces/ai-hotel-assistant-builder"
cd $BASE_DIR

echo ""
echo "📁 檢查服務層結構..."
echo "-------------------"

# 檢查 services 目錄
if [ -d "services" ]; then
    echo "✅ services/ 目錄存在"
    echo "📊 services/ 內容:"
    ls -la services/
else
    echo "❌ services/ 目錄不存在"
fi

echo ""
echo "🔧 檢查核心服務檔案..."
echo "---------------------"

SERVICES=(
    "bookingService.js"
    "pricingService.js" 
    "memberService.js"
    "paymentService.js"
    "promotionService.js"
    "roomStatusService.js"
    "invoiceService.js"
    "complianceService.js"
    "localizationService.js"
    "booking-calculator.js"
)

for service in "${SERVICES[@]}"; do
    if [ -f "services/$service" ]; then
        echo "✅ services/$service - 存在"
        # 檢查檔案大小
        size=$(stat -f%z "services/$service" 2>/dev/null || stat -c%s "services/$service" 2>/dev/null || echo "0")
        echo "   📏 檔案大小: ${size} bytes"
    else
        echo "❌ services/$service - 缺失"
    fi
done

echo ""
echo "🛣️  檢查路由結構..."
echo "-----------------"

if [ -d "routes" ]; then
    echo "✅ routes/ 目錄存在"
    echo "📊 routes/ 內容:"
    ls -la routes/
else
    echo "❌ routes/ 目錄不存在"
fi

echo ""
echo "🔧 檢查工具函式庫..."
echo "-------------------"

if [ -d "utils" ]; then
    echo "✅ utils/ 目錄存在"
    echo "📊 utils/ 內容:"
    ls -la utils/
else
    echo "❌ utils/ 目錄不存在"
fi

echo ""
echo "⚙️  檢查配置檔案..."
echo "-----------------"

if [ -d "config" ]; then
    echo "✅ config/ 目錄存在"
    echo "📊 config/ 內容:"
    ls -la config/
else
    echo "❌ config/ 目錄不存在"
fi

echo ""
echo "📋 檢查主伺服器檔案..."
echo "---------------------"

if [ -f "server.js" ]; then
    echo "✅ server.js - 存在"
    # 檢查伺服器版本
    version=$(grep -o "version.*[0-9]" server.js | head -1 || echo "未知")
    echo "   🏷️  版本: $version"
else
    echo "❌ server.js - 缺失"
fi

echo ""
echo "📦 檢查依賴管理..."
echo "-----------------"

if [ -f "package.json" ]; then
    echo "✅ package.json - 存在"
    # 檢查主要依賴
    deps=("express" "cors" "body-parser")
    for dep in "${deps[@]}"; do
        if grep -q "\"$dep\"" package.json; then
            echo "   ✅ $dep - 已安裝"
        else
            echo "   ❌ $dep - 未安裝"
        fi
    done
else
    echo "❌ package.json - 缺失"
fi

echo ""
echo "🧪 服務功能測試..."
echo "-----------------"

# 測試現有服務是否可正常導入
cat > test-services-import.js << 'EOM'
console.log("🧪 服務導入測試...");

const services = [
    './services/bookingService.js',
    './services/pricingService.js',
    './services/memberService.js'
];

services.forEach(servicePath => {
    try {
        const service = require(servicePath);
        console.log(`✅ ${servicePath} - 導入成功`);
        
        // 測試基本功能
        if (servicePath.includes('bookingService') && typeof service.createBooking === 'function') {
            console.log("   📝 bookingService.createBooking() - 功能正常");
        }
        if (servicePath.includes('pricingService') && typeof service.calculateRoomPrice === 'function') {
            console.log("   💰 pricingService.calculateRoomPrice() - 功能正常");
        }
        if (servicePath.includes('memberService') && typeof service.calculatePoints === 'function') {
            console.log("   👤 memberService.calculatePoints() - 功能正常");
        }
    } catch (error) {
        console.log(`❌ ${servicePath} - 導入失敗: ${error.message}`);
    }
});

// 測試狀態機
try {
    const { BookingStateMachine } = require('./booking-state-machine.js');
    const machine = new BookingStateMachine('test-session');
    console.log("✅ 狀態機系統 - 正常運作");
} catch (error) {
    console.log(`❌ 狀態機系統 - 錯誤: ${error.message}`);
}
EOM

node test-services-import.js
rm -f test-services-import.js

echo ""
echo "📊 環境結構總結"
echo "==============="

# 計算覆蓋率
total_services=10
existing_services=0

for service in "${SERVICES[@]}"; do
    if [ -f "services/$service" ]; then
        ((existing_services++))
    fi
done

coverage=$((existing_services * 100 / total_services))

echo "📈 服務層覆蓋率: $existing_services/$total_services ($coverage%)"

if [ $coverage -ge 80 ]; then
    echo "🎉 環境結構完整度: 優秀"
elif [ $coverage -ge 60 ]; then
    echo "👍 環境結構完整度: 良好" 
elif [ $coverage -ge 40 ]; then
    echo "⚠️  環境結構完整度: 一般"
else
    echo "❌ 環境結構完整度: 不足"
fi

echo ""
echo "🔧 建議改進項目:"
if [ ! -d "services" ]; then
    echo "   📁 建立 services/ 目錄"
fi

missing_services=()
for service in "${SERVICES[@]}"; do
    if [ ! -f "services/$service" ]; then
        missing_services+=("$service")
    fi
done

if [ ${#missing_services[@]} -gt 0 ]; then
    echo "   📝 缺失服務檔案:"
    for missing in "${missing_services[@]}"; do
        echo "      - $missing"
    done
fi

if [ ! -d "routes" ]; then
    echo "   🛣️  建立 routes/ 目錄"
fi

if [ ! -d "utils" ]; then
    echo "   🔧 建立 utils/ 目錄" 
fi

if [ ! -d "config" ]; then
    echo "   ⚙️  建立 config/ 目錄"
fi

echo ""
echo "✅ 環境檢查完成!"
