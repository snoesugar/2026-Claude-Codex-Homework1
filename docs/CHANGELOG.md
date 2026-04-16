# CHANGELOG.md

所有重要的版本變更都會記錄在此文件中。

格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

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
