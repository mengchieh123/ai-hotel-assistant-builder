#!/bin/bash

echo "🎁 [translate:準備產品經理測試包]"
echo "=========================================="
echo ""

# 1️⃣ [translate:創建測試包目錄]
echo "1️⃣ [translate:創建測試包]..."
mkdir -p PM_Testing_Package
cd PM_Testing_Package

# 2️⃣ [translate:複製前端測試界面]
echo "2️⃣ [translate:複製測試文件]..."
cp ../pm-test-interface.html ./
cp ../PM_TEST_GUIDE.md ./

# 3️⃣ [translate:創建簡單的啟動指南]
cat > START_HERE.md << 'START'
# 🚀 [translate:產品經理測試包 - 快速開始]

## [translate:開始測試只需] 3 [translate:步驟]！

### [translate:步驟 1]：[translate:啟動測試界面]

**Windows [translate:用戶]：**
1. [translate:雙擊] `start-windows.bat` [translate:文件]
2. [translate:瀏覽器會自動打開測試界面]

**Mac [translate:用戶]：**
1. [translate:雙擊] `start-mac.command` [translate:文件]
2. [translate:瀏覽器會自動打開測試界面]

**[translate:手動方式]：**
1. [translate:直接雙擊] `pm-test-interface.html` [translate:文件]
2. [translate:用瀏覽器打開]

---

### [translate:步驟 2]：[translate:開始測試]

[translate:測試界面打開後]：

1. **[translate:使用快速測試按鈕]**（[translate:左側綠色按鈕]）
   - [translate:點擊]「[translate:價格查詢]」
   - [translate:點擊]「[translate:設施查詢]」
   - [translate:點擊]「[translate:訂房服務]」

2. **[translate:手動輸入測試]**（[translate:底部輸入框]）
   - [translate:輸入]：「[translate:我要訂12月24號入住3晚，我是會員，小孩6歲]」
   - [translate:點擊]「[translate:發送]」[translate:按鈕]

3. **[translate:查看統計]**（[translate:右側面板]）
   - [translate:查看成功率]
   - [translate:查看平均回應時間]

---

### [translate:步驟 3]：[translate:記錄結果]

[translate:測試完成後]：

1. [translate:點擊]「[translate:導出結果]」[translate:按鈕]
2. [translate:保存 JSON 文件]
3. [translate:填寫] `測試報告模板.docx`
4. [translate:發送給開發團隊]

---

## 📋 [translate:測試清單]

[translate:請測試以下場景]：

### ✅ [translate:必測項目]（5 [translate:分鐘]）

- [ ] [translate:價格查詢]
- [ ] [translate:設施查詢]
- [ ] [translate:訂房意圖]
- [ ] [translate:基礎對話]

### ✅ [translate:重點項目]（10 [translate:分鐘]）

- [ ] [translate:多條件訂房]（[translate:包含日期、天數、會員]）
- [ ] [translate:會員優惠查詢]
- [ ] [translate:兒童政策查詢]
- [ ] [translate:特殊需求]（[translate:無障礙、輪椅]）

### ✅ [translate:進階項目]（5 [translate:分鐘]）

- [ ] [translate:英文查詢]（"We need two rooms for Christmas"）
- [ ] [translate:極限複雜查詢]
- [ ] [translate:房型比較]

---

## 🎯 [translate:評分標準]

### A+ [translate:級]（[translate:優秀]）
- ✅ [translate:基礎功能全部正常]
- ✅ [translate:回應速度] < 1 [translate:秒]
- ✅ [translate:回應內容詳細準確]

### B [translate:級]（[translate:良好]）
- ✅ [translate:基礎功能正常]
- ⚠️ [translate:部分複雜查詢需優化]

### C [translate:級]（[translate:及格]）
- ✅ [translate:基礎功能正常]
- ⚠️ [translate:多個增強功能失敗]

---

## 📞 [translate:需要幫助]？

### [translate:界面打不開]？
- [translate:確認已執行啟動腳本]
- [translate:或直接雙擊] `pm-test-interface.html`

