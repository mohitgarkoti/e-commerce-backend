const PDFDocument = require('pdfkit');

const generatePDFInvoice = (order, res) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Stream output to res
  doc.pipe(res);

  // Header info
  doc.fillColor('#0F172A').fontSize(24).font('Helvetica-Bold').text('GARKOTI E-COMMERCE', 50, 45);
  doc.fillColor('#333333').fontSize(9).font('Helvetica').text('Premium General Online Store', 50, 75);
  doc.text('Email: billing@garkoti.com | Web: www.garkoti.com | Phone: +91-8888888888', 50, 88);
  
  doc.fillColor('#1C1917').fontSize(20).font('Helvetica-Bold').text('TAX INVOICE', 400, 45, { align: 'right' });
  doc.fontSize(9).font('Helvetica').text(`Order ID: ${order._id}`, 400, 75, { align: 'right' });
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 400, 88, { align: 'right' });
  doc.text(`Payment: ${order.paymentMethod.toUpperCase()} (${order.paymentStatus})`, 400, 101, { align: 'right' });

  // Horizontal divider
  doc.moveTo(50, 120).lineTo(550, 120).stroke('#4F46E5');

  // Customer / Shipping info
  doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('Customer Billing Info:', 50, 140);
  doc.fillColor('#333333').fontSize(9).font('Helvetica');
  const clientName = order.user ? order.user.name : order.guestInfo.name;
  const clientEmail = order.user ? order.user.email : order.guestInfo.email;
  
  doc.text(clientName, 50, 155);
  doc.text(clientEmail, 50, 168);
  doc.text(`Phone: ${order.shippingAddress.phone}`, 50, 181);
  doc.text(`Address: ${order.shippingAddress.street}`, 50, 194);
  doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.postalCode}`, 50, 207);
  doc.text(`Country: ${order.shippingAddress.country}`, 50, 220);

  // Table header
  let y = 250;
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10);
  doc.text('Item Description', 50, y);
  doc.text('SKU', 260, y);
  doc.text('Price', 340, y, { width: 60, align: 'right' });
  doc.text('Qty', 420, y, { width: 30, align: 'right' });
  doc.text('Subtotal', 470, y, { width: 80, align: 'right' });

  // Line under header
  doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke('#0F172A');
  y += 25;

  // Items List
  doc.fillColor('#333333').font('Helvetica').fontSize(9);
  order.items.forEach((item) => {
    // Check page boundaries
    if (y > 700) {
      doc.addPage();
      y = 50; // reset y
    }
    doc.text(item.name.substring(0, 36), 50, y);
    doc.text(item.sku, 260, y);
    doc.text(`INR ${item.price.toFixed(2)}`, 340, y, { width: 60, align: 'right' });
    doc.text(item.quantity.toString(), 420, y, { width: 30, align: 'right' });
    doc.text(`INR ${(item.price * item.quantity).toFixed(2)}`, 470, y, { width: 80, align: 'right' });
    y += 20;
  });

  // Line under items
  doc.moveTo(50, y + 5).lineTo(550, y + 5).stroke('#CCCCCC');
  y += 15;

  // Totals calculations
  doc.font('Helvetica-Bold');
  doc.text('Subtotal:', 340, y, { width: 100, align: 'right' });
  doc.font('Helvetica').text(`INR ${order.totalAmount.toFixed(2)}`, 470, y, { width: 80, align: 'right' });
  y += 15;

  if (order.discountAmount > 0) {
    doc.font('Helvetica-Bold');
    doc.text('Discount Applied:', 340, y, { width: 100, align: 'right' });
    doc.font('Helvetica').text(`- INR ${order.discountAmount.toFixed(2)}`, 470, y, { width: 80, align: 'right' });
    y += 15;
  }

  doc.font('Helvetica-Bold');
  doc.text('Tax (18% GST):', 340, y, { width: 100, align: 'right' });
  doc.font('Helvetica').text(`INR ${order.taxAmount.toFixed(2)}`, 470, y, { width: 80, align: 'right' });
  y += 15;

  doc.font('Helvetica-Bold');
  doc.text('Shipping Charges:', 340, y, { width: 100, align: 'right' });
  doc.font('Helvetica').text(`INR ${order.shippingCharges.toFixed(2)}`, 470, y, { width: 80, align: 'right' });
  y += 20;

  // Final border
  doc.moveTo(320, y - 5).lineTo(550, y - 5).stroke('#4F46E5');

  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(11);
  doc.text('Total Invoice Value:', 310, y, { width: 130, align: 'right' });
  doc.text(`INR ${order.finalAmount.toFixed(2)}`, 450, y, { width: 100, align: 'right' });

  // Terms Note / Footer
  doc.fillColor('#666666').fontSize(8).font('Helvetica-Oblique')
     .text('Terms: All products are covered under warranty as specified on Garkoti.com. Thank you for placing your trust in us!', 50, 750, { align: 'center', width: 500 });

  doc.end();
};

module.exports = generatePDFInvoice;
