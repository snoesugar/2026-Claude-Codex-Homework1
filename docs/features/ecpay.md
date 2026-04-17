# 綠界 ECPay AIO 金流

本功能串接綠界科技 AIO（All-In-One）全方位金流，取代原本的模擬付款按鈕，讓使用者能在綠界付款頁完成真實（或測試）付款。

## 架構說明

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

---

## POST /api/payment/create/:orderId — 建立付款參數

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

## POST /payment/result — 接收付款結果並驗證

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

## POST /payment/notify — ReturnURL handler

**呼叫者**：綠界伺服器（本地端無法接收到，handler 純粹作為合規端點）

**行為描述**：立即回應 `1|OK`（純文字 HTTP 200）。實際付款驗證由 `/payment/result` 主動查詢負責。

---

## GET /payment/cancel — 使用者取消導回

**行為描述**：使用者在綠界付款頁點取消按鈕時被導回此端點，轉向訂單詳情頁並帶上 `?payment=cancel` 參數顯示取消提示。

---

## 前端付款流程（order-detail.js）

1. 使用者點擊「前往綠界付款」按鈕
2. 呼叫 `POST /api/payment/create/:orderId`（帶 JWT Authorization header）
3. 收到回應後，動態在 DOM 建立隱藏的 `<form method="POST">`，填入所有 `fields`
4. 呼叫 `form.submit()` → 瀏覽器跳轉至綠界付款頁
5. 付款完成後由綠界導回 `/payment/result`

---

## 測試付款資訊

| 項目 | 值 |
|------|-----|
| 測試環境 | `payment-stage.ecpay.com.tw` |
| MerchantID | `3002607` |
| 測試信用卡 | `4311-9522-2222-2222` |
| 有效期 / CVV | 任意未來日期 / 任意 3 碼 |
| 3DS 驗證碼 | `1234` |
