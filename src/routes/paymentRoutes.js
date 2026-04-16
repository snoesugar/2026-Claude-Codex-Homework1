'use strict';

const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const {
  MERCHANT_ID,
  BASE_PAYMENT_URL,
  generateCheckMacValue,
  verifyCheckMacValue,
  getMerchantTradeDate,
  queryTradeInfo,
} = require('../ecpay');

const router = express.Router();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// ─── 建立商品名稱字串（max 200 字元，用 # 分隔）────────────────────────────
function buildItemName(items) {
  const raw = items.map(i => `${i.product_name} x${i.quantity}`).join('#');
  // 安全截斷：避免截在 UTF-8 多位元組字元中間
  if (raw.length <= 200) return raw;
  let truncated = raw.slice(0, 200);
  // 確保最後一個字元不是不完整的 UTF-8 序列（Buffer 方式）
  return Buffer.from(truncated).slice(0, 200).toString('utf8').replace(/\uFFFD/g, '').trimEnd();
}

// ─── POST /api/payment/create/:orderId ──────────────────────────────────────
// 建立 ECPay AIO 付款參數，回傳 { data: { action_url, fields } }
router.post('/api/payment/create/:orderId', authMiddleware, (req, res) => {
  const { orderId } = req.params;
  const userId = req.user.userId;

  const order = db.prepare(
    'SELECT * FROM orders WHERE id = ? AND user_id = ?'
  ).get(orderId, userId);

  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({
      data: null,
      error: 'INVALID_STATUS',
      message: '訂單狀態不是 pending，無法付款',
    });
  }

  const items = db.prepare(
    'SELECT product_name, quantity FROM order_items WHERE order_id = ?'
  ).all(orderId);

  // 每次點擊產生新的唯一交易編號，允許重試（Source: guides/01-payment-aio.md §MerchantTradeNo）
  const merchantTradeNo = 'FL' + Math.floor(Date.now() / 1000);

  // 儲存本次交易編號，供 result handler 查詢時使用
  db.prepare('UPDATE orders SET merchant_trade_no = ? WHERE id = ?').run(merchantTradeNo, orderId);

  const params = {
    MerchantID:        MERCHANT_ID,
    MerchantTradeNo:   merchantTradeNo,
    MerchantTradeDate: getMerchantTradeDate(),
    PaymentType:       'aio',
    TotalAmount:       String(order.total_amount),
    TradeDesc:         '花卉電商訂購',
    ItemName:          buildItemName(items) || '訂單商品',
    ReturnURL:         `${BASE_URL}/payment/notify`,
    OrderResultURL:    `${BASE_URL}/payment/result`,
    ClientBackURL:     `${BASE_URL}/orders/${orderId}?payment=cancel`,
    ChoosePayment:     'ALL',
    EncryptType:       '1',
    CustomField1:      orderId,  // 回傳時直接用來查詢訂單，免逆推 MerchantTradeNo
  };

  params.CheckMacValue = generateCheckMacValue(params);

  return res.json({
    data: {
      action_url: `${BASE_PAYMENT_URL}/Cashier/AioCheckOut/V5`,
      fields: params,
    },
    error: null,
    message: '付款參數建立成功',
  });
});

// ─── POST /payment/result ────────────────────────────────────────────────────
// OrderResultURL：ECPay 付款後透過使用者瀏覽器 Form POST 導回此端點
// 主動呼叫 QueryTradeInfo 驗證付款結果，更新訂單狀態後導回訂單詳情頁
router.post('/payment/result', async (req, res) => {
  const { MerchantTradeNo, CustomField1: orderId } = req.body;

  if (!MerchantTradeNo || !orderId) {
    return res.redirect('/orders?payment=failed');
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  if (!order) {
    return res.redirect('/orders?payment=failed');
  }

  // 已處理過的訂單直接跳轉（冪等性保護）
  if (order.status !== 'pending') {
    const resultParam = order.status === 'paid' ? 'success' : 'failed';
    return res.redirect(`/orders/${orderId}?payment=${resultParam}`);
  }

  try {
    const tradeInfo = await queryTradeInfo(MerchantTradeNo);

    // 驗證回應的 CheckMacValue（防偽造回應）
    if (!verifyCheckMacValue(tradeInfo)) {
      console.error('[ECPay] QueryTradeInfo CheckMacValue 驗證失敗');
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('failed', orderId);
      return res.redirect(`/orders/${orderId}?payment=failed`);
    }

    // TradeStatus: '1' = 已付款, '0' = 未付款, '10200095' = 交易未成立
    if (tradeInfo.TradeStatus === '1') {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', orderId);
      return res.redirect(`/orders/${orderId}?payment=success`);
    } else {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('failed', orderId);
      return res.redirect(`/orders/${orderId}?payment=failed`);
    }
  } catch (err) {
    console.error('[ECPay] QueryTradeInfo 呼叫失敗:', err.message);
    // 查詢失敗時不更新訂單狀態，讓使用者可以重試
    return res.redirect(`/orders/${orderId}?payment=failed`);
  }
});

// ─── POST /payment/notify ────────────────────────────────────────────────────
// ReturnURL：本地端無法接收，但必須實作並回應 1|OK
// Source: guides/01-payment-aio.md §ReturnURL 重要限制
router.post('/payment/notify', (req, res) => {
  res.status(200).type('text/plain').send('1|OK');
});

// ─── GET /payment/cancel ─────────────────────────────────────────────────────
// ClientBackURL：使用者在綠界付款頁點取消時導回
router.get('/payment/cancel', (req, res) => {
  const orderId = req.query.orderId || '';
  if (orderId) {
    return res.redirect(`/orders/${orderId}?payment=cancel`);
  }
  return res.redirect('/orders');
});

module.exports = router;
