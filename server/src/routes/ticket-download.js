const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const prisma = require('../lib/prisma');

const TICKETS_DIR = path.join('/app/uploads', 'tickets');
const TICKET_TTL_MS = 24 * 60 * 60 * 1000;

function ensureDir() {
  if (!fs.existsSync(TICKETS_DIR)) fs.mkdirSync(TICKETS_DIR, { recursive: true });
}

function sweepExpired() {
  try {
    const files = fs.readdirSync(TICKETS_DIR).filter(f => f.endsWith('.meta.json'));
    for (const f of files) {
      const meta = JSON.parse(fs.readFileSync(path.join(TICKETS_DIR, f), 'utf8'));
      if (Date.now() > meta.expiresAt) {
        fs.rmSync(path.join(TICKETS_DIR, f), { force: true });
      }
    }
  } catch { /* no crítico */ }
}

// Crea token enlazado a un comprobanteId. No guarda PDF, solo metadatos.
function createTicketToken(comprobanteId) {
  ensureDir();
  sweepExpired();
  const token = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(
    path.join(TICKETS_DIR, `${token}.meta.json`),
    JSON.stringify({ comprobanteId, expiresAt: Date.now() + TICKET_TTL_MS, createdAt: Date.now() })
  );
  return token;
}

function formatMoney(val) {
  return `S/ ${parseFloat(val || 0).toFixed(2)}`;
}

