## 🚀 自動化部署狀態

### GitHub Actions

[![Deploy to Render](https://github.com/mengchieh123/ai-hotel-assistant-builder/actions/workflows/deploy-to-render.yml/badge.svg)](https://github.com/mengchieh123/ai-hotel-assistant-builder/actions/workflows/deploy-to-render.yml)
[![Tests](https://github.com/mengchieh123/ai-hotel-assistant-builder/actions/workflows/test.yml/badge.svg)](https://github.com/mengchieh123/ai-hotel-assistant-builder/actions/workflows/test.yml)

### Render 部署

[![Render](https://img.shields.io/badge/Render-Deployed-46B3B3?logo=render)](https://ai-hotel-assistant.onrender.com)
![Render Status](https://img.shields.io/website?url=https%3A%2F%2Fai-hotel-assistant.onrender.com%2Fhealth)

## 📋 部署流程

1. **推送代碼**到 main 分支
2. **GitHub Actions**自動運行測試
3. **自動部署**到 Render
4. **健康檢查**確保服務正常
5. **發送通知**部署完成

## 🔧 手動部署

如果需要手動部署，可以在 GitHub Actions 頁面點擊 "Run workflow"。

## 📊 監控

- **GitHub Actions 日誌**: 查看測試和部署詳情
- **Render Dashboard**: 查看服務狀態和日誌
- **健康檢查**: https://ai-hotel-assistant.onrender.com/health

## 🐛 問題報告

如果部署失敗，請：
1. 檢查 GitHub Actions 日誌
2. 確保 GitHub Secrets 正確設置
3. 創建 [Deployment Issue](.github/ISSUE_TEMPLATE/deployment-issue.md)

