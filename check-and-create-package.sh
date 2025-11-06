#!/bin/bash

echo "🔍 [translate:檢查測試包狀態]"
echo "========================================"
echo ""

# 1️⃣ [translate:檢查當前目錄]
echo "1️⃣ [translate:當前目錄]："
pwd
echo ""

# 2️⃣ [translate:查找測試包文件]
echo "2️⃣ [translate:查找 PM_Testing_Package 相關文件]："
find . -name "*PM_Testing*" -type f -o -name "*PM_Testing*" -type d
echo ""

# 3️⃣ [translate:列出所有 zip 文件]
echo "3️⃣ [translate:當前目錄所有 zip 文件]："
ls -lh *.zip 2>/dev/null || echo "   [translate:沒有找到 zip 文件]"
echo ""

# 4️⃣ [translate:檢查是否有測試界面文件]
echo "4️⃣ [translate:檢查測試界面文件]："
if [ -f "pm-test-interface.html" ]; then
    echo "   ✅ pm-test-interface.html [translate:存在]"
    SIZE=$(ls -lh pm-test-interface.html | awk '{print $5}')
    echo "   [translate:文件大小]：$SIZE"
else
    echo "   ❌ pm-test-interface.html [translate:不存在]"
    echo "   [translate:需要創建測試界面]"
fi
echo ""

# 5️⃣ [translate:重新創建完整測試包]
echo "5️⃣ [translate:開始創建完整測試包]..."
echo ""

# [translate:清理舊文件]
rm -rf PM_Testing_Package PM_Testing_Package.zip

# [translate:創建目錄]
mkdir -p PM_Testing_Package