function generatePDF(comp, res) {
  const doc = new PDFDocument({ size: [226, 900], margin: 10, autoFirstPage: true });
  doc.pipe(res);

  const W = 206; // ancho útil (226 - 2*10 margen)
  const farm = comp.farmacia || {};

  // Encabezado
  doc.fontSize(11).font('Helvetica-Bold').text(farm.nombre || 'CB Medic', { align: 'center', width: W });
  if (farm.ruc) doc.fontSize(8).font('Helvetica').text(`RUC: ${farm.ruc}`, { align: 'center', width: W });
  if (farm.direccion) doc.fontSize(7).text(farm.direccion, { align: 'center', width: W });
  if (farm.telefono) doc.fontSize(7).text(`Tel: ${farm.telefono}`, { align: 'center', width: W });

  doc.moveDown(0.4);
  doc.moveTo(10, doc.y).lineTo(216, doc.y).dash(2, { space: 2 }).stroke().undash();
  doc.moveDown(0.4);

  // Tipo y número
  const tipoLabel = comp.tipo_comprobante === 'BOLETA' ? 'BOLETA DE VENTA' : comp.tipo_comprobante === 'FACTURA' ? 'FACTURA ELECTRÓNICA' : comp.tipo_comprobante;
  const numero = String(comp.numero || '').padStart(6, '0');
  doc.fontSize(10).font('Helvetica-Bold').text(tipoLabel, { align: 'center', width: W });
  doc.fontSize(9).font('Helvetica').text(`${comp.serie || ''}-${numero}`, { align: 'center', width: W });

  doc.moveDown(0.3);
  doc.moveTo(10, doc.y).lineTo(216, doc.y).dash(2, { space: 2 }).stroke().undash();
  doc.moveDown(0.3);

  // Fecha y cliente
  const fecha = new Date(comp.fecha_emision);
  const fechaStr = `${String(fecha.getDate()).padStart(2,'0')}/${String(fecha.getMonth()+1).padStart(2,'0')}/${fecha.getFullYear()} ${String(fecha.getHours()).padStart(2,'0')}:${String(fecha.getMinutes()).padStart(2,'0')}`;
  doc.fontSize(7.5).font('Helvetica').text(`Fecha: ${fechaStr}`, { width: W });

  const cliente = comp.cliente;
  if (cliente && comp.nombre_razon_social) {
    if (comp.tipo_documento_cliente && comp.numero_documento_cliente) {
      const tipoDoc = comp.tipo_documento_cliente === '1' ? 'DNI' : comp.tipo_documento_cliente === '6' ? 'RUC' : 'Doc';
      doc.text(`${tipoDoc}: ${comp.numero_documento_cliente}`, { width: W });
    }
    doc.text(`Cliente: ${comp.nombre_razon_social}`, { width: W });
  } else {
    doc.text('Cliente: Público General', { width: W });
  }

  doc.moveDown(0.3);
  doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
  doc.moveDown(0.2);

  // Cabecera de items
  doc.fontSize(7).font('Helvetica-Bold');
  const colX = { desc: 10, cant: 128, pu: 154, total: 186 };
  const yHead = doc.y;
  doc.text('DESCRIPCIÓN', colX.desc, yHead, { width: 114 });
  doc.text('CANT', colX.cant, yHead, { width: 22, align: 'right' });
  doc.text('P.U.', colX.pu, yHead, { width: 28, align: 'right' });
  doc.text('TOTAL', colX.total, yHead, { width: 30, align: 'right' });
  doc.moveDown(0.3);
  doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
  doc.moveDown(0.2);

  // Items
  doc.font('Helvetica').fontSize(7.5);
  for (const item of (comp.comprobanteitem || [])) {
    const yItem = doc.y;
    const precio = parseFloat(item.precio_unitario || 0).toFixed(2);
    const total = parseFloat(item.total || 0).toFixed(2);
    doc.text(item.descripcion || '-', colX.desc, yItem, { width: 114 });
    const yAfterDesc = doc.y;
    doc.text(String(item.cantidad), colX.cant, yItem, { width: 22, align: 'right' });
    doc.text(precio, colX.pu, yItem, { width: 28, align: 'right' });
    doc.text(total, colX.total, yItem, { width: 30, align: 'right' });
    if (doc.y < yAfterDesc) doc.y = yAfterDesc;
    doc.moveDown(0.2);
  }

  doc.moveDown(0.2);
  doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
  doc.moveDown(0.3);

  // Totales
  const totalesX = 110;
  const valX = 186;
  const totW = 30;
  doc.fontSize(7.5).font('Helvetica');

  function totalRow(label, valor, bold = false) {
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 8.5 : 7.5);
    doc.text(label, totalesX, y, { width: 72 });
    doc.text(valor, valX, y, { width: totW, align: 'right' });
    doc.moveDown(bold ? 0.4 : 0.2);
  }

  totalRow('Subtotal:', formatMoney(comp.subtotal));
  totalRow('IGV (18%):', formatMoney(comp.igv));
  totalRow('TOTAL:', formatMoney(comp.total), true);

  doc.moveDown(0.3);

  // Pago
  const forma = comp.forma_pago || 'EFECTIVO';
  doc.fontSize(7.5).font('Helvetica').text(`Pago: ${forma}`, { width: W });
  if (comp.montoRecibido) {
    doc.text(`Recibido: ${formatMoney(comp.montoRecibido)}`, { width: W });
    if (comp.vuelto) doc.text(`Vuelto: ${formatMoney(comp.vuelto)}`, { width: W });
  }

  doc.moveDown(0.5);
  doc.moveTo(10, doc.y).lineTo(216, doc.y).dash(2, { space: 2 }).stroke().undash();
  doc.moveDown(0.4);

  doc.fontSize(7).text('¡Gracias por su compra!', { align: 'center', width: W });
  doc.fontSize(6.5).text('Este documento es válido como comprobante.', { align: 'center', width: W });

  doc.end();
}

// GET /ticket/:token — público, sin auth, enlace temporal
router.get('/:token', async (req, res) => {
  const { token } = req.params;
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).send('Enlace inválido.');

  const metaPath = path.join(TICKETS_DIR, `${token}.meta.json`);
  if (!fs.existsSync(metaPath)) return res.status(404).send('Enlace no encontrado o expirado.');

  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return res.status(500).send('Error interno.');
  }

  if (Date.now() > meta.expiresAt) {
    fs.rmSync(metaPath, { force: true });
    return res.status(410).send('Este enlace ha expirado (válido 24 horas).');
  }

  let comp;
  try {
    comp = await prisma.comprobante.findUnique({
      where: { id: meta.comprobanteId },
      include: { comprobanteitem: true, farmacia: true, cliente: true },
    });
  } catch (err) {
    console.error('[Ticket] Error Prisma:', err.message);
    return res.status(500).send('Error al obtener el comprobante.');
  }

  if (!comp) return res.status(404).send('Comprobante no encontrado.');

  const numero = String(comp.numero || '').padStart(6, '0');
  const filename = `ticket-${comp.serie || 'B001'}-${numero}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  generatePDF(comp, res);
});

module.exports = { router, createTicketToken };
