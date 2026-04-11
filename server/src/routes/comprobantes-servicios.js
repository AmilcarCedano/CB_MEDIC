const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../middleware/auth');

// Helper para calcular totales
const calculateTotals = (items) => {
    const igvRate = 0.18;

    const total = items.reduce((sum, item) => sum + parseFloat(item.precioUnitario) * item.cantidad, 0);
    const subtotal = total / (1 + igvRate);
    const igv = total - subtotal;

    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        igv: parseFloat(igv.toFixed(2)),
        total: parseFloat(total.toFixed(2))
    };
};

// GET / - Listar comprobantes de servicios
// Vendedores: solo ven los últimos 20 horas
// Admin: ven todos
router.get('/', async (req, res) => {
    const currentFarmaciaId = req.farmaciaId;
    const userRole = req.userRole;
    const usuarioId = req.userId;

    try {
        // Construir where clause según el rol
        const whereClause = {
            farmaciaId: currentFarmaciaId,
        };

        // Si es vendedor, aplicar filtro de 20 horas y solo sus comprobantes
        if (userRole === 'VENDEDOR') {
            whereClause.usuarioId = usuarioId;
            whereClause.fecha_emision = {
                gte: new Date(Date.now() - 20 * 60 * 60 * 1000), // 20 horas atrás
            };
        }

        const comprobantes = await prisma.comprobanteservicio.findMany({
            where: whereClause,
            include: {
                cliente: true,
                items: {
                    include: {
                        servicio: true
                    }
                }
            },
            orderBy: { fecha_emision: 'desc' }
        });

        res.json(comprobantes);
    } catch (error) {
        console.error('Error fetching comprobantes:', error);
        res.status(500).json({ error: 'Error fetching comprobantes', details: error.message });
    }
});

// GET /:id - Obtener comprobante por ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const comprobante = await prisma.comprobanteservicio.findUnique({
            where: { id: parseInt(id) },
            include: {
                cliente: true,
                items: {
                    include: {
                        servicio: true
                    }
                }
            }
        });

        res.json(comprobante);
    } catch (error) {
        console.error('Error fetching comprobante:', error);
        res.status(500).json({ error: 'Error fetching comprobante', details: error.message });
    }
});

// POST / - Crear comprobante de servicio
router.post('/', async (req, res) => {
    const currentFarmaciaId = req.farmaciaId;
    const currentUsuarioId = req.userId;

    const {
        tipo_comprobante,
        cliente,
        items,
        forma_pago,
        montoRecibido,
        observaciones
    } = req.body;

    try {
        // Validar items
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Debe incluir al menos un servicio' });
        }

        // Calcular totales
        const { subtotal, igv, total } = calculateTotals(items);
        const vuelto = montoRecibido ? parseFloat(montoRecibido) - total : 0;

        // Determinar serie según tipo de comprobante
        let serie = tipo_comprobante === '01' ? 'FS01' : 'BS01'; // FS=Factura Servicio, BS=Boleta Servicio

        // Obtener último número de comprobante
        const ultimoComprobante = await prisma.comprobanteservicio.findFirst({
            where: {
                farmaciaId: currentFarmaciaId,
                tipo_comprobante,
                serie
            },
            orderBy: { numero: 'desc' }
        });

        const numero = ultimoComprobante ? ultimoComprobante.numero + 1 : 1;

        // Crear comprobante en transacción
        const comprobante = await prisma.$transaction(async (tx) => {
            // Crear comprobante
            const nuevoComprobante = await tx.comprobanteservicio.create({
                data: {
                    farmaciaId: currentFarmaciaId,
                    usuarioId: currentUsuarioId,
                    clienteId: cliente.id || null,
                    tipo_comprobante,
                    serie,
                    numero,
                    tipo_documento_cliente: cliente.type_doc,
                    numero_documento_cliente: cliente.numero_doc,
                    nombre_razon_social: cliente.nombre_razon,
                    direccion_cliente: cliente.direccion || '',
                    subtotal,
                    igv,
                    total,
                    forma_pago: forma_pago || 'CONTADO',
                    montoRecibido: montoRecibido ? parseFloat(montoRecibido) : total,
                    vuelto: vuelto > 0 ? vuelto : 0,
                    estado_sunat: 'PENDIENTE',
                    observaciones
                }
            });

            for (const item of items) {
                const itemTotal = parseFloat(item.precioUnitario) * item.cantidad;
                const itemSubtotal = itemTotal / 1.18;
                const itemIgv = itemTotal - itemSubtotal;

                await tx.comprobanteservicioitem.create({
                    data: {
                        comprobanteId: nuevoComprobante.id,
                        servicioId: item.servicioId,
                        codigo_servicio: item.codigoSunat,
                        descripcion: item.nombre,
                        cantidad: item.cantidad,
                        precio_unitario: parseFloat(item.precioUnitario) / 1.18,
                        subtotal: parseFloat(itemSubtotal.toFixed(2)),
                        igv: parseFloat(itemIgv.toFixed(2)),
                        total: parseFloat(itemTotal.toFixed(2))
                    }
                });
            }

            return nuevoComprobante;
        });

        // Obtener comprobante completo
        const comprobanteCompleto = await prisma.comprobanteservicio.findUnique({
            where: { id: comprobante.id },
            include: {
                items: {
                    include: {
                        servicio: true
                    }
                }
            }
        });

        res.json(comprobanteCompleto);
    } catch (error) {
        console.error('Error creating comprobante:', error);
        res.status(500).json({ error: 'Error creating comprobante', details: error.message });
    }
});

