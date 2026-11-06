// Zero-dependency backend (Node built-ins only).
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const DEPLOY_COLOR = process.env.DEPLOY_COLOR || 'blue';
const PUBLIC_DIR = path.join(__dirname, 'public');
const ORDERS_FILE = path.join(__dirname, 'orders.jsonl');

const host = os.hostname();
const INSTANCE_ID = /^[0-9a-f]{12}$/.test(host)
  ? host
  : crypto.createHash('sha1').update(host).digest('hex').slice(0, 12);

// Source of truth for prices (client prices are never trusted).
const PRODUCTS = [
  { id: 'kb-01',  name: 'Mechanical Keyboard',        price: 4999 },
  { id: 'ms-01',  name: 'Wireless Mouse',             price: 1499 },
  { id: 'hub-01', name: 'USB-C Hub',                  price: 2299 },
  { id: 'stn-01', name: 'Laptop Stand',               price: 1899 },
  { id: 'hp-01',  name: 'Noise-Cancelling Headphones', price: 8999 },
  { id: 'cam-01', name: 'Webcam 1080p',               price: 3299 },
];
const BY_ID = new Map(PRODUCTS.map(p => [p.id, p]));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function readJson(req, limit = 10 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function newOrderId() {
  return 'ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function createOrder(req, res) {
  let body;
  try { body = await readJson(req); }
  catch (e) { return sendJson(res, 400, { error: e.message }); }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return sendJson(res, 400, { error: 'Cart is empty or invalid.' });
  }

  const lines = [];
  let total = 0;
  for (const it of items) {
    const product = BY_ID.get(it && it.id);
    const qty = it && it.qty;
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 10) {
      return sendJson(res, 400, { error: 'Invalid item in cart.' });
    }
    lines.push({ id: product.id, name: product.name, price: product.price, qty });
    total += product.price * qty;
  }

  const order = {
    orderId: newOrderId(),
    status: 'confirmed',
    items: lines,
    total,
    createdAt: new Date().toISOString(),
  };
  fs.appendFile(ORDERS_FILE, JSON.stringify(order) + '\n', err => {
    if (err) console.error('Could not persist order:', err.message);
  });
  console.log('Order confirmed', order.orderId, 'total', total);
  sendJson(res, 201, order);
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  try { rel = decodeURIComponent(rel); } catch { res.writeHead(400); return res.end('Bad request'); }
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && pathname === '/api/products') return sendJson(res, 200, PRODUCTS);
  if (req.method === 'GET' && pathname === '/api/info')
    return sendJson(res, 200, { color: DEPLOY_COLOR, instance: INSTANCE_ID });
  if (req.method === 'GET' && pathname === '/health') return sendJson(res, 200, { ok: true });
  if (req.method === 'POST' && pathname === '/api/orders') return createOrder(req, res);

  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ampadi's Store on :${PORT} (${DEPLOY_COLOR} · ${INSTANCE_ID})`);
});
