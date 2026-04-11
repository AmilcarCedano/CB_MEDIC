const router = require('express').Router();
const axios = require('axios');

// Endpoint genérico para buscar DNI o RUC
router.get('/search', async (req, res) => {
  const { type, number } = req.query; // Ej: /search?type=DNI&number=12345678

  if (!type || !number) {
    return res.status(400).json({ error: 'Se requiere "type" (DNI/RUC) y "number".' });
  }

  const apiUrl = process.env.RENIEC_API_URL;
  const apiToken = process.env.RENIEC_API_TOKEN;

  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'La URL o el Token de la API de documentos no están configurados en el servidor.' });
  }

  let externalUrl;
  if (type.toUpperCase() === 'DNI') {
    externalUrl = `${apiUrl}/reniec/dni?numero=${number}`;
  } else if (type.toUpperCase() === 'RUC') {
    externalUrl = `${apiUrl}/sunat/ruc?numero=${number}`;
  } else {
    return res.status(400).json({ error: 'El tipo de documento debe ser DNI o RUC.' });
  }

  try {
    const response = await axios.get(externalUrl, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });

    const data = response.data;
    let normalizedData;

    if (type.toUpperCase() === 'DNI') {
      normalizedData = {
        success: true,
        nombreRazon: data.full_name,
        // DNI search does not provide address details
        direccion: '',
        distrito: '',
        provincia: '',
        departamento: '',
      };
    } else { // RUC
      normalizedData = {
        success: true,
        nombreRazon: data.razon_social,
        direccion: data.direccion,
        distrito: data.distrito,
        provincia: data.provincia,
        departamento: data.departamento,
      };
    }

    res.json(normalizedData);

  } catch (err) {
    console.error('Error al consultar API de documentos:', err.message);
    if (err.response) {
      // Si la API externa responde con un error (ej. 404 Not Found)
      return res.status(err.response.status).json({ success: false, error: err.response.data.message || `Documento ${number} no encontrado.` });
    }
    // Otros errores (ej. de red)
    res.status(500).json({ success: false, error: 'Fallo la consulta al servicio de documentos.' });
  }
});

module.exports = router;

