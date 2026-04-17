# 購物車（雙模式認證）

購物車支援兩種使用模式，辨別方式見 [ARCHITECTURE.md 認證機制](../ARCHITECTURE.md#購物車雙模式dualauth僅限cartroutesjs)。

- **訪客模式**：前端生成 UUID 存於 localStorage，每次請求帶 `X-Session-Id: <uuid>` header
- **登入模式**：前端登入後儲存 JWT，每次請求帶 `Authorization: Bearer <token>` header

## GET /api/cart — 查看購物車

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

## POST /api/cart — 加入商品到購物車

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

## PATCH /api/cart/:itemId — 修改購物車數量

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

## DELETE /api/cart/:itemId — 移除購物車項目

**行為描述**：刪除指定購物車項目，同時驗證該項目屬於當前身份（避免跨身份刪除）。

**成功回應（200）**：`data: null`
