# Flower Life — 花卉電商後端

花卉電商全端專案，提供前台購物流程與後台管理功能。前台顧客可瀏覽商品、加入購物車（支援訪客與登入雙模式）、結帳下單並模擬付款；後台管理員可進行商品 CRUD 與訂單查閱。

---

## 技術棧

| 類別 | 技術 | 版本 |
|------|------|------|
| Runtime | Node.js | — |
| Web 框架 | Express | ~4.16.1 |
| 資料庫 | better-sqlite3 (SQLite) | ^12.8.0 |
| 模板引擎 | EJS | ^5.0.1 |
| 認證 | jsonwebtoken (JWT HS256) | ^9.0.2 |
| 密碼雜湊 | bcrypt | ^6.0.0 |
| UUID 生成 | uuid | ^11.1.0 |
| CSS 框架 | Tailwind CSS | ^4.2.2 |
| 測試框架 | Vitest | ^2.1.9 |
| HTTP 測試 | supertest | ^7.2.2 |
| API 文件 | swagger-jsdoc | ^6.2.8 |

---

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 建立環境變數

```bash
cp .env.example .env
```

編輯 `.env`，**至少設定 JWT_SECRET**（伺服器啟動時若未設定會強制結束）：

```env
JWT_SECRET=your-super-secret-key-at-least-32-chars
BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
ADMIN_EMAIL=admin@hexschool.com
ADMIN_PASSWORD=12345678
```

### 3. 啟動開發伺服器

```bash
# 終端 1：啟動後端
node server.js

# 終端 2：Tailwind CSS watch（修改樣式時需要）
npm run dev:css
```

### 4. 執行測試

```bash
npm test
```

### 5. 生產啟動（先 build CSS）

```bash
npm start
```

---

## 預設帳號

首次啟動時，資料庫會自動 seed：

| 角色 | Email | 密碼 |
|------|-------|------|
| 管理員 | admin@hexschool.com | 12345678 |

可透過 `.env` 的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 覆寫預設值。

---

## 常用指令一覽

| 指令 | 說明 |
|------|------|
| `npm start` | build CSS 後啟動生產伺服器 |
| `node server.js` | 直接啟動開發伺服器 |
| `npm run dev:css` | Tailwind watch mode |
| `npm run css:build` | 一次性 minify CSS |
| `npm test` | 執行所有測試（依固定順序） |
| `npm run openapi` | 輸出 `openapi.json` 規格檔 |

---

## 文件索引

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 目錄結構、啟動流程、API 路由總覽、DB Schema |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 命名規則、新增模組步驟、環境變數表 |
| [FEATURES.md](./FEATURES.md) | 功能行為描述、請求/回應格式、錯誤碼 |
| [TESTING.md](./TESTING.md) | 測試規範、輔助函式、撰寫新測試步驟 |
| [CHANGELOG.md](./CHANGELOG.md) | 更新日誌 |
| [plans/](./plans/) | 開發計畫（進行中） |
| [plans/archive/](./plans/archive/) | 已完成計畫歸檔 |
