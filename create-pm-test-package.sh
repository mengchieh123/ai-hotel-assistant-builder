#!/bin/bash

echo "📦 開始創建產品經理測試包..."
rm -rf PM_Testing_Package PM_Testing_Package.zip
mkdir -p PM_Testing_Package

# 複製前端文件
cp pm-test-interface.html PM_Testing_Package/ 2>/dev/null || echo "pm-test-interface.html 不存在"

# 創建快速開始說明
cat > PM_Testing_Package/快速開始.txt << 'START'
[translate:產品經理測試包快速開始指南]

1. 雙擊 pm-test-interface.html 打開測試界面，或使用啟動腳本。
2. 執行測試，點擊快速測試按鈕或輸入查詢。
3. 查看右側統計與導出結果。

API 端點：
https://ai-hotel-assistant-builder-production.up.railway.app

版本：v5.2.0-OPTIMIZED
START

# 創建 README
cat > PM_Testing_Package/README.txt << 'README'
[translate:AI訂房助理產品經理測試包]

文件列表：
- pm-test-interface.html
- 快速開始.txt

使用方法：
- 直接打開pm-test-interface.html開始測試
README

# 打包
zip -r PM_Testing_Package.zip PM_Testing_Package/
echo "產品經理測試包已打包完成：PM_Testing_Package.zip"
