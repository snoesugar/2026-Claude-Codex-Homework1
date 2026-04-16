'use strict';

const crypto = require('crypto');

// Source: guides/13-checkmacvalue.md Node.js section
// ECPay AIO uses CMV-SHA256 protocol

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || '3002607';
const HASH_KEY    = process.env.ECPAY_HASH_KEY    || 'pwFHCqoQZGmho4w6';
const HASH_IV     = process.env.ECPAY_HASH_IV     || 'EkRm7iFT261dpevs';
const IS_STAGING  = (process.env.ECPAY_ENV || 'staging') !== 'production';

const BASE_PAYMENT_URL = IS_STAGING
  ? 'https://payment-stage.ecpay.com.tw'
  : 'https://payment.ecpay.com.tw';

/**
 * ECPay 專用 URL Encode
 * urlencode → %20→+ → ~→%7e → '→%27 → toLowerCase → .NET 字元替換
 * Source: guides/13-checkmacvalue.md §Node.js
 */
function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  const replacements = {
    '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!',
    '%2a': '*', '%28': '(', '%29': ')',
  };
  for (const [old, char] of Object.entries(replacements)) {
    encoded = encoded.split(old).join(char);
  }
  return encoded;
}

/**
 * 計算 ECPay AIO CheckMacValue (SHA256)
 * Source: guides/13-checkmacvalue.md §Node.js
 * @param {Object} params - 不含 CheckMacValue 的參數物件（值皆為字串）
 * @returns {string} 大寫 hex 字串
 */
function generateCheckMacValue(params) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const sorted = Object.keys(filtered)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${HASH_KEY}&${paramStr}&HashIV=${HASH_IV}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

/**
 * 驗證 CheckMacValue（timing-safe）
 */
function verifyCheckMacValue(params) {
  const received = (params.CheckMacValue || '').toUpperCase();
  const calculated = generateCheckMacValue(params);
  const a = Buffer.from(received);
  const b = Buffer.from(calculated);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * 取得台北時區時間字串 yyyy/MM/dd HH:mm:ss
 * Source: guides/lang-standards/nodejs.md §日期與時區
 */
function getMerchantTradeDate() {
  return new Date().toLocaleString('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).replace(/-/g, '/');
}

/**
 * 主動查詢綠界交易狀態
 * Source: guides/01-payment-aio.md §查詢訂單
 * @param {string} merchantTradeNo
 * @returns {Object} 解析後的回應物件，含 TradeStatus 等欄位
 */
async function queryTradeInfo(merchantTradeNo) {
  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  };
  params.CheckMacValue = generateCheckMacValue(params);

  const body = new URLSearchParams(params).toString();

  const res = await fetch(`${BASE_PAYMENT_URL}/Cashier/QueryTradeInfo/V5`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`QueryTradeInfo HTTP ${res.status}`);
  }

  const text = await res.text();
  return Object.fromEntries(new URLSearchParams(text));
}

module.exports = {
  MERCHANT_ID,
  BASE_PAYMENT_URL,
  generateCheckMacValue,
  verifyCheckMacValue,
  getMerchantTradeDate,
  queryTradeInfo,
};