// GET /:id/pdf - Generar PDF
router.get('/:id/pdf', async (req, res) => {
    const { id } = req.params;
    const currentFarmaciaId = parseInt(req.farmaciaId);

    try {
        const comprobante = await prisma.comprobanteservicio.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: true,
                farmacia: true
            }
        });

        if (!comprobante || comprobante.farmaciaId !== req.farmaciaId) {
            return res.status(404).json({ error: 'Comprobante no encontrado' });
        }

        // Generar PDF simple (puedes mejorar esto con una librería como pdfkit)
        const pdfContent = `
COMPROBANTE DE SERVICIO
${comprobante.tipo_comprobante === '01' ? 'FACTURA' : 'BOLETA'}
${comprobante.serie}-${String(comprobante.numero).padStart(6, '0')}

Fecha: ${new Date(comprobante.fecha_emision).toLocaleString()}
Cliente: ${comprobante.nombre_razon_social}
Documento: ${comprobante.numero_documento_cliente}

SERVICIOS:
${comprobante.items.map(item =>
            `${item.descripcion} - Cant: ${item.cantidad} - P.U: S/${item.precio_unitario} - Total: S/${item.total}`
        ).join('\n')}

Subtotal: S/${comprobante.subtotal}
IGV (18%): S/${comprobante.igv}
TOTAL: S/${comprobante.total}
        `;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=SERV-${comprobante.serie}-${String(comprobante.numero).padStart(6, '0')}.txt`);
        res.send(pdfContent);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Error generating PDF', details: error.message });
    }
});

// GET /:id/xml - Generar XML
router.get('/:id/xml', async (req, res) => {
    const { id } = req.params;
    const currentFarmaciaId = parseInt(req.farmaciaId);

    try {
        const comprobante = await prisma.comprobanteservicio.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: true,
                farmacia: true
            }
        });

        if (!comprobante || comprobante.farmaciaId !== req.farmaciaId) {
            return res.status(404).json({ error: 'Comprobante no encontrado' });
        }

        // Generar XML UBL 2.1 básico para servicios
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" 
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:ID>${comprobante.serie}-${String(comprobante.numero).padStart(6, '0')}</cbc:ID>
    <cbc:IssueDate>${new Date(comprobante.fecha_emision).toISOString().split('T')[0]}</cbc:IssueDate>
    <cbc:InvoiceTypeCode>${comprobante.tipo_comprobante}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
    
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="6">${comprobante.farmacia.ruc || ''}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${comprobante.farmacia.nombre}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="${comprobante.tipo_documento_cliente === 'DNI' ? '1' : '6'}">${comprobante.numero_documento_cliente}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${comprobante.nombre_razon_social}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="PEN">${comprobante.igv}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="PEN">${comprobante.subtotal}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="PEN">${comprobante.igv}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>18.00</cbc:Percent>
                <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
                <cac:TaxScheme>
                    <cbc:ID>1000</cbc:ID>
                    <cbc:Name>IGV</cbc:Name>
                    <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    
    <cac:LegalMonetaryTotal>
        <cbc:PayableAmount currencyID="PEN">${comprobante.total}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    
    ${comprobante.items.map((item, index) => `
    <cac:InvoiceLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="ZZ">${item.cantidad}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="PEN">${item.subtotal}</cbc:LineExtensionAmount>
        <cac:PricingReference>
            <cac:AlternativeConditionPrice>
                <cbc:PriceAmount currencyID="PEN">${item.total / item.cantidad}</cbc:PriceAmount>
                <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
            </cac:AlternativeConditionPrice>
        </cac:PricingReference>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="PEN">${item.igv}</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="PEN">${item.subtotal}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="PEN">${item.igv}</cbc:TaxAmount>
                <cac:TaxCategory>
                    <cbc:ID>S</cbc:ID>
                    <cbc:Percent>18.00</cbc:Percent>
                    <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
                    <cac:TaxScheme>
                        <cbc:ID>1000</cbc:ID>
                        <cbc:Name>IGV</cbc:Name>
                        <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                    </cac:TaxScheme>
                </cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Description>${item.descripcion}</cbc:Description>
            <cac:SellersItemIdentification>
                <cbc:ID>${item.codigo_servicio}</cbc:ID>
            </cac:SellersItemIdentification>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="PEN">${item.precio_unitario}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>
    `).join('')}
</Invoice>`;

        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename=SERV-${comprobante.serie}-${String(comprobante.numero).padStart(6, '0')}.xml`);
        res.send(xmlContent);
    } catch (error) {
        console.error('Error generating XML:', error);
        res.status(500).json({ error: 'Error generating XML', details: error.message });
    }
});

// POST /:id/cancel - Cancelar comprobante
// Solo ADMIN puede cancelar
router.post('/:id/cancel', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    const currentFarmaciaId = req.farmaciaId;

    // Validar contraseña de administrador desde variable de entorno
    const ADMIN_PASSWORD = process.env.ADMIN_MASTER_PASSWORD;

    if (!ADMIN_PASSWORD) {
        console.error('[CRITICAL] ADMIN_MASTER_PASSWORD no configurado');
        return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    try {
        const comprobante = await prisma.comprobanteservicio.findUnique({
            where: { id: parseInt(id) }
        });

        if (!comprobante || comprobante.farmaciaId !== currentFarmaciaId) {
            return res.status(404).json({ error: 'Comprobante no encontrado' });
        }

        if (comprobante.estado_sunat === 'ANULADO') {
            return res.status(400).json({ error: 'El comprobante ya está anulado' });
        }

        // Actualizar estado a ANULADO
        await prisma.comprobanteservicio.update({
            where: { id: parseInt(id) },
            data: { estado_sunat: 'ANULADO' }
        });

        res.json({ message: 'Comprobante cancelado exitosamente' });
    } catch (error) {
        console.error('Error canceling comprobante:', error);
        res.status(500).json({ error: 'Error canceling comprobante', details: error.message });
    }
});

module.exports = router;

