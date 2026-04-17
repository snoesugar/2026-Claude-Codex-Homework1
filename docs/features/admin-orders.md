# 後台訂單管理（需 JWT + role=admin）

## GET /api/admin/orders — 後台訂單列表

**行為描述**：查詢所有使用者的訂單，支援狀態篩選與分頁。

**查詢參數**：

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| page | integer | 1 | 頁碼 |
| limit | integer | 10 | 每頁筆數（上限 100） |
| status | string | 無（全部） | 篩選：`pending`、`paid`、`failed` |

> 若 status 傳入無效值（非三者之一），會被忽略，回傳全部訂單。

---

## GET /api/admin/orders/:id — 後台訂單詳情

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
    "items": [ "..." ],
    "user": { "name": "王小明", "email": "user@example.com" }
  },
  "error": null,
  "message": "成功"
}
```

> 若使用者已被刪除，`user` 欄位回傳 `null`（不會 throw 404）。
