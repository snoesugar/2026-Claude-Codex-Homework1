# DEVELOPMENT.md — 開發規範

---

## 模組系統

本專案使用 **CommonJS**（`require` / `module.exports`），唯一例外是 `vitest.config.js` 使用 ES Module（`import` / `export default`）。

- 所有 `src/`、`app.js`、`server.js`、`tests/` 使用 `require()`
- 不可在 `.js` 檔中混用 `import`（Node 不支援 CJS 檔案中的 ES Module 語法）

---

## 命名規則

### 檔案命名

| 類別 | 規則 | 範例 |
|------|------|------|
| 路由檔 | `camelCase` + `Routes.js` | `authRoutes.js`, `adminProductRoutes.js` |
| 中介層 | `camelCase` + `Middleware.js` | `authMiddleware.js`, `errorHandler.js` |
| 前端頁面 JS | `kebab-case.js` | `product-detail.js`, `admin-orders.js` |
| 前端共用 JS | `camelCase.js` | `api.js`, `auth.js`, `headerInit.js` |
| EJS 頁面 | `kebab-case.ejs` | `product-detail.ejs`, `order-detail.ejs` |

### API Request Body 欄位命名

- 使用 **camelCase**（`recipientName`, `productId`, `imageUrl`）

### 資料庫欄位命名

- 使用 **snake_case**（`product_id`, `created_at`, `order_no`）

### 回應 JSON 欄位命名

- 直接反映資料庫欄位，使用 **snake_case**（`order_no`, `total_amount`）
- 嵌套物件中的欄位也使用 snake_case

### 錯誤碼（error 欄位）

- 全大寫 + 底線：`VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `STOCK_INSUFFICIENT`, `CART_EMPTY`, `INVALID_STATUS`, `INTERNAL_ERROR`

---

## 環境變數

所有環境變數定義於 `.env`（本機）或部署環境中，`.env.example` 為範本。

| 變數 | 用途 | 必要 | 預設值（seed/fallback） |
|------|------|------|------------------------|
| `JWT_SECRET` | JWT 簽章密鑰 | **必要**（未設定則啟動失敗） | 無 |
| `PORT` | HTTP 伺服器埠號 | 選填 | `3001` |
| `BASE_URL` | 伺服器基礎 URL（OpenAPI 文件用） | 選填 | `http://localhost:3001` |
| `FRONTEND_URL` | CORS 允許的前端來源 | 選填 | `http://localhost:5173` |
| `ADMIN_EMAIL` | 初始管理員帳號 email | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 初始管理員帳號密碼 | 選填 | `12345678` |
| `ECPAY_MERCHANT_ID` | 綠界商店代號（預留） | 選填 | `3002607`（staging） |
| `ECPAY_HASH_KEY` | 綠界 HashKey（預留） | 選填 | staging 測試值 |
| `ECPAY_HASH_IV` | 綠界 HashIV（預留） | 選填 | staging 測試值 |
| `ECPAY_ENV` | 綠界環境（預留） | 選填 | `staging` |
| `NODE_ENV` | 執行環境（`test` 時 bcrypt saltRounds=1） | 選填 | — |

> **安全提醒**：生產環境的 `JWT_SECRET` 應使用至少 32 字元的隨機字串，永遠不可提交至 git。

---

## 新增 API 端點步驟

1. **確認路由檔**：找到或建立對應的 `src/routes/xxxRoutes.js`
2. **撰寫 handler**：在路由檔中加入 `router.get/post/put/patch/delete('path', middleware, handler)`
3. **加入 JSDoc**：在 handler 上方加入 `@openapi` 標記（格式見下方）
4. **在 app.js 掛載**（若是新路由檔）：`app.use('/api/prefix', require('./src/routes/xxxRoutes'))`
5. **統一回應格式**：回應必須為 `{ data, error, message }` 結構
6. **執行測試**：`npm test` 確認現有測試不受影響

---

## 新增 Middleware 步驟

1. 在 `src/middleware/` 建立 `xxxMiddleware.js`
2. 匯出函式：`module.exports = function(req, res, next) { ... }`
3. 在路由檔或 `app.js` 引入並使用
4. 注意 Express 的中介層執行順序（由上至下）

---

## 新增資料表步驟

1. 在 `src/database.js` 的 `initializeDatabase()` 函式中，`db.exec()` 內加入 `CREATE TABLE IF NOT EXISTS ...`
2. 若需要 seed 資料，在 `initializeDatabase()` 末端呼叫新的 seed 函式
3. 已存在的 SQLite 檔不會自動 migrate（`IF NOT EXISTS` 只新增不修改），若需修改 schema 需手動刪除 `src/database.sqlite` 重新啟動

---

## JSDoc / OpenAPI 標記格式

本專案以 `swagger-jsdoc` 掃描路由檔中的 `@openapi` JSDoc 產生 API 文件。範例：

```js
/**
 * @openapi
 * /api/example:
 *   post:
 *     summary: 簡短說明
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fieldName]
 *             properties:
 *               fieldName:
 *                 type: string
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       400:
 *         description: 參數錯誤
 */
router.post('/example', handler);
```

執行 `npm run openapi` 會掃描所有路由檔並輸出 `openapi.json`。

---

## 計畫歸檔流程

新功能開發前需建立計畫文件，完成後歸檔：

### 1. 計畫檔案命名格式

```
docs/plans/YYYY-MM-DD-<feature-name>.md
```

範例：`docs/plans/2026-04-20-product-search.md`

### 2. 計畫文件結構

```markdown
# [功能名稱] 開發計畫

## User Story
作為 [角色]，我希望 [功能]，以便 [目的]。

## Spec（技術規格）
- API 端點與方法
- 請求/回應格式
- 業務邏輯說明
- 資料庫異動

## Tasks
- [ ] 建立資料庫 schema
- [ ] 實作 API handler
- [ ] 撰寫測試
- [ ] 更新 OpenAPI 文件
```

### 3. 功能完成後

1. 將計畫檔移至 `docs/plans/archive/`
2. 更新 `docs/FEATURES.md` 的功能狀態為 ✅
3. 在 `docs/CHANGELOG.md` 新增版本記錄
