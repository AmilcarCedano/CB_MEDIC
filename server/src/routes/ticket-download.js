const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
        const token = f.replace('.meta.json', '');
        fs.rmSync(path.join(TICKETS_DIR, `${token}.pdf`), { force: true });
        fs.rmSync(path.join(TICKETS_DIR, f), { force: true });
      }
    }
  } catch { /* no crítico */ }
}

// Guarda PDF base64 y devuelve token de acceso seguro
function saveTicket(base64Data, filename) {
  ensureDir();
  sweepExpired();
  const token = crypto.randomBytes(32).toString('hex');
  const rawBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  fs.writeFileSync(path.join(TICKETS_DIR, `${token}.pdf`), Buffer.from(rawBase64, 'base64'));
  fs.writeFileSync(path.join(TICKETS_DIR, `${token}.meta.json`), JSON.stringify({
    filename: filename || 'comprobante.pdf',
    expiresAt: Date.now() + TICKET_TTL_MS,
    createdAt: Date.now(),
  }));
  return token;
}

// GET /ticket/:token  — público, sin auth, enlace temporal
router.get('/:token', (req, res) => {
  const { token } = req.params;
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).send('Enlace inválido.');

  const metaPath = path.join(TICKETS_DIR, `${token}.meta.json`);
  const pdfPath = path.join(TICKETS_DIR, `${token}.pdf`);

  if (!fs.existsSync(metaPath) || !fs.existsSync(pdfPath)) {
    return res.status(404).send('Enlace no encontrado o expirado.');
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (Date.now() > meta.expiresAt) {
    fs.rmSync(pdfPath, { force: true });
    fs.rmSync(metaPath, { force: true });
    return res.status(410).send('Este enlace ha expirado (válido 24 horas).');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${meta.filename}"`);
  res.sendFile(pdfPath);
});

module.exports = { router, saveTicket };
