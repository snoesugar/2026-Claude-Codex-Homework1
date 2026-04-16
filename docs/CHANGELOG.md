# CHANGELOG.md

所有重要的版本變更都會記錄在此文件中。

格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

---

## [1.1.0] — 2026-04-16

### 新增

- **綠界 ECPay AIO 金流串接**：訂單詳情頁「前往綠界付款」按鈕，帶使用者到綠界標準付款頁完成付款
- **`src/ecpay.js`**：ECPay 工具模組（CheckMacValue SHA256 生成/驗證、台北時區交易日期、QueryTradeInfo 主動查詢）
- **`src/routes/paymentRoutes.js`**：金流路由（`POST /api/payment/create/:orderId`、`POST /payment/result`、`POST /payment/notify`、`GET /payment/cancel`）
- **`merchant_trade_no` 欄位**：orders 資料表新增欄位，記錄每次付款嘗試的 ECPay 交易編號
- **DB Migration**：`runMigrations()` 自動為既有資料庫補欄位（`PRAGMA table_info` + `ALTER TABLE ADD COLUMN`）

### 修改

- **訂單詳情頁前端**：移除模擬付款按鈕，改為呼叫 `/api/payment/create/:orderId` 取得 ECPay 參數後動態建立 form 並提交
- **付款結果確認架構**：無須依賴 ReturnURL（Server-to-Server），改由 `POST /payment/result`（OrderResultURL 瀏覽器跳轉）接收後，主動呼叫 `QueryTradeInfo` 驗證付款結果並更新訂單狀態

### 技術說明

- MerchantTradeNo 格式：`'FL' + unix_timestamp`（12 字元），每次付款嘗試生成新值，允許同一筆訂單重試付款
- 訂單查詢依賴 ECPay 回傳的 `CustomField1`（order UUID），不做字串解析
- 模擬付款端點 `PATCH /api/orders/:id/pay` 保留，不影響現有 Vitest 測試

---

## [1.0.0] — 2026-04-16

### 新增

- **使用者認證系統**：註冊、登入、取得個人資料（JWT HS256，7 天有效期）
- **商品列表與詳情 API**（公開，分頁支援）
- **購物車 API**（雙模式：訪客 X-Session-Id / 登入 JWT Bearer，新增/修改/刪除）
- **訂單 API**：從購物車建立訂單（Transaction：建立訂單 + 扣庫存 + 清空購物車）、查詢訂單列表、查詢訂單詳情
- **模擬付款 API**：`PATCH /api/orders/:id/pay`，支援 `success` / `fail` action
- **後台商品管理 API**（需 admin role）：列表、新增、編輯（局部更新）、刪除（pending 訂單保護）
- **後台訂單管理 API**（需 admin role）：列表（狀態篩選）、詳情（含購買者資訊）
- **SSR 頁面**（EJS）：前台首頁、商品詳情、購物車、結帳、登入、訂單列表、訂單詳情；後台商品管理、訂單管理
- **資料庫初始化與 Seed**：自動建表（5 張），預設管理員帳號，8 筆示範花卉商品
- **Vitest 整合測試**：6 個測試檔（auth, products, cart, orders, adminProducts, adminOrders）
- **OpenAPI 文件生成**：`npm run openapi` 輸出 `openapi.json`
- **Tailwind CSS v4** 整合（watch/build 指令）
