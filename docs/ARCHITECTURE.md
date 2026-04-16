# ARCHITECTURE.md — 架構與技術決策

---

## 目錄結構

```
.
├── app.js                        # Express app 工廠（不含 listen）
├── server.js                     # 程式進入點，啟動 HTTP server
├── generate-openapi.js           # 掃描 @openapi JSDoc 輸出 openapi.json
├── swagger-config.js             # swagger-jsdoc 設定（API info、servers）
├── vitest.config.js              # 測試設定（固定檔案執行順序）
├── .env / .env.example           # 環境變數
│
├── src/
│   ├── database.js               # DB 初始化、建表、seed 資料，匯出 db 實例
│   ├── middleware/
│   │   ├── authMiddleware.js     # 驗證 JWT Bearer Token，掛 req.user
│   │   ├── adminMiddleware.js    # 確認 req.user.role === 'admin'
│   │   ├── sessionMiddleware.js  # 讀取 X-Session-Id header，掛 req.sessionId
│   │   └── errorHandler.js      # 全域錯誤處理（500 sanitize，isOperational 判斷）
│   └── routes/
│       ├── authRoutes.js         # POST /register, POST /login, GET /profile
│       ├── productRoutes.js      # GET /products, GET /products/:id（公開）
│       ├── cartRoutes.js         # 購物車 CRUD（雙模式認證）
│       ├── orderRoutes.js        # 訂單建立、查詢、付款（需登入）
│       ├── adminProductRoutes.js # 後台商品 CRUD（需 admin）
│       ├── adminOrderRoutes.js   # 後台訂單查詢（需 admin）
│       └── pageRoutes.js         # SSR 頁面路由（EJS + layout 渲染）
│
├── public/
│   ├── css/
│   │   ├── input.css             # Tailwind 源檔
│   │   └── output.css            # build 後的 CSS（不納入 git）
│   ├── js/
│   │   ├── api.js                # 前端統一 fetch 封裝（帶 JWT/session header）
│   │   ├── auth.js               # 前端 JWT 存取（localStorage）、登入狀態判斷
│   │   ├── header-init.js        # 每頁 header 動態初始化（購物車數量、登入狀態）
│   │   ├── notification.js       # 全域 toast 通知元件
│   │   └── pages/
│   │       ├── index.js          # 首頁商品列表
│   │       ├── product-detail.js # 商品詳情頁
│   │       ├── cart.js           # 購物車頁
│   │       ├── checkout.js       # 結帳頁
│   │       ├── login.js          # 登入頁
│   │       ├── orders.js         # 我的訂單列表
│   │       ├── order-detail.js   # 訂單詳情＋付款模擬
│   │       ├── admin-products.js # 後台商品管理
│   │       └── admin-orders.js   # 後台訂單管理
│   └── stylesheets/
│       └── style.css             # 自訂補充樣式
│
├── views/
│   ├── layouts/
│   │   ├── front.ejs             # 前台 layout（head + header + footer + pageScript）
│   │   └── admin.ejs             # 後台 layout（admin-header + admin-sidebar）
│   ├── pages/
│   │   ├── index.ejs             # 首頁
│   │   ├── product-detail.ejs    # 商品詳情頁（傳入 productId）
│   │   ├── cart.ejs              # 購物車頁
│   │   ├── checkout.ejs          # 結帳頁
│   │   ├── login.ejs             # 登入頁
│   │   ├── orders.ejs            # 我的訂單頁
│   │   ├── order-detail.ejs      # 訂單詳情頁（傳入 orderId, paymentResult）
│   │   ├── 404.ejs               # 404 頁面
│   │   └── admin/
│   │       ├── products.ejs      # 後台商品管理頁
│   │       └── orders.ejs        # 後台訂單管理頁
│   └── partials/
│       ├── head.ejs              # <head> 標籤（CSS 引用）
│       ├── header.ejs            # 前台導覽列
│       ├── footer.ejs            # 頁尾
│       ├── notification.ejs      # Toast 通知容器
│       ├── admin-header.ejs      # 後台頂部導覽
│       └── admin-sidebar.ejs     # 後台側邊欄
│
├── tests/
│   ├── setup.js                  # 測試輔助（getAdminToken, registerUser）
│   ├── auth.test.js
│   ├── products.test.js
│   ├── cart.test.js
│   ├── orders.test.js
│   ├── adminProducts.test.js
│   └── adminOrders.test.js
│
└── src/database.sqlite           # SQLite 資料庫檔（啟動時自動建立）
```

---

## 啟動流程

