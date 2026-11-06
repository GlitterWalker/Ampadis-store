(() => {
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  const MAX_QTY = 10;

  let products = [];
  let cart = loadCart(); // { productId: qty }

  function loadCart() {
    try { return JSON.parse(localStorage.getItem('cart') || '{}') || {}; } catch { return {}; }
  }
  function saveCart() {
    try { localStorage.setItem('cart', JSON.stringify(cart)); } catch { /* ignore */ }
  }
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    Object.assign(n, props);
    kids.forEach(k => n.append(k));
    return n;
  }

  /* ---------- products ---------- */
  function renderProducts() {
    const root = $('products');
    root.replaceChildren(...products.map(p => {
      const btn = el('button', { className: 'btn', type: 'button', textContent: 'Add to cart' });
      btn.addEventListener('click', () => change(p.id, +1));
      return el('article', { className: 'card' },
        el('h3', { textContent: p.name }),
        el('p', { className: 'price', textContent: fmt(p.price) }),
        btn);
    }));
  }

  /* ---------- cart ---------- */
  function change(id, delta) {
    const next = Math.min(MAX_QTY, (cart[id] || 0) + delta);
    if (next <= 0) delete cart[id]; else cart[id] = next;
    saveCart();
    hideMsg();
    renderCart();
  }

  function renderCart() {
    const body = $('cart-body');
    const entries = Object.entries(cart).filter(([id]) => products.some(p => p.id === id));
    const btn = $('place-order');

    if (entries.length === 0) {
      body.replaceChildren(el('p', { className: 'empty', textContent: 'Your cart is empty.' }));
      $('total').hidden = true;
      btn.disabled = true;
      return;
    }

    let total = 0;
    const list = el('ul', { className: 'lines' });
    for (const [id, qty] of entries) {
      const p = products.find(x => x.id === id);
      total += p.price * qty;

      const minus = el('button', { type: 'button', textContent: '−', ariaLabel: `Decrease ${p.name}` });
      const plus = el('button', { type: 'button', textContent: '+', ariaLabel: `Increase ${p.name}` });
      const remove = el('button', { type: 'button', className: 'link', textContent: 'Remove', ariaLabel: `Remove ${p.name}` });
      minus.addEventListener('click', () => change(id, -1));
      plus.addEventListener('click', () => change(id, +1));
      remove.addEventListener('click', () => change(id, -MAX_QTY));
      plus.disabled = qty >= MAX_QTY;

      list.append(el('li', { className: 'line' },
        el('div', {}, el('div', { className: 'name', textContent: p.name }), el('div', { className: 'unit', textContent: fmt(p.price) + ' each' })),
        el('div', { className: 'qty' }, minus, el('span', { textContent: String(qty) }), plus),
        el('div', { className: 'sub', textContent: fmt(p.price * qty) }),
        remove));
    }
    body.replaceChildren(list);
    $('total').textContent = 'Total: ' + fmt(total);
    $('total').hidden = false;
    btn.disabled = false;
  }

  /* ---------- messages ---------- */
  function showMsg(kind, ...nodes) {
    const m = $('msg');
    m.className = 'msg ' + kind;
    m.replaceChildren(...nodes);
    m.hidden = false;
  }
  function hideMsg() { $('msg').hidden = true; }

  /* ---------- place order ---------- */
  async function placeOrder() {
    const btn = $('place-order');
    const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
    if (!items.length) return;

    btn.disabled = true;
    btn.textContent = 'Placing order…';
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not place order.');

      cart = {};
      saveCart();
      renderCart();
      showMsg('ok',
        document.createTextNode(`Order confirmed. Thanks for shopping! Your order ID is`),
        el('span', { className: 'oid', textContent: data.orderId }),
        document.createTextNode(` · Total ${fmt(data.total)}`));
    } catch (e) {
      showMsg('err', document.createTextNode(e.message + ' Try again.'));
      btn.disabled = false;
    } finally {
      btn.textContent = 'Place order';
    }
  }

  /* ---------- boot ---------- */
  async function init() {
    $('place-order').addEventListener('click', placeOrder);
    try {
      const [prods, info] = await Promise.all([
        fetch('/api/products').then(r => r.json()),
        fetch('/api/info').then(r => r.json()),
      ]);
      products = prods;
      const badge = $('badge');
      badge.replaceChildren(
        document.createTextNode('Serving from '),
        el('b', { textContent: info.color }),
        document.createTextNode(' · ' + info.instance));
      renderProducts();
      renderCart();
    } catch {
      showMsg('err', document.createTextNode('Could not load the store.'));
    }
  }
  init();
})();
