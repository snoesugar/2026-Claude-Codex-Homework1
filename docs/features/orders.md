# 訂單

所有訂單 API 需要 JWT 認證。訂單狀態機：`pending → paid` 或 `pending → failed`（不可逆）。

## POST /api/orders — 建立訂單

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

## GET /api/orders — 我的訂單列表

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

## GET /api/orders/:id — 訂單詳情

**行為描述**：查詢單一訂單，同時驗證 `user_id = req.user.userId`（不可跨帳號查詢他人訂單）。

**成功回應（200）**：比列表多回傳 `recipient_name`, `recipient_email`, `recipient_address`，以及 `items` 陣列（含 order_item 全欄位）。

---

## PATCH /api/orders/:id/pay — 模擬付款（保留供測試使用）

**行為描述**：直接更新訂單付款狀態，不經過真實金流，僅用於 Vitest 整合測試中驗證訂單狀態機行為。正式使用者流程請透過 ECPay 金流（見 [ecpay.md](./ecpay.md)）。

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
