const express = require('express');
const router = express.Router();

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';
const WAHA_KEY = process.env.WAHA_API_KEY || '';

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

// POST /api/whatsapp/enviar
// Body: { telefono, texto, pdf?: { data: 'base64...', filename?: string } }
// Siempre responde 200 — los errores de WAHA son aislados y no afectan al caller.
router.post('/enviar', async (req, res) => {
  const { telefono, texto, pdf } = req.body;

  if (!telefono || !texto) {
    return res.status(400).json({ error: 'telefono y texto son requeridos' });
  }

  // Responder inmediatamente — el envío ocurre en background
  const chatId = formatChatId(telefono);
  res.json({ ok: true, chatId });

  try {
    await wahaPost('/api/sendText', {
      session: 'default',
      chatId,
      text: texto,
    });

    if (pdf?.data) {
      const rawBase64 = pdf.data.replace(/^data:[^;]+;base64,/, '');
      await wahaPost('/api/sendFile', {
        session: 'default',
        chatId,
        file: {
          mimetype: 'application/pdf',
          filename: pdf.filename || 'comprobante.pdf',
          data: rawBase64,
        },
        caption: '',
      });
    }
  } catch (err) {
    console.error('[WhatsApp] Error enviando mensaje a', chatId, ':', err.message);
  }
});

module.exports = router;
