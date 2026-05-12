const router = require('express').Router();
const https = require('https');
const fs = require('fs');
const path = require('path');

const getApiToken = () => {
  try {
    const configPath = path.join(__dirname, '../../../reniec_config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.apiToken) return config.apiToken;
    }
  } catch (e) { /* Ignorar */ }
  return process.env.RENIEC_API_TOKEN;
};

function httpsGet(urlStr, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          reject(new Error(`Respuesta no-JSON status=${res.statusCode}: ${body.substring(0, 120)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(new Error('TIMEOUT')); });
    req.end();
  });
}

// GET /reniec/search?type=DNI&number=72634612
// GET /reniec/search?type=RUC&number=20538856674
router.get('/search', async (req, res) => {
  const { type, number } = req.query;

  if (!type || !number) {
    // Devolver 200 con success:false para que el frontend no explote en catch
    return res.json({ success: false, error: 'Se requiere "type" (DNI/RUC) y "number".' });
  }

  const apiToken = getApiToken();
  const typeUpper = type.toUpperCase();
  console.log(`[RENIEC] ${typeUpper} ${number} | token ok: ${!!apiToken && apiToken !== 'coloca_tu_token'}`);

  if (!apiToken || apiToken === 'coloca_tu_token') {
    return res.json({
      success: false,
      error: 'API Key no configurada. Ve a Ajustes del Sistema → API de Consulta DNI/RUC.'
    });
  }

  const BASE = 'https://api-codart.cgrt.org/api/v1/consultas';
  let externalUrl;
  if (typeUpper === 'DNI') {
    externalUrl = `${BASE}/reniec/dni/${number}`;
  } else if (typeUpper === 'RUC') {
    externalUrl = `${BASE}/sunat/ruc/${number}`;
  } else {
    return res.json({ success: false, error: 'Tipo de documento inválido. Use DNI o RUC.' });
  }

  try {
    console.log(`[RENIEC] GET ${externalUrl}`);
    const { status, data } = await httpsGet(externalUrl, apiToken);
    console.log(`[RENIEC] Resp: status=${status} success=${data?.success}`);

    if (!data.success) {
      const errMsg = data?.message || data?.error || `Documento ${number} no encontrado en el servicio externo.`;
      console.log(`[RENIEC] No encontrado: ${errMsg}`);
      return res.json({ success: false, error: errMsg });
    }

    let result;
    if (typeUpper === 'DNI') {
      const r = data.result || {};
      const nombre = r.full_name ||
        [r.first_name, r.first_last_name, r.second_last_name].filter(Boolean).join(' ').trim();
      result = {
        success: true,
        nombreRazon: nombre,
        direccion: r.address || '',
        distrito: r.district || '',
        provincia: r.province || '',
        departamento: r.department || '',
        ubigeo: ''
      };
    } else {
      const r = data.result || {};
      result = {
        success: true,
        nombreRazon: r.razon_social || '',
        direccion: r.direccion || '',
        distrito: r.distrito || '',
        provincia: r.provincia || '',
        departamento: r.departamento || '',
        ubigeo: r.ubigeo || ''
      };
    }

    console.log(`[RENIEC] OK → ${result.nombreRazon}`);
    return res.json(result);

  } catch (err) {
    console.error('[RENIEC] Error interno:', err.message);
    const msg = err.message === 'TIMEOUT'
      ? 'Timeout al consultar el servicio. Intenta nuevamente.'
      : 'Error al conectar con el servicio de consulta.';
    return res.json({ success: false, error: msg });
  }
});

module.exports = router;
