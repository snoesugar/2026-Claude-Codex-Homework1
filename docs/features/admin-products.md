# 後台商品管理（需 JWT + role=admin）

## GET /api/admin/products — 後台商品列表

與前台 `/api/products` 邏輯相同（同樣分頁），差異僅在需要 admin 認證。

---

## POST /api/admin/products — 新增商品

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

## PUT /api/admin/products/:id — 編輯商品

**行為描述**：局部更新（partial update），只更新 body 中有傳入的欄位，未傳入欄位維持原值。同時更新 `updated_at = datetime('now')`。

**驗證邏輯**：
- `name` 傳入但為空字串 → 400
- `price` 傳入但非正整數 → 400
- `stock` 傳入但非非負整數 → 400

---

## DELETE /api/admin/products/:id — 刪除商品

**行為描述**：刪除前先檢查是否有 `status = 'pending'` 的訂單包含此商品，若有則拒絕刪除。

**錯誤碼**：

| HTTP | error | 情境 |
|------|-------|------|
| 404 | NOT_FOUND | 商品不存在 |
| 409 | CONFLICT | 商品存在未完成（pending）訂單，無法刪除 |

> `paid` 或 `failed` 的訂單包含此商品不影響刪除。
