# SSR 頁面

所有頁面路由回傳 HTML（EJS 渲染），**不做 API 認證**，認證由前端 JavaScript 在 client side 處理。

## 路由對照表

| 路由 | pageScript | 特殊參數 |
|------|-----------|---------|
| GET / | index | — |
| GET /products/:id | product-detail | `productId`（傳入 EJS） |
| GET /cart | cart | — |
| GET /checkout | checkout | — |
| GET /login | login | — |
| GET /orders | orders | — |
| GET /orders/:id | order-detail | `orderId`、`paymentResult`（來自 `?payment=success/failed/cancel` query） |
| GET /admin/products | admin-products | `currentPath: '/admin/products'` |
| GET /admin/orders | admin-orders | `currentPath: '/admin/orders'` |

---

## Layout 系統

EJS 不使用 `express-ejs-layouts`，而是自行實作兩步渲染：

```js
// 1. 渲染頁面片段取得 body 字串
res.render('pages/xxx', locals, function (err, body) {
  // 2. 將 body 注入 layout
  res.render('layouts/front', { body, ...locals });
});
```
