#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 啟動 AI 飯店助理系統"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 檢查 Ollama 是否在運行
if ! curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    echo "📦 啟動 Ollama 服務..."
    ollama serve > /dev/null 2>&1 &
    sleep 5
    echo "✅ Ollama 服務已啟動"
else
    echo "✅ Ollama 服務已在運行"
fi

# 檢查模型是否存在
echo "🔍 檢查模型..."
if ! ollama list | grep -q "qwen2.5:7b"; then
    echo "📥 下載模型 qwen2.5:7b (這可能需要幾分鐘)..."
    ollama pull qwen2.5:7b
    echo "✅ 模型下載完成"
else
    echo "✅ 模型已存在"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 啟動 Web 服務..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

node index-ollama.js
