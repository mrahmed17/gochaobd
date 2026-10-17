import { bdt } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Fmt = "a4" | "pos";

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/**
 * CODE39 (Code 3 of 9, ISO/IEC 16388) module patterns — run-length bits where
 * `1` = bar and `0` = space; a narrow element is 1 module and a wide element is
 * 3 modules, so every character is 15 modules long. `*` is start/stop.
 * Charset cross-checked against python-barcode's tested Code39 table.
 */
const CODE39: Record<string, string> = {
  "*": "100010111011101",
  "0": "101000111011101",
  "1": "111010001010111",
  "2": "101110001010111",
  "3": "111011100010101",
  "4": "101000111010111",
  "5": "111010001110101",
  "6": "101110001110101",
  "7": "101000101110111",
  "8": "111010001011101",
  "9": "101110001011101",
  A: "111010100010111",
  B: "101110100010111",
  C: "111011101000101",
  D: "101011100010111",
  E: "111010111000101",
  F: "101110111000101",
  G: "101010001110111",
  H: "111010100011101",
  I: "101110100011101",
  J: "101011100011101",
  K: "111010101000111",
  L: "101110101000111",
  M: "111011101010001",
  N: "101011101000111",
  O: "111010111010001",
  P: "101110111010001",
  Q: "101010111000111",
  R: "111010101110001",
  S: "101110101110001",
  T: "101011101110001",
  U: "111000101010111",
  V: "100011101010111",
  W: "111000111010101",
  X: "100010111010111",
  Y: "111000101110101",
  Z: "100011101110101",
  "-": "100010101110111",
  ".": "111000101011101",
  " ": "100011101011101",
  $: "100010001000101",
  "/": "100010001010001",
  "+": "100010100010001",
  "%": "101000100010001",
};

const CODE39_QUIET = 10; // minimum quiet zone, in modules, on each side

/**
 * Renders `text` as a scannable CODE39 barcode (inline SVG, one viewBox unit =
 * one module). The human-readable order number is printed next to it, which is
 * what couriers type when a scanner is not available.
 */
export function code39Svg(text: string, height = 44): string {
  const body = String(text ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z\-. $/+%]/g, "");
  if (!body) return "";
  const rects: string[] = [];
  let x = CODE39_QUIET;
  const chars = ["*", ...body.split(""), "*"];
  for (let c = 0; c < chars.length; c++) {
    const pat = CODE39[chars[c]];
    if (!pat) continue;
    if (c > 0) x += 1; // narrow inter-character gap
    let i = 0;
    while (i < pat.length) {
      const bit = pat[i];
      let len = 1;
      while (i + len < pat.length && pat[i + len] === bit) len++;
      if (bit === "1") rects.push(`<rect x="${x}" y="0" width="${len}" height="${height}"/>`);
      x += len;
      i += len;
    }
  }
  const w = x + CODE39_QUIET;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges" fill="#000" role="img" aria-label="Barcode ${esc(body)}">${rects.join("")}</svg>`;
}

/** Opens a print-ready invoice (A4) or thermal 80mm slip in a new window and triggers print. */
export function printInvoice(order: Tables<"orders">, items: Tables<"order_items">[], fmt: Fmt) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Please allow pop-ups to print the invoice.");
    return;
  }
  const date = new Date(order.created_at).toLocaleString("en-GB");
  const cod = order.payment_status === "paid" ? 0 : order.total_bdt;
  const rows = items
    .map(
      (it) => `
    <tr><td>${esc(it.product_name)}${it.variant_label ? ` <small>(${esc(it.variant_label)})</small>` : ""}</td>
    <td class="c">${it.qty}</td><td class="r">${esc(bdt(it.unit_price_bdt))}</td><td class="r">${esc(bdt(it.unit_price_bdt * it.qty))}</td></tr>`,
    )
    .join("");
  const a4css = `@page{size:A4;margin:14mm}body{font:13px/1.5 system-ui,sans-serif;color:#111;max-width:780px;margin:auto}
    header{display:flex;justify-content:space-between;border-bottom:3px solid #1f7a4d;padding-bottom:12px}
    h1{margin:0;color:#1f7a4d;font-size:26px}.tag{color:#f07a1a;font-weight:600}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}
    table{width:100%;border-collapse:collapse}th{background:#eef6f1;text-align:left}
    th,td{padding:8px;border-bottom:1px solid #ddd}.tot td{border:none;padding:4px 8px}
    .bc svg{display:block;width:340px;height:44px}`;
  const poscss = `@page{size:80mm auto;margin:3mm}body{font:12px/1.35 monospace;color:#000;width:72mm;margin:0}
    header{text-align:center;border-bottom:1px dashed #000;padding-bottom:6px}h1{margin:0;font-size:18px}
    .grid{margin:6px 0;border-bottom:1px dashed #000;padding-bottom:6px}
    table{width:100%;border-collapse:collapse}th{text-align:left;border-bottom:1px dashed #000}td,th{padding:2px 0;font-size:11px}
    .tot{border-top:1px dashed #000}
    .bc svg{display:block;width:100%;height:34px}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(order.order_number)}</title>
  <style>${fmt === "a4" ? a4css : poscss}.c{text-align:center}.r{text-align:right}.big{font-size:1.25em;font-weight:700}
  .cod{margin-top:12px;padding:8px;border:2px solid #000;text-align:center;font-weight:700}
  .bc{margin-top:12px}.bcnum{font-family:monospace;letter-spacing:2px;font-size:13px;text-align:center;margin-top:3px}
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
  <div class="bc">${code39Svg(String(order.order_number ?? ""), fmt === "pos" ? 34 : 44)}<div class="bcnum">${esc(order.order_number)}</div></div>
  ${order.notes ? `<p><b>Note:</b> ${esc(order.notes)}</p>` : ""}
  <footer>Thank you for shopping with GochaoBD!</footer>
  <p class="np" style="text-align:center"><button onclick="print()">Print / Save as PDF</button></p>
  <script>setTimeout(function(){print()},300)</script></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