```
node server.js
  │
  ├─ 檢查 process.env.JWT_SECRET → 未設定則 process.exit(1)
  │
  └─ require('./app')
       │
       ├─ require('dotenv').config()
       ├─ require('./src/database')   ← initializeDatabase()
       │    ├─ 開啟 database.sqlite（WAL 模式，外鍵啟用）
       │    ├─ CREATE TABLE IF NOT EXISTS（5 張表）
       │    ├─ seedAdminUser()        ← 若 admin 不存在則插入
       │    └─ seedProducts()         ← 若 products 為空則插入 8 筆
       │
       ├─ 全域 middleware（cors → json → urlencoded → sessionMiddleware）
       ├─ API 路由掛載（/api/auth, /api/products, /api/cart, /api/orders,
       │               /api/admin/products, /api/admin/orders）
       ├─ 頁面路由掛載（/）
       ├─ 404 handler（API 路徑回 JSON，其餘渲染 404.ejs）
       └─ errorHandler（全域錯誤捕捉）

app.listen(PORT || 3001)
```

---

## API 路由總覽

### 前台 API

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| POST | /api/auth/register | 無 | 註冊新帳號 |
| POST | /api/auth/login | 無 | 登入取得 JWT |
| GET | /api/auth/profile | JWT | 取得個人資料 |
| GET | /api/products | 無 | 商品列表（分頁） |
| GET | /api/products/:id | 無 | 單一商品詳情 |
| GET | /api/cart | JWT 或 Session | 查看購物車 |
| POST | /api/cart | JWT 或 Session | 加入商品到購物車 |
| PATCH | /api/cart/:itemId | JWT 或 Session | 修改購物車商品數量 |
| DELETE | /api/cart/:itemId | JWT 或 Session | 移除購物車項目 |
| POST | /api/orders | JWT | 從購物車建立訂單 |
| GET | /api/orders | JWT | 查詢自己的訂單列表 |
| GET | /api/orders/:id | JWT | 查詢單一訂單詳情 |
| PATCH | /api/orders/:id/pay | JWT | 模擬付款（success/fail） |

### 後台 API（需 JWT + role=admin）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | /api/admin/products | 後台商品列表（分頁） |
| POST | /api/admin/products | 新增商品 |
| PUT | /api/admin/products/:id | 編輯商品（局部更新） |
| DELETE | /api/admin/products/:id | 刪除商品 |
| GET | /api/admin/orders | 後台所有訂單（分頁＋狀態篩選） |
| GET | /api/admin/orders/:id | 後台單一訂單詳情（含購買者資訊） |

### 頁面路由（EJS SSR）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | / | 首頁商品列表 |
| GET | /products/:id | 商品詳情頁 |
| GET | /cart | 購物車頁 |
| GET | /checkout | 結帳頁 |
| GET | /login | 登入頁 |
| GET | /orders | 我的訂單列表 |
| GET | /orders/:id | 訂單詳情頁（`?payment=success/fail` 顯示付款結果） |
| GET | /admin/products | 後台商品管理頁 |
| GET | /admin/orders | 後台訂單管理頁 |

---

## 統一回應格式

所有 API 端點皆回傳相同 JSON 結構：

```json
// 成功
{
  "data": { ... },
  "error": null,
  "message": "成功"
}

// 失敗
{
  "data": null,
  "error": "ERROR_CODE",
  "message": "錯誤說明文字"
}
```

**所有情況下 `data`、`error`、`message` 三個欄位都必須存在。**

---

## 認證與授權機制

### JWT 認證（authMiddleware）

- 讀取 `Authorization: Bearer <token>` header
- 使用 `JWT_SECRET` 以 `HS256` 演算法驗證
- 驗證成功後，再次查詢資料庫確認使用者存在
- 將 `{ userId, email, role }` 掛載到 `req.user`
- JWT 有效期：**7 天**（`expiresIn: '7d'`）
- Token 無效或過期回傳 `401 UNAUTHORIZED`

### Admin 授權（adminMiddleware）

- 必須在 `authMiddleware` 之後執行
- 檢查 `req.user.role === 'admin'`
- 不符合回傳 `403 FORBIDDEN`

### 購物車雙模式（dualAuth，僅限 cartRoutes.js）

購物車 API 支援兩種身份識別方式，**判斷邏輯如下（有優先順序）**：

```
1. 若 Authorization header 存在且以 'Bearer ' 開頭
   → 嘗試 JWT 驗證
   → 驗證成功：req.user = { userId, email, role }，使用 user_id 查購物車
   → 驗證失敗：立即回傳 401（不 fallback 到 session）

2. 若無 Authorization header，但有 X-Session-Id header
   → req.sessionId 已由 sessionMiddleware 設定
   → 使用 session_id 查購物車

3. 兩者皆無
   → 回傳 401，message: '請提供有效的登入 Token 或 X-Session-Id'
```

**重要**：訪客購物車（session_id）與登入購物車（user_id）是獨立隔離的，結帳建立訂單時只讀取 `user_id` 的購物車項目。

### Session 識別（sessionMiddleware）

- 讀取 `X-Session-Id` request header
- 若存在，掛載到 `req.sessionId`
- 不驗證格式，由前端自行生成並儲存於 localStorage

---

## 資料庫 Schema

資料庫為單一 SQLite 檔案（`src/database.sqlite`），WAL 模式，外鍵約束啟用。

### users

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| email | TEXT | UNIQUE NOT NULL | 帳號（登入用） |
| password_hash | TEXT | NOT NULL | bcrypt hash（saltRounds=10，測試環境=1） |
| name | TEXT | NOT NULL | 顯示名稱 |
| role | TEXT | NOT NULL, DEFAULT 'user', CHECK IN ('user', 'admin') | 角色 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間（ISO 字串） |

### products

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | 商品名稱 |
| description | TEXT | — | 商品描述（可為 NULL） |
| price | INTEGER | NOT NULL, CHECK(price > 0) | 售價（新台幣整數） |
| stock | INTEGER | NOT NULL, DEFAULT 0, CHECK(stock >= 0) | 庫存數量 |
| image_url | TEXT | — | 商品圖片 URL（可為 NULL） |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL, DEFAULT datetime('now') | 最後更新時間 |

> 注意：`updated_at` 不由 SQLite trigger 自動更新，需在 `PUT /api/admin/products/:id` 中手動 `updated_at = datetime('now')`。

### cart_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| session_id | TEXT | — | 訪客 session ID（與 user_id 擇一使用） |
| user_id | TEXT | FK → users(id) | 登入使用者 ID |
| product_id | TEXT | NOT NULL, FK → products(id) | 商品 ID |
| quantity | INTEGER | NOT NULL, DEFAULT 1, CHECK(quantity > 0) | 數量 |

> `session_id` 和 `user_id` 不互斥於 schema 層，但業務邏輯保證兩者擇一填入（絕不同時為非空）。

### orders

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_no | TEXT | UNIQUE NOT NULL | 訂單編號（格式：`ORD-YYYYMMDD-XXXXX`） |
| user_id | TEXT | NOT NULL, FK → users(id) | 訂購者 |
| recipient_name | TEXT | NOT NULL | 收件人姓名 |
| recipient_email | TEXT | NOT NULL | 收件人 Email |
| recipient_address | TEXT | NOT NULL | 收件人地址 |
| total_amount | INTEGER | NOT NULL | 訂單總金額（新台幣整數） |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending', 'paid', 'failed') | 訂單狀態 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |

**訂單號格式**：`ORD-YYYYMMDD-XXXXX`，其中 XXXXX 為 UUID v4 前 5 碼大寫。例：`ORD-20260416-A3F8B`。

### order_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_id | TEXT | NOT NULL, FK → orders(id) | 所屬訂單 |
| product_id | TEXT | NOT NULL | 商品 ID（無外鍵，允許商品被刪除後仍保留歷史） |
| product_name | TEXT | NOT NULL | 下單當時的商品名稱（快照） |
| product_price | INTEGER | NOT NULL | 下單當時的商品售價（快照） |
| quantity | INTEGER | NOT NULL | 購買數量 |

> `product_name` 和 `product_price` 是下單當時的快照，即使商品後來被修改或刪除，訂單明細仍保留正確資訊。

---

## 建立訂單的 Transaction 流程

`POST /api/orders` 使用 `better-sqlite3` 的 `db.transaction()` 在單一 atomic 操作中完成：

```
1. INSERT INTO orders（建立訂單主記錄）
2. for each cart_item:
   a. INSERT INTO order_items（建立訂單明細，快照商品名稱與價格）
   b. UPDATE products SET stock = stock - quantity（扣減庫存）
3. DELETE FROM cart_items WHERE user_id = ?（清空使用者購物車）
```

如任一步驟失敗（例如 CHECK constraint stock >= 0 被觸發），整個 transaction 回滾，資料庫狀態不變。

> 注意：建立訂單前已在 application layer 做庫存檢查，但 DB constraint 是最後防線。

---

## 錯誤處理機制

`src/middleware/errorHandler.js` 為全域錯誤捕捉（Express 4-argument middleware）：

- `err.status` 或 `err.statusCode` 決定 HTTP 狀態碼（預設 500）
- 若 `statusCode === 500`，訊息固定回傳 `'伺服器內部錯誤'`（避免洩漏 stack trace）
- 若非 500：
  - `err.isOperational === true`：使用 `err.message`（業務層手動拋出的安全訊息）
  - 否則：使用 `SAFE_MESSAGES[statusCode]` 對照表的預設訊息
