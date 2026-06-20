const express = require('express');
const router = express.Router();
const { saveTicket } = require('./ticket-download');

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';
const WAHA_KEY = process.env.WAHA_API_KEY || '';
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://213.199.58.162';

function formatChatId(telefono) {
  const digits = String(telefono).replace(/\D/g, '');
  const withCountry = digits.startsWith('51') ? digits : `51${digits}`;
  return `${withCountry}@c.us`;
}

async function wahaPost(path, body) {
  const res = await fetch(`${WAHA_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(WAHA_KEY ? { 'X-Api-Key': WAHA_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WAHA ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

// POST /whatsapp/enviar
// Body: { telefono, texto, pdf?: { data: 'base64...', filename?: string } }
router.post('/enviar', async (req, res) => {
  const { telefono, texto, pdf } = req.body;

  if (!telefono || !texto) {
    return res.status(400).json({ error: 'telefono y texto son requeridos' });
  }

  const chatId = formatChatId(telefono);
  res.json({ ok: true, chatId });

  try {
    await wahaPost('/api/sendText', { session: 'default', chatId, text: texto });

    if (pdf?.data) {
      try {
        const token = saveTicket(pdf.data, pdf.filename || 'comprobante.pdf');
        const enlace = `${PUBLIC_URL}/ticket/${token}`;
        const mensajeEnlace = `📥 Descarga tu comprobante aquí (disponible 24 horas):\n${enlace}`;
        await wahaPost('/api/sendText', { session: 'default', chatId, text: mensajeEnlace });
      } catch (linkErr) {
        console.warn('[WhatsApp] No se pudo generar enlace de ticket:', linkErr.message);
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Error enviando mensaje a', chatId, ':', err.message);
  }
});

module.exports = router;