### [translate:如何知道測試成功]？
- [translate:查看右側統計面板]
- [translate:成功率顯示為綠色]

### [translate:發現問題怎麼辦]？
- [translate:截圖保存證據]
- [translate:填寫]「[translate:問題反饋表]」
- [translate:發送給開發團隊]

---

## 📊 [translate:當前版本資訊]

- **AI [translate:版本]**: v5.2.0-OPTIMIZED
- **[translate:測試日期]**: 2025-11-05
- **[translate:預期成功率]**: 75%+

---

**✅ [translate:準備好了]！[translate:現在開始測試吧]！** 🚀
START

echo "   ✅ START_HERE.md"

# 4️⃣ [translate:創建 Windows 啟動腳本]
cat > start-windows.bat << 'WINBAT'
@echo off
echo [translate:啟動產品經理測試界面]...
echo.

REM [translate:檢查 Python 是否安裝]
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [translate:Python 未安裝，使用瀏覽器直接打開]...
    start pm-test-interface.html
    exit
)

echo [translate:啟動本地服務器]...
start http://localhost:8000/pm-test-interface.html
python -m http.server 8000

pause
WINBAT

echo "   ✅ start-windows.bat"

# 5️⃣ [translate:創建 Mac 啟動腳本]
cat > start-mac.command << 'MACCMD'
#!/bin/bash

echo "[translate:啟動產品經理測試界面]..."
echo ""

# [translate:檢查 Python3 是否安裝]
if ! command -v python3 &> /dev/null; then
    echo "[translate:Python3 未安裝，使用瀏覽器直接打開]..."
    open pm-test-interface.html
    exit 0
fi

echo "[translate:啟動本地服務器]..."
open http://localhost:8000/pm-test-interface.html
python3 -m http.server 8000
MACCMD

chmod +x start-mac.command
echo "   ✅ start-mac.command"

# 6️⃣ [translate:創建問題反饋表]
cat > 問題反饋表.txt << 'FEEDBACK'
═══════════════════════════════════════
  AI [translate:訂房助理 - 問題反饋表]
═══════════════════════════════════════

[translate:測試者姓名]：________________

[translate:測試日期]：2025-11-__

[translate:測試時間]：__:__ - __:__

───────────────────────────────────────

📋 [translate:問題 1]

[translate:測試項目]：□ [translate:價格查詢]  □ [translate:訂房意圖]  □ [translate:設施查詢]  □ [translate:其他]：________

[translate:輸入內容]：


[translate:預期結果]：


[translate:實際結果]：


[translate:嚴重程度]：□ 🔴 [translate:高]  □ 🟡 [translate:中]  □ 🟢 [translate:低]

[translate:是否有截圖]：□ [translate:是]  □ [translate:否]

───────────────────────────────────────

📋 [translate:問題 2]

[translate:測試項目]：□ [translate:價格查詢]  □ [translate:訂房意圖]  □ [translate:設施查詢]  □ [translate:其他]：________

[translate:輸入內容]：


[translate:預期結果]：


[translate:實際結果]：


[translate:嚴重程度]：□ 🔴 [translate:高]  □ 🟡 [translate:中]  □ �� [translate:低]

[translate:是否有截圖]：□ [translate:是]  □ [translate:否]

───────────────────────────────────────

📋 [translate:問題 3]

[translate:測試項目]：□ [translate:價格查詢]  □ [translate:訂房意圖]  □ [translate:設施查詢]  □ [translate:其他]：________

[translate:輸入內容]：


[translate:預期結果]：


[translate:實際結果]：


[translate:嚴重程度]：□ 🔴 [translate:高]  □ 🟡 [translate:中]  □ 🟢 [translate:低]

[translate:是否有截圖]：□ [translate:是]  □ [translate:否]

───────────────────────────────────────

💡 [translate:其他建議]：




───────────────────────────────────────

✅ [translate:整體評價]：

□ A+ ([translate:優秀] - [translate:可以發佈])
□ B  ([translate:良好] - [translate:建議優化])
□ C  ([translate:及格] - [translate:需要改進])
□ D  ([translate:不及格] - [translate:不建議發佈])

