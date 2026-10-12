import { bdt } from "@/lib/format";

type Fmt = "a4" | "pos";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Opens a print-ready invoice (A4) or thermal 80mm slip in a new window and triggers print. */
export function printInvoice(order: any, items: any[], fmt: Fmt) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) { alert("Please allow pop-ups to print the invoice."); return; }
  const date = new Date(order.created_at).toLocaleString("en-GB");
  const cod = order.payment_status === "paid" ? 0 : order.total_bdt;
  const rows = items.map((it) => `
    <tr><td>${esc(it.product_name)}${it.variant_label ? ` <small>(${esc(it.variant_label)})</small>` : ""}</td>
    <td class="c">${it.qty}</td><td class="r">${esc(bdt(it.unit_price_bdt))}</td><td class="r">${esc(bdt(it.unit_price_bdt * it.qty))}</td></tr>`).join("");
  const a4css = `@page{size:A4;margin:14mm}body{font:13px/1.5 system-ui,sans-serif;color:#111;max-width:780px;margin:auto}
    header{display:flex;justify-content:space-between;border-bottom:3px solid #1f7a4d;padding-bottom:12px}
    h1{margin:0;color:#1f7a4d;font-size:26px}.tag{color:#f07a1a;font-weight:600}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}
    table{width:100%;border-collapse:collapse}th{background:#eef6f1;text-align:left}
    th,td{padding:8px;border-bottom:1px solid #ddd}.tot td{border:none;padding:4px 8px}`;
  const poscss = `@page{size:80mm auto;margin:3mm}body{font:12px/1.35 monospace;color:#000;width:72mm;margin:0}
    header{text-align:center;border-bottom:1px dashed #000;padding-bottom:6px}h1{margin:0;font-size:18px}
    .grid{margin:6px 0;border-bottom:1px dashed #000;padding-bottom:6px}
    table{width:100%;border-collapse:collapse}th{text-align:left;border-bottom:1px dashed #000}td,th{padding:2px 0;font-size:11px}
    .tot{border-top:1px dashed #000}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(order.order_number)}</title>
  <style>${fmt === "a4" ? a4css : poscss}.c{text-align:center}.r{text-align:right}.big{font-size:1.25em;font-weight:700}
  .cod{margin-top:12px;padding:8px;border:2px solid #000;text-align:center;font-weight:700}
  .bar{font-family:monospace;letter-spacing:3px;font-size:1.3em;text-align:center;margin-top:10px}
  footer{margin-top:16px;text-align:center;font-size:.85em;color:#555}@media print{.np{display:none}}</style></head><body>
  <header><div><h1>GochaoBD</h1><div class="tag">Home Organizers · Smart Living</div></div>
  <div class="${fmt === "a4" ? "r" : ""}"><div class="big">INVOICE</div><div>#${esc(order.order_number)}</div><div>${esc(date)}</div></div></header>
  <div class="grid"><div><b>Bill / Ship to</b><br>${esc(order.customer_name)}<br>${esc(order.customer_phone)}<br>
  ${esc(order.address_line)}, ${esc(order.city)}${order.district ? ", " + esc(order.district) : ""}</div>
  <div><b>Payment</b>: ${esc(String(order.payment_method).toUpperCase())} (${esc(order.payment_status)})<br>
  <b>Status</b>: ${esc(order.status)}<br>${order.courier ? `<b>Courier</b>: ${esc(order.courier)} ${esc(order.tracking_number ?? order.consignment_id ?? "")}` : ""}</div></div>
  <table><thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
  <table class="tot"><tr><td>Subtotal</td><td class="r">${esc(bdt(order.subtotal_bdt))}</td></tr>
  <tr><td>Shipping</td><td class="r">${esc(bdt(order.shipping_bdt))}</td></tr>
  ${order.discount_bdt ? `<tr><td>Discount${order.coupon_code ? " (" + esc(order.coupon_code) + ")" : ""}</td><td class="r">-${esc(bdt(order.discount_bdt))}</td></tr>` : ""}
  <tr class="big"><td>Grand total</td><td class="r">${esc(bdt(order.total_bdt))}</td></tr></table>
  <div class="cod">COLLECT (COD): ${esc(bdt(cod))}</div>
  <div class="bar">*${esc(order.order_number)}*</div>
  ${order.notes ? `<p><b>Note:</b> ${esc(order.notes)}</p>` : ""}
  <footer>Thank you for shopping with GochaoBD!</footer>
  <p class="np" style="text-align:center"><button onclick="print()">Print / Save as PDF</button></p>
  <script>setTimeout(function(){print()},300)</script></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
