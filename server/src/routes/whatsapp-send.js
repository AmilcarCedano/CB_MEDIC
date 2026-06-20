const express = require('express');
const router = express.Router();
const { createTicketToken } = require('./ticket-download');

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
// Body: { telefono, texto, comprobanteId?: number }
router.post('/enviar', async (req, res) => {
  const { telefono, texto, comprobanteId } = req.body;

  if (!telefono || !texto) {
    return res.status(400).json({ error: 'telefono y texto son requeridos' });
  }

  const chatId = formatChatId(telefono);
  res.json({ ok: true, chatId });

  try {
    await wahaPost('/api/sendText', { session: 'default', chatId, text: texto });

    if (comprobanteId) {
      try {
        const token = createTicketToken(Number(comprobanteId));
        const enlace = `${PUBLIC_URL}/ticket/${token}`;
        const mensajeEnlace = `📥 Descarga tu comprobante aquí (disponible 24 horas):\n${enlace}`;
        await wahaPost('/api/sendText', { session: 'default', chatId, text: mensajeEnlace });
        console.log('[WhatsApp] Link ticket enviado a', chatId, '→', enlace);
      } catch (linkErr) {
        console.warn('[WhatsApp] No se pudo enviar link de ticket a', chatId, ':', linkErr.message);
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Error enviando mensaje a', chatId, ':', err.message);
  }
});

module.exports = router;