[translate:測試完成時間]：__:__

═══════════════════════════════════════
FEEDBACK

echo "   ✅ 問題反饋表.txt"

# 7️⃣ [translate:創建測試報告模板]
cat > 測試報告模板.txt << 'REPORT'
═══════════════════════════════════════
  AI [translate:訂房助理 - 測試報告]
═══════════════════════════════════════

[translate:報告編號]：PM-TEST-2025-11-__

[translate:測試者]：________________

[translate:測試日期]：2025-11-__

[translate:AI 版本]：v5.2.0-OPTIMIZED

───────────────────────────────────────

📊 [translate:測試統計]

[translate:總測試數]：____ [translate:次]

[translate:成功數]：____ [translate:次]

[translate:失敗數]：____ [translate:次]

[translate:成功率]：_____%

[translate:平均回應時間]：____ [translate:毫秒]

───────────────────────────────────────

✅ [translate:測試結果明細]

🔴 [translate:核心功能]（[translate:必須通過]）

1. [translate:價格查詢]       □ [translate:通過]  □ [translate:失敗]
2. [translate:設施查詢]       □ [translate:通過]  □ [translate:失敗]
3. [translate:訂房意圖]       □ [translate:通過]  □ [translate:失敗]
4. [translate:基礎對話]       □ [translate:通過]  □ [translate:失敗]

[translate:核心功能成功率]：_____%

🟡 [translate:重要功能]（[translate:應該通過]）

5. [translate:多條件訂房]     □ [translate:通過]  □ [translate:失敗]
6. [translate:會員優惠]       □ [translate:通過]  □ [translate:失敗]
7. [translate:兒童政策]       □ [translate:通過]  □ [translate:失敗]
8. [translate:特殊需求]       □ [translate:通過]  □ [translate:失敗]

[translate:重要功能成功率]：_____%

🟢 [translate:增強功能]（[translate:期望通過]）

9.  [translate:英文查詢]      □ [translate:通過]  □ [translate:失敗]
10. [translate:極限複雜]      □ [translate:通過]  □ [translate:失敗]
11. [translate:房型比較]      □ [translate:通過]  □ [translate:失敗]
12. [translate:綜合測試]      □ [translate:通過]  □ [translate:失敗]

[translate:增強功能成功率]：_____%

───────────────────────────────────────

🎯 [translate:最終評級]

□ A+ ([translate:優秀] - [translate:所有功能優異])
□ B  ([translate:良好] - [translate:核心正常，部分需優化])
□ C  ([translate:及格] - [translate:有核心問題])
□ D  ([translate:不及格] - [translate:多個核心失敗])

───────────────────────────────────────

💡 [translate:發現的問題]（[translate:詳細請見問題反饋表]）

1. 


2. 


3. 


───────────────────────────────────────

📋 [translate:建議改進]

[translate:優先級高]（🔴 [translate:必須修復]）：


[translate:優先級中]（🟡 [translate:建議優化]）：


[translate:優先級低]（🟢 [translate:增強功能]）：


───────────────────────────────────────

✅ [translate:發佈建議]

□ [translate:可以立即發佈]
□ [translate:優化後可發佈]
□ [translate:修復問題後發佈]
□ [translate:不建議發佈]

[translate:備註]：


───────────────────────────────────────

[translate:測試完成時間]：2025-11-__ __:__

[translate:報告提交時間]：2025-11-__ __:__

═══════════════════════════════════════
REPORT

echo "   ✅ 測試報告模板.txt"

# 8️⃣ [translate:創建 README]
cat > README.txt << 'README'
═══════════════════════════════════════
  🎁 AI [translate:訂房助理 - 產品經理測試包]
═══════════════════════════════════════

[translate:歡迎使用 AI 訂房助理測試包]！

[translate:這個測試包專為產品經理和非技術人員設計]，
[translate:讓您能夠輕鬆測試最新版本的 AI 訂房助理]。

───────────────────────────────────────

📦 [translate:測試包內容]

