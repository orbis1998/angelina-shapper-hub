import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatCurrency, formatDate, formatMonth } from "./format";

export interface DeliveryExport {
  receipt_number: string;
  delivered_at: string;
  client_name: string;
  client_address: string;
  livreur_name: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
}

const paymentLabel = (m: string) =>
  ({ cash: "Espèces", mobile_money: "Mobile Money", bank_transfer: "Virement" })[m] ?? m;

export function exportMonthlyExcel(month: string, rows: DeliveryExport[]) {
  const data = rows.map((r) => ({
    "N° Reçu": r.receipt_number,
    Date: formatDate(r.delivered_at),
    Client: r.client_name,
    Adresse: r.client_address,
    Livreur: r.livreur_name,
    "Sous-total": Number(r.subtotal),
    Réduction: Number(r.discount_amount),
    Total: Number(r.total_amount),
    Paiement: paymentLabel(r.payment_method),
  }));
  const total = rows.reduce((s, r) => s + Number(r.total_amount), 0);
  const reductions = rows.reduce((s, r) => s + Number(r.discount_amount), 0);
  data.push({ "N° Reçu": "", Date: "", Client: "", Adresse: "", Livreur: "TOTAL", "Sous-total": 0, Réduction: reductions, Total: total, Paiement: "" });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, `Livraisons ${month}`);
  XLSX.writeFile(wb, `angelina-shapper-${month}.xlsx`);
}

export function exportMonthlyPDF(month: string, rows: DeliveryExport[]) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Angelina Shapper", 14, 18);
  doc.setFontSize(11);
  doc.text(`Rapport mensuel — ${formatMonth(month + "-01")}`, 14, 26);
  const total = rows.reduce((s, r) => s + Number(r.total_amount), 0);
  const reductions = rows.reduce((s, r) => s + Number(r.discount_amount), 0);
  autoTable(doc, {
    startY: 32,
    head: [["Date", "N° Reçu", "Client", "Livreur", "Réduc.", "Total", "Paiement"]],
    body: rows.map((r) => [
      formatDate(r.delivered_at),
      r.receipt_number,
      r.client_name,
      r.livreur_name,
      formatCurrency(r.discount_amount),
      formatCurrency(r.total_amount),
      paymentLabel(r.payment_method),
    ]),
    foot: [["", "", "", "TOTAL", formatCurrency(reductions), formatCurrency(total), ""]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [13, 122, 95] },
    footStyles: { fillColor: [201, 168, 76], textColor: 20, fontStyle: "bold" },
  });
  doc.save(`angelina-shapper-${month}.pdf`);
}

export interface ReceiptData {
  receipt_number: string;
  delivered_at: string;
  client_name: string;
  client_address: string;
  client_phone?: string | null;
  livreur_name: string;
  items: { name: string; quantity: number; unit_price: number; line_total: number }[];
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  notes?: string | null;
}

export function generateReceipt(r: ReceiptData) {
  const doc = new jsPDF({ unit: "mm", format: [80, 200] });
  let y = 8;
  doc.setFontSize(14); doc.text("Angelina Shapper", 40, y, { align: "center" }); y += 5;
  doc.setFontSize(8); doc.text("Reçu de livraison", 40, y, { align: "center" }); y += 5;
  doc.setLineWidth(0.2); doc.line(4, y, 76, y); y += 4;
  doc.text(`N° ${r.receipt_number}`, 4, y); y += 4;
  doc.text(formatDate(r.delivered_at), 4, y); y += 4;
  doc.text(`Livreur: ${r.livreur_name}`, 4, y); y += 4;
  doc.line(4, y, 76, y); y += 4;
  doc.text(`Client: ${r.client_name}`, 4, y); y += 4;
  doc.text(`Adresse: ${r.client_address}`.slice(0, 60), 4, y); y += 4;
  if (r.client_phone) { doc.text(`Tél: ${r.client_phone}`, 4, y); y += 4; }
  doc.line(4, y, 76, y); y += 4;
  for (const it of r.items) {
    doc.text(`${it.quantity}x ${it.name}`.slice(0, 40), 4, y);
    doc.text(formatCurrency(it.line_total), 76, y, { align: "right" }); y += 4;
  }
  doc.line(4, y, 76, y); y += 4;
  doc.text("Sous-total", 4, y); doc.text(formatCurrency(r.subtotal), 76, y, { align: "right" }); y += 4;
  if (r.discount_amount > 0) {
    doc.text("Réduction", 4, y); doc.text(`-${formatCurrency(r.discount_amount)}`, 76, y, { align: "right" }); y += 4;
  }
  doc.setFontSize(11); doc.text("TOTAL", 4, y); doc.text(formatCurrency(r.total_amount), 76, y, { align: "right" }); y += 6;
  doc.setFontSize(8); doc.text(`Paiement: ${paymentLabel(r.payment_method)}`, 4, y); y += 5;
  doc.text("Merci de votre confiance.", 40, y, { align: "center" });
  doc.save(`recu-${r.receipt_number}.pdf`);
}
