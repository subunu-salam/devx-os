import { get, fmtAED } from '../api.js';
import { crudPage } from './_shared.js';

export default async function items(view, ctx) {
  let accounts = [];
  try { accounts = await get('/api/accounts'); } catch {}
  const incomeAccts = accounts.filter((a) => a.account_type === 'income');
  const acctName = (id) => accounts.find((a) => a.id == id)?.name || '—';

  await crudPage(view, ctx, {
    title: 'Items', desc: 'Products and services you sell or buy — reused on invoices, estimates and bills.',
    addLabel: 'New Item', apiBase: '/api/items', entityName: 'item',
    searchKeys: ['name', 'sku', 'description'],
    kpis: (rows) => [
      { label: 'Total items', value: rows.length, icon: 'layers' },
      { label: 'Services', value: rows.filter((r) => r.item_type === 'service').length, icon: 'cpu' },
      { label: 'Goods', value: rows.filter((r) => r.item_type === 'goods').length, icon: 'inbox' },
    ],
    filters: [{ key: 'type', label: 'Type', options: ['All', 'service', 'goods'], match: (r, v) => r.item_type === v }],
    columns: [
      { label: 'Name', sort: (r) => r.name, render: (r) => `<strong>${esc(r.name)}</strong>${r.sku ? `<div class="muted" style="font-size:12px">${esc(r.sku)}</div>` : ''}` },
      { label: 'Type', sort: (r) => r.item_type, render: (r) => esc(r.item_type) },
      { label: 'Rate', align: 'right', sort: (r) => Number(r.sell_price), render: (r) => fmtAED(r.sell_price) },
      { label: 'VAT %', align: 'right', render: (r) => `${r.tax_percent}%` },
      { label: 'Stock', align: 'right', render: (r) => {
        if (!r.track_inventory) return '<span class="muted">—</span>';
        const low = r.reorder_level && Number(r.stock_on_hand) <= Number(r.reorder_level);
        return `<strong class="${low ? 'neg' : ''}">${Number(r.stock_on_hand || 0)}</strong>${r.unit ? ' ' + esc(r.unit) : ''}${low ? ` <span class="badge b-red">low</span>` : ''}`;
      } },
      { label: 'Income account', render: (r) => esc(acctName(r.income_account_id)) },
    ],
    fields: [
      { name: 'name', label: 'Item name', required: true, full: true },
      { name: 'item_type', label: 'Type', type: 'select', options: ['service', 'goods'] },
      { name: 'sku', label: 'SKU' },
      { name: 'sell_price', label: 'Selling price (AED)', type: 'number' },
      { name: 'cost_price', label: 'Cost price (AED)', type: 'number' },
      { name: 'tax_percent', label: 'VAT %', type: 'number', value: 5 },
      { name: 'income_account_id', label: 'Income account', type: 'select', allowEmpty: true,
        options: incomeAccts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })) },
      { name: 'unit', label: 'Unit (e.g. pcs, hrs)' },
      { name: 'track_inventory', label: 'Track inventory?', type: 'select', options: [{ value: '0', label: 'No — service / non-stock' }, { value: '1', label: 'Yes — track stock' }] },
      { name: 'opening_stock', label: 'Opening stock', type: 'number', step: '1' },
      { name: 'reorder_level', label: 'Reorder level', type: 'number', step: '1' },
      { name: 'description', label: 'Description', type: 'textarea', full: true },
    ],
    toPayload: (fd) => { const openStock = Number(fd.opening_stock || 0); return { ...fd, track_inventory: Number(fd.track_inventory || 0), opening_stock: openStock, stock_on_hand: openStock, reorder_level: Number(fd.reorder_level || 0), is_active: 1 }; },
    empty: 'No items yet.',
  });

  // The generic select renders option values; patch income-account labels post-render is unnecessary
  // because we pass account names via a custom render below. (Left simple on purpose.)
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
