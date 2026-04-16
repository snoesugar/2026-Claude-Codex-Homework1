# CLAUDE.md

## 專案概述

**Flower Life** — 花卉電商後端

Node.js + Express 4 · better-sqlite3 · EJS SSR · JWT 認證 · Tailwind CSS · Vitest 測試

提供前台購物流程（商品瀏覽、購物車、結帳、訂單）與後台管理（商品 CRUD、訂單檢視），購物車支援「訪客（X-Session-Id）」與「登入（JWT Bearer）」雙模式。

---

## 常用指令

```bash
# 安裝依賴
npm install

# 開發（需分兩個終端）
node server.js          # 啟動伺服器（Port 3001）
npm run dev:css         # Tailwind CSS watch mode

# 生產啟動（先 build CSS 再啟動）
npm start

# 執行測試（依固定順序，不可並行）
npm test

# 產出 OpenAPI JSON
npm run openapi

# 單獨 build CSS
npm run css:build
```

---

## 關鍵規則

1. **JWT_SECRET 是必要環境變數**：`server.js` 啟動時若未設定會立即 `process.exit(1)`，本機開發務必先建立 `.env`（參考 `.env.example`）。
2. **統一回應格式**：所有 API 回應皆為 `{ data, error, message }`，成功時 `error: null`，失敗時 `data: null`，不可破壞此結構。
3. **購物車雙模式**：購物車 API 同時支援 JWT Bearer token（已登入）和 `X-Session-Id` header（訪客），兩者無法混用同一筆購物車資料；若 Authorization header 存在但 Token 無效，直接回傳 401（不 fallback 到 session）。
4. **建立訂單為 Transaction**：`POST /api/orders` 在單一 SQLite transaction 內完成「建立訂單、建立訂單明細、扣庫存、清空購物車」，任一步驟失敗則全部回滾。
5. **測試執行順序固定**：`vitest.config.js` 指定 `fileParallelism: false`，6 個測試檔依 auth → products → cart → orders → adminProducts → adminOrders 的順序執行，測試間共用同一個 SQLite 資料庫實例，不可任意更改順序。
6. **功能開發使用 `docs/plans/` 記錄計畫**；完成後移至 `docs/plans/archive/`。

---

## 詳細文件

- [./docs/README.md](./docs/README.md) — 項目介紹、技術棧、快速開始
- [./docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、資料流、API 路由總覽、資料庫 Schema
- [./docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則、新增模組步驟、環境變數
- [./docs/FEATURES.md](./docs/FEATURES.md) — 功能列表、行為描述、錯誤碼
- [./docs/TESTING.md](./docs/TESTING.md) — 測試規範、執行順序、輔助函式
- [./docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌
