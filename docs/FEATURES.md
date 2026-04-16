# FEATURES.md — 功能清單與行為描述

---

## 功能完成狀態

| 功能模組 | 狀態 |
|----------|------|
| 使用者認證（註冊、登入、個人資料） | ✅ 完成 |
| 商品列表與詳情（前台公開） | ✅ 完成 |
| 購物車（訪客 + 登入雙模式） | ✅ 完成 |
| 訂單建立與查詢 | ✅ 完成 |
| 模擬付款（保留，供測試用） | ✅ 完成 |
| 綠界 ECPay AIO 金流串接 | ✅ 完成 |
| 後台商品管理（CRUD） | ✅ 完成 |
| 後台訂單管理（查詢） | ✅ 完成 |
| SSR 頁面（前台 + 後台） | ✅ 完成 |
| OpenAPI 文件生成 | ✅ 完成 |

---

## 1. 使用者認證

### POST /api/auth/register — 註冊

**行為描述**：建立新使用者帳號，成功後自動發放 JWT，無需再次登入。

**請求 Body（JSON，必填）**：

| 欄位 | 型別 | 必填 | 規則 |
|------|------|------|------|
| email | string | ✅ | 需符合 email 格式（`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`） |
| password | string | ✅ | 最少 6 個字元 |
| name | string | ✅ | 無長度限制 |

**成功回應（201）**：

```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "測試", "role": "user" },
    "token": "eyJhbGci..."
  },
  "error": null,
  "message": "註冊成功"
}
```

**錯誤碼**：

| HTTP | error | 情境 |
|------|-------|------|
| 400 | VALIDATION_ERROR | email/password/name 缺失、email 格式錯、密碼少於 6 碼 |
| 409 | CONFLICT | email 已被其他帳號使用 |

---

### POST /api/auth/login — 登入

**行為描述**：驗證 email + password，成功後發放 JWT（有效期 7 天）。密碼比對使用 bcrypt.compareSync。

**請求 Body（JSON，必填）**：

| 欄位 | 型別 | 必填 |
|------|------|------|
| email | string | ✅ |
| password | string | ✅ |

**成功回應（200）**：與 register 相同結構，`message: '登入成功'`。

**錯誤碼**：

| HTTP | error | 情境 |
|------|-------|------|
| 400 | VALIDATION_ERROR | email 或 password 缺失 |
| 401 | UNAUTHORIZED | email 不存在或密碼錯誤（統一回傳相同錯誤訊息，避免帳號枚舉） |

---

### GET /api/auth/profile — 取得個人資料

**認證**：JWT Bearer token（必要）

**行為描述**：從 JWT payload 取得 userId，再查詢資料庫回傳完整使用者資訊。

**成功回應（200）**：

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "使用者名稱",
    "role": "user",
    "created_at": "2026-04-16 12:00:00"
  },
  "error": null,
  "message": "成功"
}
```

---

## 2. 商品（公開）

### GET /api/products — 商品列表

**行為描述**：回傳所有商品，依 `created_at DESC` 排序，支援分頁。無需認證。

**查詢參數**：

| 參數 | 型別 | 預設值 | 規則 |
|------|------|--------|------|
| page | integer | 1 | 最小值 1（`Math.max(1, ...)`） |
| limit | integer | 10 | 最小值 1，最大值 100（`Math.min(100, ...)`） |

**成功回應（200）**：

```json
{
  "data": {
    "products": [
      {
        "id": "uuid",
        "name": "粉色玫瑰花束",
        "description": "精選 20 朵...",
        "price": 1680,
        "stock": 30,
        "image_url": "https://...",
        "created_at": "2026-04-16 12:00:00",
        "updated_at": "2026-04-16 12:00:00"
      }
    ],
    "pagination": {
      "total": 8,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "error": null,
  "message": "成功"
}
```

---

### GET /api/products/:id — 商品詳情

**行為描述**：以商品 ID（UUID）查詢單一商品。無需認證。

**錯誤碼**：

| HTTP | error | 情境 |
|------|-------|------|
| 404 | NOT_FOUND | 商品不存在 |

---

## 3. 購物車（雙模式認證）

購物車支援兩種使用模式，辨別方式見 [ARCHITECTURE.md 認證機制](./ARCHITECTURE.md#購物車雙模式dualauth僅限cartroutesjs)。

- **訪客模式**：前端生成 UUID 存於 localStorage，每次請求帶 `X-Session-Id: <uuid>` header
- **登入模式**：前端登入後儲存 JWT，每次請求帶 `Authorization: Bearer <token>` header

### GET /api/cart — 查看購物車

**行為描述**：查詢當前身份（user_id 或 session_id）的購物車項目，並計算總金額。商品資訊 JOIN products 表即時取得（非快照，反映最新商品價格）。

**成功回應（200）**：

```json
{
  "data": {
    "items": [
      {
        "id": "cart-item-uuid",
        "product_id": "product-uuid",
        "quantity": 2,
        "product": {
          "name": "粉色玫瑰花束",
          "price": 1680,
          "stock": 30,
          "image_url": "https://..."
        }
      }
    ],
    "total": 3360
  },
  "error": null,
  "message": "成功"
}
```

---

### POST /api/cart — 加入商品到購物車

**行為描述**：若商品已在購物車中，**累加數量**（不替換），再檢查合併後數量是否超過庫存。

**業務邏輯**：
1. 驗證 productId 存在
2. 查詢該身份的購物車是否已有此商品
3. 已有：`newQty = existingItem.quantity + qty`，若 newQty > stock → 400
4. 未有：若 qty > stock → 400；否則新增一筆 cart_items

**請求 Body（JSON）**：

| 欄位 | 型別 | 必填 | 規則 |
|------|------|------|------|
| productId | string | ✅ | 商品 UUID |
| quantity | integer | 選填 | 預設為 1，必須為正整數 |

**錯誤碼**：

| HTTP | error | 情境 |
|------|-------|------|
| 400 | VALIDATION_ERROR | productId 缺失、quantity 非正整數 |
| 400 | STOCK_INSUFFICIENT | 加入後數量超過庫存 |
| 404 | NOT_FOUND | 商品不存在 |

---

### PATCH /api/cart/:itemId — 修改購物車數量

**行為描述**：**取代**（不累加）購物車項目數量，限制在庫存範圍內。

**請求 Body（JSON）**：

| 欄位 | 型別 | 必填 | 規則 |
|------|------|------|------|
| quantity | integer | ✅ | 必須為正整數 |

**錯誤碼**：

| HTTP | error | 情境 |
|------|-------|------|
| 400 | VALIDATION_ERROR | quantity 非正整數 |
| 400 | STOCK_INSUFFICIENT | 新數量超過庫存 |
| 404 | NOT_FOUND | 購物車項目不存在，或不屬於當前身份 |

---

### DELETE /api/cart/:itemId — 移除購物車項目

**行為描述**：刪除指定購物車項目，同時驗證該項目屬於當前身份（避免跨身份刪除）。

**成功回應（200）**：`data: null`

---

## 4. 訂單

所有訂單 API 需要 JWT 認證。訂單狀態機：`pending → paid` 或 `pending → failed`（不可逆）。

### POST /api/orders — 建立訂單

**行為描述**：從**登入使用者**的購物車中取出所有商品，在單一 transaction 中建立訂單。

**業務邏輯**：
1. 驗證收件資訊（三欄位必填，email 格式驗證）
2. 讀取 user_id 的購物車（JOIN products 取得即時庫存）
3. 購物車為空 → 400 CART_EMPTY
4. 任一商品庫存不足 → 400 STOCK_INSUFFICIENT（列出商品名稱）
5. 計算 totalAmount = Σ(price × quantity)
6. Transaction：建立 orders → 建立 order_items（快照名稱/價格）→ 扣庫存 → 清空購物車

**請求 Body（JSON，必填）**：

| 欄位 | 型別 | 必填 | 規則 |
|------|------|------|------|
| recipientName | string | ✅ | 收件人姓名 |
| recipientEmail | string | ✅ | 需符合 email 格式 |
| recipientAddress | string | ✅ | 收件地址 |

**成功回應（201）**：

```json
{
  "data": {
    "id": "order-uuid",
    "order_no": "ORD-20260416-A3F8B",
    "total_amount": 2660,
    "status": "pending",
    "items": [
      { "product_name": "粉色玫瑰花束", "product_price": 1680, "quantity": 1 },
      { "product_name": "迷你多肉組合盆", "product_price": 580, "quantity": 2 }
    ],
    "created_at": "2026-04-16 12:00:00"
  },
  "error": null,
  "message": "訂單建立成功"
}
```

**錯誤碼**：

| HTTP | error | 情境 |
|------|-------|------|
| 400 | VALIDATION_ERROR | 收件欄位缺失或 email 格式錯 |
| 400 | CART_EMPTY | 購物車為空 |
| 400 | STOCK_INSUFFICIENT | 某商品庫存不足（訊息含商品名稱） |

---

### GET /api/orders — 我的訂單列表

**行為描述**：查詢當前登入使用者的所有訂單，依 `created_at DESC` 排序。

**成功回應（200）**：

```json
{
  "data": {
    "orders": [
      {
        "id": "uuid",
        "order_no": "ORD-20260416-A3F8B",
        "total_amount": 2660,
        "status": "pending",
        "created_at": "2026-04-16 12:00:00"
      }
    ]
  },
  "error": null,
  "message": "成功"
}
```

---

### GET /api/orders/:id — 訂單詳情

**行為描述**：查詢單一訂單，同時驗證 `user_id = req.user.userId`（不可跨帳號查詢他人訂單）。

**成功回應（200）**：比列表多回傳 `recipient_name`, `recipient_email`, `recipient_address`，以及 `items` 陣列（含 order_item 全欄位）。

---

### PATCH /api/orders/:id/pay — 模擬付款（保留供測試使用）

**行為描述**：直接更新訂單付款狀態，不經過真實金流，僅用於 Vitest 整合測試中驗證訂單狀態機行為。正式使用者流程請透過 ECPay 金流（見第 8 節）。

**業務邏輯**：
- `action: 'success'` → status 更新為 `'paid'`，message: '付款成功'
- `action: 'fail'` → status 更新為 `'failed'`，message: '付款失敗'
- 狀態已非 pending → 400 INVALID_STATUS

**請求 Body（JSON）**：

| 欄位 | 型別 | 必填 | 允許值 |
|------|------|------|--------|
| action | string | ✅ | `'success'` 或 `'fail'` |

**錯誤碼**：

| HTTP | error | 情境 |
|------|-------|------|
| 400 | VALIDATION_ERROR | action 非 success/fail |
| 400 | INVALID_STATUS | 訂單狀態不是 pending |
| 404 | NOT_FOUND | 訂單不存在或不屬於當前使用者 |

---

## 5. 後台商品管理（需 JWT + role=admin）

### GET /api/admin/products — 後台商品列表

與前台 `/api/products` 邏輯相同（同樣分頁），差異僅在需要 admin 認證。

---

### POST /api/admin/products — 新增商品

**請求 Body（JSON）**：

| 欄位 | 型別 | 必填 | 規則 |
|------|------|------|------|
| name | string | ✅ | 商品名稱 |
| description | string | 選填 | 商品描述 |
| price | integer | ✅ | 必須為正整數（> 0） |
| stock | integer | ✅ | 必須為非負整數（>= 0） |
| image_url | string | 選填 | 圖片 URL |

**成功回應（201）**：回傳完整商品物件（含 created_at, updated_at）

---

### PUT /api/admin/products/:id — 編輯商品

**行為描述**：局部更新（partial update），只更新 body 中有傳入的欄位，未傳入欄位維持原值。同時更新 `updated_at = datetime('now')`。

**驗證邏輯**：
- `name` 傳入但為空字串 → 400
- `price` 傳入但非正整數 → 400
- `stock` 傳入但非非負整數 → 400

---

### DELETE /api/admin/products/:id — 刪除商品

**行為描述**：刪除前先檢查是否有 `status = 'pending'` 的訂單包含此商品，若有則拒絕刪除。

**錯誤碼**：

| HTTP | error | 情境 |
|------|-------|------|
| 404 | NOT_FOUND | 商品不存在 |
| 409 | CONFLICT | 商品存在未完成（pending）訂單，無法刪除 |

> `paid` 或 `failed` 的訂單包含此商品不影響刪除。

---

## 6. 後台訂單管理（需 JWT + role=admin）

### GET /api/admin/orders — 後台訂單列表

**行為描述**：查詢所有使用者的訂單，支援狀態篩選與分頁。

**查詢參數**：

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| page | integer | 1 | 頁碼 |
| limit | integer | 10 | 每頁筆數（上限 100） |
| status | string | 無（全部） | 篩選：`pending`、`paid`、`failed` |

> 若 status 傳入無效值（非三者之一），會被忽略，回傳全部訂單。

---

### GET /api/admin/orders/:id — 後台訂單詳情

**行為描述**：查詢任意訂單（不限 user_id），並額外回傳訂購者的 name 和 email。

**成功回應（200）**：比一般訂單詳情多一個 `user` 欄位：

```json
{
  "data": {
    "id": "uuid",
    "order_no": "ORD-20260416-A3F8B",
    "user_id": "user-uuid",
    "recipient_name": "王小明",
    "recipient_email": "user@example.com",
    "recipient_address": "台北市信義區...",
    "total_amount": 1680,
    "status": "paid",
    "created_at": "2026-04-16 12:00:00",
    "items": [ ... ],
    "user": { "name": "王小明", "email": "user@example.com" }
  },
  "error": null,
  "message": "成功"
}
```

> 若使用者已被刪除，`user` 欄位回傳 `null`（不會 throw 404）。

---

## 7. SSR 頁面

所有頁面路由回傳 HTML（EJS 渲染），**不做 API 認證**，認證由前端 JavaScript 在 client side 處理。

| 路由 | pageScript | 特殊參數 |
|------|-----------|---------|
| GET / | index | — |
| GET /products/:id | product-detail | `productId`（傳入 EJS） |
| GET /cart | cart | — |
| GET /checkout | checkout | — |
| GET /login | login | — |
| GET /orders | orders | — |
| GET /orders/:id | order-detail | `orderId`、`paymentResult`（來自 `?payment=success/failed/cancel` query） |
| GET /admin/products | admin-products | `currentPath: '/admin/products'` |
| GET /admin/orders | admin-orders | `currentPath: '/admin/orders'` |

---

## 8. 綠界 ECPay AIO 金流

本功能串接綠界科技 AIO（All-In-One）全方位金流，取代原本的模擬付款按鈕，讓使用者能在綠界付款頁完成真實（或測試）付款。

### 架構說明

由於本專案運行於本地端（port 3001），綠界的 Server-to-Server ReturnURL 無法到達 localhost，因此**不依賴 ReturnURL Callback**，改採「使用者付款後，伺服器主動呼叫 QueryTradeInfo API 驗證結果」的架構：

```
訂單詳情頁 →「前往綠界付款」按鈕
  ↓ POST /api/payment/create/:orderId（JWT auth）
  ↓ 伺服器建立 ECPay 參數 + CheckMacValue，儲存 merchant_trade_no
  ↓ 前端收到 action_url + fields，動態建立隱藏 form 提交到綠界
  ↓ 使用者在綠界付款頁完成付款
  ↓ 綠界以 browser redirect Form POST 導回 OrderResultURL
  ↓ POST /payment/result 接收導回，主動呼叫 QueryTradeInfo 驗證
  ↓ 更新訂單 status → redirect /orders/:id?payment=success/failed/cancel
```

### POST /api/payment/create/:orderId — 建立付款參數

**認證**：JWT Bearer token（必要）

**行為描述**：查詢指定訂單，確認屬於當前使用者且狀態為 `pending`，生成綠界 AIO 所需的所有參數（含 CheckMacValue SHA256），儲存本次交易編號後回傳給前端。

**業務邏輯**：
1. 查詢訂單（user_id + id 雙重比對，避免跨帳號操作）
2. 確認 status = 'pending'（已付款或失敗訂單不可重複付款）
3. 生成 `MerchantTradeNo = 'FL' + Unix 秒數`（12 字元，每次呼叫都產生新值，允許同一訂單重試付款）
4. 將 `merchant_trade_no` 寫入 orders 表（供 result handler 查詢使用）
5. 組合商品名稱字串（格式：`商品A x1#商品B x2`，截斷至 200 字元）
6. 計算 CheckMacValue（ecpayUrlEncode + SHA256）
7. 回傳 `action_url` 與完整 `fields` 物件供前端直接提交

**成功回應（200）**：

```json
{
  "data": {
    "action_url": "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
    "fields": {
      "MerchantID": "3002607",
      "MerchantTradeNo": "FL1744896000",
      "MerchantTradeDate": "2026/04/16 12:00:00",
      "PaymentType": "aio",
      "TotalAmount": "1680",
      "TradeDesc": "花卉電商訂購",
      "ItemName": "粉色玫瑰花束 x1",
      "ReturnURL": "http://localhost:3001/payment/notify",
      "OrderResultURL": "http://localhost:3001/payment/result",
      "ClientBackURL": "http://localhost:3001/orders/uuid?payment=cancel",
      "ChoosePayment": "ALL",
      "EncryptType": "1",
      "CustomField1": "order-uuid",
      "CheckMacValue": "A1B2C3..."
    }
  },
  "error": null,
  "message": "付款參數建立成功"
}
```

**ECPay 付款參數說明**：

| 欄位 | 說明 |
|------|------|
| `MerchantTradeNo` | 綠界交易編號（唯一，格式 `FL` + Unix 秒數） |
| `ReturnURL` | 綠界 Server-to-Server 通知（本地端無法接收，handler 僅回應 `1\|OK`） |
| `OrderResultURL` | 付款後瀏覽器導回的端點（本地端可接收，用來觸發主動查詢） |
| `ClientBackURL` | 使用者在付款頁主動取消時的導回網址 |
| `CustomField1` | 儲存訂單 UUID，供 result handler 免逆推直接查詢訂單 |
| `ChoosePayment` | `ALL` 顯示所有付款方式（測試建議選信用卡） |

**錯誤碼**：

| HTTP | error | 情境 |
|------|-------|------|
| 404 | NOT_FOUND | 訂單不存在或不屬於當前使用者 |
| 400 | INVALID_STATUS | 訂單狀態不是 pending |

---

### POST /payment/result — 接收付款結果並驗證

**呼叫者**：綠界付款完成後透過使用者瀏覽器 Form POST 導回（非伺服器呼叫）

**行為描述**：接收綠界導回的付款結果，**不信任 POST body 的 RtnCode**，改為主動呼叫 QueryTradeInfo 查詢 ECPay 伺服器取得可信賴的付款狀態，驗證回應的 CheckMacValue 後更新訂單狀態，最後導回訂單詳情頁。

**業務邏輯**：
1. 從 `req.body.CustomField1` 取得訂單 UUID，查詢 orders
2. 若訂單已非 pending（已處理過），直接導回（冪等性保護）
3. 呼叫 `queryTradeInfo(MerchantTradeNo)` 向綠界主動查詢
4. 驗證回應的 CheckMacValue（timing-safe 比較，防偽造回應）
5. `TradeStatus === '1'` → status = 'paid'；否則 → status = 'failed'
6. 302 redirect 到 `/orders/:id?payment=success` 或 `?payment=failed`

> 若 QueryTradeInfo 呼叫失敗（網路錯誤），訂單狀態維持 pending，導回 `?payment=failed`，使用者可重新嘗試。

---

### POST /payment/notify — ReturnURL handler

**呼叫者**：綠界伺服器（本地端無法接收到，handler 純粹作為合規端點）

**行為描述**：立即回應 `1|OK`（純文字 HTTP 200）。實際付款驗證由 `/payment/result` 主動查詢負責。

---

### GET /payment/cancel — 使用者取消導回

**行為描述**：使用者在綠界付款頁點取消按鈕時被導回此端點，轉向訂單詳情頁並帶上 `?payment=cancel` 參數顯示取消提示。

---

### 前端付款流程（order-detail.js）

1. 使用者點擊「前往綠界付款」按鈕
2. 呼叫 `POST /api/payment/create/:orderId`（帶 JWT Authorization header）
3. 收到回應後，動態在 DOM 建立隱藏的 `<form method="POST">`，填入所有 `fields`
4. 呼叫 `form.submit()` → 瀏覽器跳轉至綠界付款頁
5. 付款完成後由綠界導回 `/payment/result`

### 測試付款資訊

| 項目 | 值 |
|------|-----|
| 測試環境 | `payment-stage.ecpay.com.tw` |
| MerchantID | `3002607` |
| 測試信用卡 | `4311-9522-2222-2222` |
| 有效期 / CVV | 任意未來日期 / 任意 3 碼 |
| 3DS 驗證碼 | `1234` |

---

## 7. SSR 頁面

**Layout 系統**：EJS 不使用 `express-ejs-layouts`，而是自行實作兩步渲染：

```js
// 1. 渲染頁面片段取得 body 字串
res.render('pages/xxx', locals, function (err, body) {
  // 2. 將 body 注入 layout
  res.render('layouts/front', { body, ...locals });
});
```
