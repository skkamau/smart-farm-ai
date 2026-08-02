import { ArrowLeft, Download, Printer, Share2 } from "lucide-react";
import toast from "react-hot-toast";

const amount = (value, currency) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value || 0));
const receiptDate = (value, withTime = false) => new Intl.DateTimeFormat("en-KE", withTime
  ? { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
  : { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
const unitName = (value) => String(value || "item").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ReceiptPreview({ receipt, onBack, onDownload }) {
  async function shareReceipt() {
    const text = `${receipt.farm.name} receipt ${receipt.receiptNumber}: ${amount(receipt.amountReceived, receipt.currency)} received for sale ${receipt.saleNumber}.`;
    try {
      if (navigator.share) await navigator.share({ title: `Receipt ${receipt.receiptNumber}`, text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); toast.success("Receipt summary copied"); }
      else toast.error("Sharing is not available in this browser");
    } catch (error) {
      if (error?.name !== "AbortError") toast.error("Could not share receipt");
    }
  }

  const statusClass = receipt.status === "Paid" ? "receipt-status-paid" : receipt.status === "Partially Paid" ? "receipt-status-partial" : receipt.status === "Voided" ? "receipt-status-void" : "receipt-status-unpaid";
  const summaryRows = [
    ["Subtotal", receipt.subtotal],
    ...(receipt.discount > 0 ? [["Discount", -receipt.discount]] : []),
    ...(receipt.additionalCharges > 0 ? [["Additional charges", receipt.additionalCharges]] : []),
    ...(receipt.tax > 0 ? [["Tax", receipt.tax]] : []),
    ["Sale Total", receipt.saleTotal, true],
    ...(receipt.previousPayments > 0 ? [["Previous payments", receipt.previousPayments]] : []),
    ["Amount received in this payment", receipt.amountReceived],
    ["Total paid to date", receipt.totalPaidToDate],
    ["Remaining balance", receipt.remainingBalance]
  ];

  return <div className="receipt-preview-shell">
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
      <button className="btn-muted" onClick={onBack} aria-label="Back to sale"><ArrowLeft className="h-4 w-4" /> Back to Sale</button>
      <div className="flex flex-wrap gap-2">
        <button className="btn-muted" onClick={shareReceipt} aria-label="Share receipt"><Share2 className="h-4 w-4" /> Share Receipt</button>
        <button className="btn-muted" onClick={() => window.print()} aria-label="Print receipt"><Printer className="h-4 w-4" /> Print Receipt</button>
        <button className="btn-primary" onClick={onDownload} aria-label="Download receipt PDF"><Download className="h-4 w-4" /> Download PDF</button>
      </div>
    </div>
    <article id="sale-receipt-preview" className={`receipt-paper ${receipt.voidedAt ? "receipt-voided" : ""}`} aria-label={`Receipt ${receipt.receiptNumber}`}>
      {receipt.voidedAt && <div className="receipt-void-watermark" aria-hidden="true">VOID</div>}
      <header className="receipt-header">
        <div className="receipt-brand">
          <img src="/brand/smart-farm-mark.png" alt="Smart Farm AI logo" />
          <div><div className="receipt-brand-name">Smart Farm AI</div><strong>{receipt.farm.name}</strong>{receipt.farm.location && <span>{receipt.farm.location}</span>}{receipt.farm.phone && <span>Phone: {receipt.farm.phone}</span>}{receipt.farm.email && <span>Email: {receipt.farm.email}</span>}</div>
        </div>
        <div className="receipt-meta"><h2>RECEIPT</h2><dl><div><dt>Receipt #:</dt><dd>{receipt.receiptNumber}</dd></div><div><dt>Date:</dt><dd>{receiptDate(receipt.receiptDate)}</dd></div><div><dt>Sale #:</dt><dd>{receipt.saleNumber}</dd></div></dl><span className={`receipt-status ${statusClass}`}>{receipt.status}</span></div>
      </header>

      <ReceiptSection title="Customer Details"><div className="receipt-customer"><strong>{receipt.customer.name || "Walk-in Customer"}</strong>{receipt.customer.phone && <span>Phone: {receipt.customer.phone}</span>}{receipt.customer.email && <span>Email: {receipt.customer.email}</span>}{receipt.customer.address && <span>{receipt.customer.address}</span>}</div></ReceiptSection>

      <ReceiptSection title="Items Sold"><div className="receipt-table-wrap"><table className="receipt-table"><thead><tr><th>No.</th><th>Description</th><th className="numeric">Quantity</th><th>Unit</th><th className="numeric">Unit price</th><th className="numeric">Total</th></tr></thead><tbody>{receipt.items.map((item) => <tr key={`${item.number}-${item.description}`}><td>{item.number}</td><td><strong>{item.description}</strong></td><td className="numeric">{item.quantity.toLocaleString()}</td><td>{unitName(item.unit)}</td><td className="numeric">{amount(item.unitPrice, receipt.currency)}</td><td className="numeric"><strong>{amount(item.total, receipt.currency)}</strong></td></tr>)}</tbody></table></div></ReceiptSection>

      <div className="receipt-summary"><dl>{summaryRows.map(([label, value, emphasis]) => <div key={label} className={emphasis ? "receipt-total-row" : ""}><dt>{label}</dt><dd>{amount(value, receipt.currency)}</dd></div>)}</dl></div>

      <ReceiptSection title="Payment Details"><dl className="receipt-payment-grid"><ReceiptDetail label="Payment method" value={receipt.payment.method} />{receipt.payment.reference && <ReceiptDetail label="Reference" value={receipt.payment.reference} />}<ReceiptDetail label="Payment date" value={receiptDate(receipt.payment.date, true)} /><ReceiptDetail label="Amount received" value={amount(receipt.amountReceived, receipt.currency)} /><ReceiptDetail label="Received by" value={receipt.payment.receivedBy} /><ReceiptDetail label="Payment number" value={receipt.payment.paymentNumber} /></dl></ReceiptSection>
      {receipt.notes && <ReceiptSection title="Notes"><p className="receipt-notes">{receipt.notes}</p></ReceiptSection>}
      {receipt.voidedAt && <ReceiptSection title="Void Details"><div className="receipt-void-details"><strong>Reason: {receipt.voidReason}</strong><span>Voided {receiptDate(receipt.voidedAt, true)}{receipt.voidedBy ? ` by ${receipt.voidedBy}` : ""}</span></div></ReceiptSection>}
      <footer className="receipt-footer"><strong>Thank you for doing business with us.</strong><span>Generated securely by Smart Farm AI.</span><span>Verification: {receipt.verificationReference}</span></footer>
    </article>
  </div>;
}

function ReceiptSection({ title, children }) {
  return <section className="receipt-section"><h3>{title}</h3>{children}</section>;
}

function ReceiptDetail({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
