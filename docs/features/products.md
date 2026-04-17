# 商品（公開）

## GET /api/products — 商品列表

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

## GET /api/products/:id — 商品詳情

**行為描述**：以商品 ID（UUID）查詢單一商品。無需認證。

**錯誤碼**：

| HTTP | error | 情境 |
|------|-------|------|
| 404 | NOT_FOUND | 商品不存在 |
