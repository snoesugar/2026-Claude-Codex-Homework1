# 使用者認證

## POST /api/auth/register — 註冊

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

## POST /api/auth/login — 登入

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

## GET /api/auth/profile — 取得個人資料

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