# [translate:創建測試界面]（[translate:簡化版]）
cat > PM_Testing_Package/pm-test-interface.html << 'HTML'
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>AI 訂房助理測試 v5.2.0</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 20px;
        }
        .container {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
        }
        .panel {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .quick-tests {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 20px;
        }
        .btn {
            padding: 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        }
        .btn-test {
            background: #10b981;
            color: white;
        }
        .btn-test:hover {
            background: #059669;
        }
        .chat-area {
            height: 400px;
            overflow-y: auto;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
            background: #fafafa;
        }
        .message {
            margin-bottom: 15px;
            padding: 10px 15px;
            border-radius: 8px;
        }
        .user {
            background: #667eea;
            color: white;
            margin-left: 20%;
        }
        .ai {
            background: white;
            border: 1px solid #e5e7eb;
            margin-right: 20%;
        }
        .input-area {
            display: flex;
            gap: 10px;
        }
        input {
            flex: 1;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
        }
        .btn-send {
            padding: 12px 24px;
            background: #667eea;
            color: white;
        }
        .stat {
            background: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
        }
        .btn-export {
            width: 100%;
            padding: 12px;
            background: #f59e0b;
            color: white;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏨 AI 訂房助理測試界面</h1>
        <p>版本：v5.2.0-OPTIMIZED</p>
        <p>API: https://ai-hotel-assistant-builder-production.up.railway.app\</p\>
    </div>

    <div class="container">
        <div class="panel">
            <h3>快速測試</h3>
            <div class="quick-tests">
                <button class="btn btn-test" onclick="test('豪華客房多少錢')">💰 價格查詢</button>
                <button class="btn btn-test" onclick="test('有游泳池嗎')">🏊 設施查詢</button>
                <button class="btn btn-test" onclick="test('我要訂房')">📅 訂房服務</button>
                <button class="btn btn-test" onclick="test('你好')">👋 問候</button>
                <button class="btn btn-test" onclick="test('我要訂12月24號入住3晚，我是會員，小孩6歲')">🎯 複雜查詢</button>
                <button class="btn btn-test" onclick="test('We need two rooms for Christmas')">🌐 英文</button>
            </div>

            <h3>對話區</h3>
            <div class="chat-area" id="chat"></div>
            <div class="input-area">
                <input type="text" id="input" placeholder="輸入查詢..." onkeypress="if(event.key==='Enter')send()">
                <button class="btn btn-send" onclick="send()">發送</button>
            </div>
        </div>

        <div class="panel">
            <h3>統計</h3>
            <div class="stat">
                <div>總查詢數</div>
                <div class="stat-value" id="total">0</div>
            </div>
            <div class="stat">
                <div>成功率</div>
                <div class="stat-value" id="rate">0%</div>
            </div>
            <div class="stat">
                <div>平均時間</div>
                <div class="stat-value" id="time">0ms</div>
            </div>
            <button class="btn btn-export" onclick="exportData()">📥 導出結果</button>
        </div>
    </div>

    <script>
        const API = 'https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat'\;
        let stats = {total: 0, success: 0, times: []};
        let results = [];

        function test(msg) {
            document.getElementById('input').value = msg;
            send();
        }

        async function send() {
            const input = document.getElementById('input');
            const msg = input.value.trim();
            if (!msg) return;

            addMsg(msg, 'user');
            input.value = '';

            const start = Date.now();
            try {
                const res = await fetch(API, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({message: msg})
                });
                const data = await res.json();
                const time = Date.now() - start;
                
                const reply = data.response?.message || data.response || '無回應';
                addMsg(reply, 'ai');

                stats.total++;
                stats.success++;
                stats.times.push(time);
                updateStats();

                results.push({
                    time: new Date().toISOString(),
                    query: msg,
                    response: reply,
                    responseTime: time,
                    intent: data.response?.intent,
                    entities: data.response?.entities
                });
            } catch (e) {
                addMsg('❌ 錯誤：' + e.message, 'ai');
                stats.total++;
                updateStats();
            }
        }

        function addMsg(text, type) {
            const chat = document.getElementById('chat');
            const div = document.createElement('div');
            div.className = 'message ' + type;
            div.textContent = text;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }

        function updateStats() {
            document.getElementById('total').textContent = stats.total;
            const rate = stats.total > 0 ? Math.round((stats.success/stats.total)*100) : 0;
            document.getElementById('rate').textContent = rate + '%';
            const avg = stats.times.length > 0 ? Math.round(stats.times.reduce((a,b)=>a+b,0)/stats.times.length) : 0;
            document.getElementById('time').textContent = avg + 'ms';
        }

        function exportData() {
            const data = JSON.stringify({
                summary: {
                    total: stats.total,
                    successRate: ((stats.success/stats.total)*100).toFixed(2) + '%',
                    avgTime: (stats.times.reduce((a,b)=>a+b,0)/stats.times.length).toFixed(0) + 'ms'
                },
                results
            }, null, 2);
            
            const blob = new Blob([data], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'test-results-' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
        }
    </script>
</body>
</html>
HTML

echo "   ✅ [translate:已創建測試界面]"

# [translate:創建說明文件]
cat > PM_Testing_Package/README.txt << 'README'
AI 訂房助理測試包
======================================

使用方法：
1. 雙擊打開 pm-test-interface.html
2. 點擊快速測試按鈕或輸入查詢
3. 查看右側統計數據
4. 點擊「導出結果」保存測試

API 端點：
https://ai-hotel-assistant-builder-production.up.railway.app

版本：v5.2.0-OPTIMIZED
預期成功率：75%+
README

echo "   ✅ [translate:已創建 README]"

# [translate:打包]
zip -r PM_Testing_Package.zip PM_Testing_Package/

echo ""
echo "========================================"
echo "🎉 [translate:測試包創建完成]！"
echo "========================================"
echo ""
ls -lh PM_Testing_Package.zip
echo ""
echo "[translate:包含文件]："
unzip -l PM_Testing_Package.zip
echo ""
echo "📥 [translate:下載方式]："
echo "   1. [translate:在文件瀏覽器找到] PM_Testing_Package.zip"
echo "   2. [translate:右鍵點擊] → Download"
echo ""
echo "✅ [translate:現在可以下載了]！"

