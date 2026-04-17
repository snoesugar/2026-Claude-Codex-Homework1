# ECPay 綠界 AIO 金流串接

**狀態**：✅ 完成（v1.1.0，2026-04-16）

## 目標

取代原本的模擬付款按鈕，讓使用者透過綠界科技 AIO（All-In-One）金流完成真實（或測試環境）付款，並正確更新訂單狀態。

## 架構決策

本專案運行於本地端（localhost:3001），綠界的 Server-to-Server ReturnURL 無法到達 localhost。因此**不依賴 ReturnURL Callback** 更新訂單，改採：

1. 使用者付款後，綠界以瀏覽器 Form POST 導回 `OrderResultURL`（`/payment/result`）
2. 伺服器接收到後，主動呼叫 `QueryTradeInfo` API 向綠界確認付款狀態（可信賴來源）
3. 驗證回應的 `CheckMacValue` 後更新訂單狀態

## 實作清單

| 項目 | 檔案 | 說明 |
|------|------|------|
| ECPay 工具模組 | `src/ecpay.js` | CheckMacValue SHA256 生成/驗證、台北時區交易日期、QueryTradeInfo 主動查詢 |
| 金流路由 | `src/routes/paymentRoutes.js` | POST /api/payment/create/:orderId、POST /payment/result、POST /payment/notify、GET /payment/cancel |
| DB 欄位 | orders.merchant_trade_no | 記錄每次付款嘗試的 ECPay 交易編號，供 result handler 查詢 |
| DB Migration | `src/database.js` runMigrations() | 自動為既有資料庫補欄位（PRAGMA table_info + ALTER TABLE ADD COLUMN） |
| 前端付款流程 | `public/js/pages/order-detail.js` | 移除模擬付款按鈕，改為呼叫 create API 後動態建立 form 提交至綠界 |

## 關鍵細節

- `MerchantTradeNo` 格式：`'FL' + unix_timestamp`（12 字元），每次付款嘗試生成新值，允許同一筆訂單重試付款
- 訂單查詢依賴 ECPay 回傳的 `CustomField1`（order UUID），不做字串解析
- 模擬付款端點 `PATCH /api/orders/:id/pay` 保留，不影響現有 Vitest 測試
- `POST /payment/result` 有冪等性保護：若訂單已非 pending 狀態，直接導回不重複處理

## 測試環境

| 項目 | 值 |
|------|-----|
| MerchantID | `3002607` |
| 測試信用卡 | `4311-9522-2222-2222` |
| 3DS 驗證碼 | `1234` |