1. pm-test-interface.html    - [translate:前端測試界面]
2. START_HERE.md             - [translate:快速開始指南] ⭐
3. PM_TEST_GUIDE.md          - [translate:完整測試手冊]
4. start-windows.bat         - Windows [translate:啟動腳本]
5. start-mac.command         - Mac [translate:啟動腳本]
6. 問題反饋表.txt             - [translate:問題記錄模板]
7. 測試報告模板.txt           - [translate:測試報告模板]
8. README.txt                - [translate:本文檔]

───────────────────────────────────────

🚀 [translate:快速開始]

[translate:步驟 1]：[translate:閱讀] START_HERE.md

[translate:步驟 2]：[translate:執行啟動腳本]
  • Windows: [translate:雙擊] start-windows.bat
  • Mac: [translate:雙擊] start-mac.command

[translate:步驟 3]：[translate:開始測試]！

───────────────────────────────────────

📊 [translate:當前版本]

AI [translate:版本]: v5.2.0-OPTIMIZED
[translate:發佈日期]: 2025-11-05
[translate:核心功能]: 
  ✅ [translate:多意圖識別]
  ✅ [translate:完整實體提取]
  ✅ [translate:英文查詢支援]
  ✅ [translate:特殊需求識別]

[translate:預期成功率]: 75%+
[translate:回應時間]: ~50ms

───────────────────────────────────────

💡 [translate:測試建議]

1. [translate:先測試基礎功能]（5 [translate:分鐘]）
2. [translate:再測試重要功能]（10 [translate:分鐘]）
3. [translate:最後測試增強功能]（5 [translate:分鐘]）

[translate:總耗時]：[translate:約] 20 [translate:分鐘]

───────────────────────────────────────

📞 [translate:需要幫助]？

[translate:遇到問題請聯繫開發團隊]：
• [translate:提供截圖]
• [translate:填寫問題反饋表]
• [translate:說明詳細步驟]

───────────────────────────────────────

✨ [translate:祝測試順利]！

═══════════════════════════════════════
README

echo "   ✅ README.txt"

cd ..

# 9️⃣ [translate:打包測試包]
echo ""
echo "9️⃣ [translate:打包測試包]..."
zip -r PM_Testing_Package.zip PM_Testing_Package/ > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "   ✅ PM_Testing_Package.zip"
else
    echo "   ⚠️  [translate:打包失敗，請手動複製文件夾]"
fi

# 🔟 [translate:生成交付清單]
echo ""
echo "=========================================="
echo "🎉 [translate:產品經理測試包已準備完成]！"
echo "=========================================="
echo ""
echo "📦 [translate:測試包位置]："
echo "   ./PM_Testing_Package/"
echo "   ./PM_Testing_Package.zip"
echo ""
echo "📋 [translate:包含文件]："
echo "   1. ✅ pm-test-interface.html    - [translate:測試界面]"
echo "   2. ✅ START_HERE.md             - [translate:快速開始] ⭐"
echo "   3. ✅ PM_TEST_GUIDE.md          - [translate:完整手冊]"
echo "   4. ✅ start-windows.bat         - Windows [translate:啟動]"
echo "   5. ✅ start-mac.command         - Mac [translate:啟動]"
echo "   6. ✅ 問題反饋表.txt             - [translate:問題記錄]"
echo "   7. ✅ 測試報告模板.txt           - [translate:測試報告]"
echo "   8. ✅ README.txt                - [translate:說明文檔]"
echo ""
echo "🎯 [translate:交付方式]："
echo "   1. [translate:將] PM_Testing_Package.zip [translate:發送給產品經理]"
echo "   2. [translate:或直接提供] PM_Testing_Package [translate:文件夾]"
echo ""
echo "📖 [translate:產品經理使用步驟]："
echo "   1. [translate:解壓縮] PM_Testing_Package.zip"
echo "   2. [translate:閱讀] README.txt"
echo "   3. [translate:開始測試]（[translate:參考] START_HERE.md）"
echo ""
echo "✅ [translate:測試包已就緒，可以交付]！"

