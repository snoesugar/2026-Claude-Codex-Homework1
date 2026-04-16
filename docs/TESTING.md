# TESTING.md — 測試規範與指南

---

## 測試框架

- **測試框架**：Vitest ^2.1.9
- **HTTP 測試**：supertest ^7.2.2
- **斷言風格**：Vitest 內建 `expect`（與 Jest 相容）

---

## 執行指令

```bash
# 執行所有測試（一次性，非 watch mode）
npm test

# 等同於
npx vitest run
```

> **注意**：沒有 watch mode 或 coverage 的快捷指令，若需要可直接執行 `npx vitest --watch` 或 `npx vitest --coverage`。

---

## 測試檔案與執行順序

`vitest.config.js` 中設定 `fileParallelism: false`，所有測試檔依以下**固定順序**依序執行：

| 順序 | 測試檔案 | 測試對象 |
|------|----------|----------|
| 1 | `tests/auth.test.js` | 認證 API（register、login、profile） |
| 2 | `tests/products.test.js` | 商品公開 API（列表、詳情） |
| 3 | `tests/cart.test.js` | 購物車 API（訪客 + 登入雙模式） |
| 4 | `tests/orders.test.js` | 訂單 API（建立、查詢、404） |
| 5 | `tests/adminProducts.test.js` | 後台商品 API（CRUD、權限驗證） |
| 6 | `tests/adminOrders.test.js` | 後台訂單 API（列表、詳情、篩選） |

**為何順序重要**：所有測試共用同一個 SQLite 資料庫實例（`src/database.sqlite`）。`orders.test.js` 依賴 `cart.test.js` 留下的商品資料；`adminOrders.test.js` 依賴 `orders.test.js` 建立的訂單。若隨意更改順序，前置資料可能不存在導致測試失敗。

---

## 輔助函式（tests/setup.js）

`tests/setup.js` 匯出三個輔助工具：

### `app`

直接匯出 Express app 實例，供 supertest 使用。

```js
const { app } = require('./setup');
const res = await request(app).get('/api/products');
```

### `request`

supertest 的 `request` 函式，已綁定 app（便利用法）。

```js
const { request, app } = require('./setup');
// 等同於 supertest(app)
const res = await request(app).get('/api/products');
```

### `getAdminToken()`

使用 seed 管理員帳號（`admin@hexschool.com` / `12345678`）登入，回傳 JWT token 字串。

```js
const { getAdminToken } = require('./setup');
const adminToken = await getAdminToken();
// 用法
await request(app)
  .get('/api/admin/products')
  .set('Authorization', `Bearer ${adminToken}`);
```

### `registerUser(overrides?)`

註冊一個隨機測試使用者，回傳 `{ token, user }`。

```js
const { registerUser } = require('./setup');

// 隨機 email（預設）
const { token, user } = await registerUser();

// 指定 email / password / name
const { token } = await registerUser({
  email: 'custom@example.com',
  password: 'mypassword',
  name: '自訂名稱'
});
```

> 隨機 email 格式：`` `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com` ``

---

## 測試資料庫注意事項

- 測試使用的是**同一個** `src/database.sqlite`（非隔離的 in-memory DB 或測試專用 DB）
- `NODE_ENV=test` 時，bcrypt saltRounds 降為 1（加速密碼雜湊，測試時間大幅縮短）
- 測試跑完後，資料庫中會留有測試資料（用戶、購物車殘留、訂單等），不影響重新執行測試
- 若想完全還原乾淨狀態，刪除 `src/database.sqlite` 再重啟伺服器即可重建

---

## 撰寫新測試的步驟

1. **在對應的測試檔案中新增 `it` 或 `test` 區塊**（通常與功能相關的測試檔）
2. **需要前置資料時使用 `beforeAll`**，在 describe 內宣告共用變數
3. **按「成功路徑 → 邊界條件 → 錯誤路徑」順序撰寫**
4. **每個測試案例驗證三件事**：
   - HTTP 狀態碼（`expect(res.status).toBe(...)`)
   - 回應結構（`data`, `error`, `message` 三欄位存在）
   - 關鍵業務欄位值

### 範例：新增一個測試案例

```js
// 在 tests/products.test.js 中
describe('Products API', () => {
  it('should return 404 for non-existent product', async () => {
    const res = await request(app).get('/api/products/non-existent-id');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('data', null);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).not.toBeNull();
    expect(res.body).toHaveProperty('message');
  });
});
```

### 範例：需要認證的測試

```js
describe('Some Protected API', () => {
  let userToken;

  beforeAll(async () => {
    const { token } = await registerUser();
    userToken = token;
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/some-protected-route');
    expect(res.status).toBe(401);
  });

  it('should succeed with valid token', async () => {
    const res = await request(app)
      .get('/api/some-protected-route')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });
});
```

---

## 常見陷阱

### 1. 測試間狀態洩漏

購物車 `cart.test.js` 使用固定的 session ID（`'test-session-' + Date.now()`），若重複執行同一個 describe，session 中可能已有購物車資料。需確保測試結束時清空購物車（通常在測試末尾使用 DELETE 清除）。

### 2. orders.test.js 依賴購物車狀態

`orders.test.js` 的 `beforeAll` 會自行加入商品到購物車：

```js
beforeAll(async () => {
  const { token } = await registerUser();
  userToken = token;
  const prodRes = await request(app).get('/api/products');
  productId = prodRes.body.data.products[0].id;
  await request(app)
    .post('/api/cart')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ productId, quantity: 1 });
});
```

若商品列表為空（products seed 資料被刪除），`productId` 會是 `undefined`，導致後續測試全部失敗。

### 3. 管理員 token 的一致性

`getAdminToken()` 每次呼叫都會發送一個登入請求，回傳新的 JWT。若在多個 describe 中各自呼叫，會得到不同但同樣有效的 token（JWT 是 stateless 的，沒有問題）。

### 4. 不可並行執行

`fileParallelism: false` 是必要設定。若設為 `true`，多個測試檔同時對同一個 SQLite 資料庫寫入，可能因鎖定（WAL 模式雖然改善但仍有限制）或資料競爭導致不確定性失敗。
