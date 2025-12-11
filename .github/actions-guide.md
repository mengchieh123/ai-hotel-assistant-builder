# GitHub Actions 配置指南

## 已配置的工作流程

### 1. deploy-to-render.yml
**觸發條件**: 
- 推送到 main/master 分支
- Pull Request 到 main/master
- 手動觸發

**作用**: 
- 運行測試
- 部署到 Render
- 發送通知

### 2. test.yml
**觸發條件**:
- 推送到 develop/feature/release 分支
- Pull Request
- 每天定時運行

**作用**:
- 代碼質量檢查
- 安全審計
- 基礎功能測試

### 3. deploy-check.yml
**觸發條件**:
- Pull Request
- 手動觸發

**作用**:
- 檢查部署就緒狀態
- 提供修復建議

## 需要的 GitHub Secrets

在 GitHub 倉庫設置中添加以下 Secrets:

### 必須的:
1. `RENDER_API_KEY`
   - 獲取方式: Render Dashboard → Account Settings → API Keys
   - 用途: 調用 Render API 觸發部署

2. `RENDER_SERVICE_ID`
   - 獲取方式: Render 服務詳情頁的 URL
   - 格式: srv-xxxxxxxxxxxxxx
   - 用途: 指定要部署的服務

### 可選的:
3. `SLACK_WEBHOOK_URL`
   - 用於部署通知到 Slack

4. `DISCORD_WEBHOOK_URL`
   - 用於部署通知到 Discord

## 手動觸發部署

1. 訪問 GitHub 倉庫的 "Actions" 標籤頁
2. 選擇 "Deploy to Render" 工作流程
3. 點擊 "Run workflow"
4. 選擇分支並運行

## 故障排除

### 部署失敗
1. 檢查 Secrets 是否正確設置
2. 檢查 Render 服務 ID 是否有效
3. 查看 GitHub Actions 日誌獲取詳細錯誤

### 測試失敗
1. 檢查 package.json 語法
2. 確保 server.js 可以正常啟動
3. 驗證 Node.js 版本兼容性

### 健康檢查失敗
1. 確保 server.js 有 `/health` 端點
2. 檢查端口綁定 (使用 `process.env.PORT`)

## 監控
- GitHub Actions 日誌: Actions → 工作流程 → 點擊運行
- Render 日誌: Render Dashboard → 服務 → Logs
- 服務狀態: https://ai-hotel-assistant.onrender.com/health
EOF

# 創建 issue 模板
mkdir -p .github/ISSUE_TEMPLATE

cat > .github/ISSUE_TEMPLATE/deployment-issue.md << 'EOF'
---
name: 部署問題
about: 報告部署相關的問題
title: '[DEPLOY] '
labels: ['deployment', 'bug']
assignees: ''

---

## 部署問題描述
簡要描述部署時遇到的問題

## 環境信息
- **GitHub 倉庫**: 
- **分支**: 
- **部署目標**: Render
- **發生時間**: 

## 錯誤信息

## 重現步驟
1. 
2. 
3. 

## 預期行為
部署應該成功完成

## 實際行為
部署失敗/超時/錯誤

## 附加信息
- GitHub Actions 運行鏈接: 
- Render 服務鏈接: 
- 相關的 Issue/PR:
  
