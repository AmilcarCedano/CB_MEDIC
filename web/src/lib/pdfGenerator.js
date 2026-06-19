import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const getServerUrl = () => {
    const base = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : 'http://localhost:4000';
    // Sin slash final: la URL del logo ('/uploads/...') ya empieza con '/'
    return String(base).replace(/\/+$/, '');
};

/**
 * Carga el logo configurado y lo devuelve como dataURL PNG (vía canvas).
 * Nunca rechaza: si el logo no existe o falla la carga, resuelve null
 * para que la generación del PDF continúe sin logo.
 */
const loadLogoImage = (logoUrl) => new Promise((resolve) => {
    if (!logoUrl || typeof window === 'undefined') return resolve(null);
    try {
        const src = logoUrl.startsWith('http') ? logoUrl : `${getServerUrl()}${logoUrl}`;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const timer = setTimeout(() => resolve(null), 4000);
        img.onload = () => {
            clearTimeout(timer);
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve({
                    dataUrl: canvas.toDataURL('image/png'),
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => { clearTimeout(timer); resolve(null); };
        img.src = src;
    } catch {
        resolve(null);
    }
});

// Paleta de marca (indigo) — usada con moderación en el comprobante fiscal.
const BRAND = [79, 70, 229];      // indigo-600
const BRAND_DARK = [55, 48, 163]; // indigo-800
const INK = [33, 37, 41];         // texto principal
const MUTED = [110, 115, 125];    // texto secundario
const STRIPE = [244, 245, 251];   // fondo alternado de filas
const LINE = [210, 213, 220];     // líneas suaves

const money = (v) => `S/ ${parseFloat(v).toFixed(2)}`;

export const generateComprobantePDF = async (comprobante, farmacia, posConfig) => {
    const logo = await loadLogoImage(posConfig?.comprobanteLogoUrl);

    // El comprobante A4 siempre se genera en horizontal (landscape)
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();   // 297mm aprox.
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;

    // --- Banda superior de marca ---
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageWidth, 3, 'F');

    // --- Header (con logo opcional arriba a la izquierda) ---
    let headerX = marginX;
    if (logo && logo.width > 0 && logo.height > 0) {
        try {
            const logoH = 18;
            const logoW = Math.min(45, (logo.width / logo.height) * logoH);
            doc.addImage(logo.dataUrl, 'PNG', marginX, 12, logoW, logoH);
            headerX = marginX + logoW + 6;
        } catch {
            headerX = marginX; // si jsPDF no puede dibujar el logo, continuar sin él
        }
    }

    doc.setTextColor(...BRAND_DARK);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(farmacia?.nombre || 'Nombre de Farmacia', headerX, 22);

    doc.setTextColor(...MUTED);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(farmacia?.direccion || 'Dirección de la farmacia', headerX, 28);
    doc.text(`RUC: ${farmacia?.ruc || 'RUC de la farmacia'}`, headerX, 34);

    // --- Invoice Box ---
    let tipoComprobante = '';
    if (comprobante.nombre_razon_social?.toUpperCase() === 'PÚBLICO GENERAL' || !comprobante.numero_documento_cliente || comprobante.numero_documento_cliente === '00000000') {
        tipoComprobante = 'NOTA DE VENTA ELECTRÓNICA';
    } else if (comprobante.tipo_documento_cliente === '6' || comprobante.serie?.startsWith('F')) {
        tipoComprobante = 'FACTURA ELECTRÓNICA';
    } else {
        tipoComprobante = 'BOLETA DE VENTA ELECTRÓNICA';
    }

    const numeroComprobante = `${comprobante.serie}-${String(comprobante.numero).padStart(6, '0')}`;

    // Caja del tipo de comprobante, anclada al borde derecho.
    const boxW = 95;
    const boxH = 26;
    const boxX = pageWidth - marginX - boxW;
    const boxY = 12;
    doc.setDrawColor(...BRAND);
    doc.setLineWidth(0.6);
    doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2);
    doc.setLineWidth(0.2);

    const boxCenterX = boxX + boxW / 2;
    doc.setTextColor(...INK);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`R.U.C. ${farmacia?.ruc || 'RUC de la farmacia'}`, boxCenterX, boxY + 7, { align: 'center' });

    // Sub-banda con el tipo de comprobante.
    doc.setFillColor(...BRAND);
    doc.rect(boxX, boxY + 9.5, boxW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9.5);
    doc.text(tipoComprobante, boxCenterX, boxY + 14.3, { align: 'center' });

    doc.setTextColor(...BRAND_DARK);
    doc.setFontSize(13);
    doc.text(numeroComprobante, boxCenterX, boxY + 23, { align: 'center' });

    // --- Datos del cliente (panel izquierdo) ---
    const infoTop = 46;
    let currentY = infoTop;
    doc.setTextColor(...INK);
    doc.setFontSize(11);

    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', marginX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(comprobante.nombre_razon_social || 'Público General', marginX + 24, currentY);

    currentY += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Documento:', marginX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(comprobante.numero_documento_cliente || '00000000', marginX + 24, currentY);

    if (comprobante.direccion_cliente) {
        currentY += 6;
        doc.setFont('helvetica', 'bold');
        doc.text('Dirección:', marginX, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const splitText = doc.splitTextToSize(comprobante.direccion_cliente, 110);
        doc.text(splitText, marginX + 24, currentY);
        doc.setFontSize(11);
        currentY += (splitText.length - 1) * 4;
    }

    // Fecha de emisión (panel derecho, alineada bajo la caja).
    const dateLabelX = boxX;
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha de Emisión:', dateLabelX, infoTop);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(comprobante.fecha_emision).toLocaleDateString(), dateLabelX + 36, infoTop);

    // --- Items Table ---
    const tableColumn = ["Cant.", "Descripción", "P. Unit.", "Total"];
    const tableRows = [];
    let totalPromoSavings = 0;

    comprobante.items.forEach(item => {
        if (item.codigo_producto === 'DESC-PROMO') {
            totalPromoSavings += Math.abs(parseFloat(item.total));
            return;
        }
        const itemData = [
            item.cantidad,
            item.descripcion,
            money(parseFloat(item.total) / parseFloat(item.cantidad)),
            money(item.total)
        ];
        tableRows.push(itemData);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: Math.max(64, currentY + 6),
        margin: { left: marginX, right: marginX },
        theme: 'striped',
        headStyles: {
            fillColor: BRAND,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            fontSize: 10,
            cellPadding: 2.5,
        },
        bodyStyles: {
            textColor: INK,
            fontSize: 9.5,
            cellPadding: 2.2,
        },
        alternateRowStyles: {
            fillColor: STRIPE,
        },
        styles: {
            lineColor: LINE,
            lineWidth: 0.1,
            overflow: 'linebreak',
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 18 },
            1: { halign: 'left' },
            2: { halign: 'right', cellWidth: 32 },
            3: { halign: 'right', cellWidth: 34 },
        },
    });

    // --- Totals ---
    const finalY = doc.lastAutoTable.finalY || 80;

    // Bloque de totales: etiqueta + valor alineados al borde derecho de la tabla.
    const totalsValueX = pageWidth - marginX;
    const totalsLabelX = totalsValueX - 64;
    let currentTotalsY = finalY + 9;

    const drawTotal = (label, value, opts = {}) => {
        const { negative = false, bold = false, size = 10 } = opts;
        doc.setFontSize(size);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setTextColor(...(bold ? BRAND_DARK : INK));
        doc.text(label, totalsLabelX, currentTotalsY);
        const txt = negative ? `- ${money(value)}` : money(value);
        doc.text(txt, totalsValueX, currentTotalsY, { align: 'right' });
    };

    drawTotal('Op. Gravada:', comprobante.subtotal);
    currentTotalsY += 6;

    drawTotal('IGV (18%):', comprobante.igv);
    currentTotalsY += 6;

    if (totalPromoSavings > 0) {
        drawTotal('Descuento Promo:', totalPromoSavings, { negative: true });
        currentTotalsY += 6;
    }

    if (comprobante.descuentoPuntos && parseFloat(comprobante.descuentoPuntos) > 0) {
        drawTotal('Canje Puntos:', parseFloat(comprobante.descuentoPuntos), { negative: true });
        currentTotalsY += 6;
    }

    // Línea separadora antes del total.
    currentTotalsY += 1;
    doc.setDrawColor(...BRAND);
    doc.setLineWidth(0.4);
    doc.line(totalsLabelX, currentTotalsY, totalsValueX, currentTotalsY);
    doc.setLineWidth(0.2);
    currentTotalsY += 7;

    // Total destacado con fondo de marca.
    doc.setFillColor(...BRAND);
    doc.rect(totalsLabelX - 3, currentTotalsY - 5.5, (totalsValueX - totalsLabelX) + 6, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', totalsLabelX, currentTotalsY);
    doc.text(money(comprobante.total), totalsValueX, currentTotalsY, { align: 'right' });

    // --- Footer ---
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const footerY = Math.min(currentTotalsY + 14, pageHeight - 12);
    doc.setDrawColor(...LINE);
    doc.line(marginX, footerY - 5, pageWidth - marginX, footerY - 5);
    doc.text(`Forma de Pago: ${comprobante.forma_pago}`, marginX, footerY);
    doc.text(`Representación impresa de la ${tipoComprobante}.`, marginX, footerY + 4);

    // --- Save ---
    doc.save(`comprobante-${numeroComprobante}.pdf`);
};

export const generateTicketPDF = async (comprobante, farmacia, posConfig) => {
    const logo = await loadLogoImage(posConfig?.comprobanteLogoUrl);

    // 80mm width is ~226.7 points. Height depends on items. Estimated 200mm to start.
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [80, 250] // Ancho 80mm, altura ampliada para evitar cortes
    });

    const width = 80;
    const left = 5;          // margen izquierdo
    const right = 75;        // margen derecho (alineación a la derecha)
    const qtyX = 50;         // columna CANT (centrada)
    let y = 10;

    // Ticket monocromo: forzamos negro para impresoras térmicas.
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);

    // --- Logo (centrado, opcional) ---
    if (logo && logo.width > 0 && logo.height > 0) {
        try {
            const logoH = 14;
            const logoW = Math.min(40, (logo.width / logo.height) * logoH);
            doc.addImage(logo.dataUrl, 'PNG', (width - logoW) / 2, y - 4, logoW, logoH);
            y += logoH + 2;
        } catch { /* continuar sin logo */ }
    }

    // --- Header ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(farmacia?.nombre || 'CBMedic', width / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(farmacia?.direccion || 'Dirección de la farmacia', 70);
    doc.text(addressLines, width / 2, y, { align: 'center' });
    y += (addressLines.length * 4);

    doc.text(`RUC: ${farmacia?.ruc || '12345678901'}`, width / 2, y, { align: 'center' });
    y += 7;

    // --- Invoice Type ---
    let tipoComprobante = '';
    if (comprobante.nombre_razon_social?.toUpperCase() === 'PÚBLICO GENERAL' || !comprobante.numero_documento_cliente || comprobante.numero_documento_cliente === '00000000') {
        tipoComprobante = 'NOTA DE VENTA';
    } else if (comprobante.tipo_documento_cliente === '6' || comprobante.serie?.startsWith('F')) {
        tipoComprobante = 'FACTURA ELECTRÓNICA';
    } else {
        tipoComprobante = 'BOLETA ELECTRÓNICA';
    }
    const numeroComprobante = `${comprobante.serie}-${String(comprobante.numero).padStart(6, '0')}`;

    // Banda con el tipo de comprobante (recuadro en negro, texto centrado).
    doc.setLineWidth(0.3);
    doc.rect(left, y - 4, right - left, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(tipoComprobante, width / 2, y, { align: 'center' });
    doc.setFontSize(9);
    doc.text(numeroComprobante, width / 2, y + 4.5, { align: 'center' });
    y += 12;

    // --- Client Info ---
    const labelValue = (label, value, maxWidth) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, left, y);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(String(value), maxWidth);
        doc.text(lines, left + 16, y);
        y += Math.max(4, lines.length * 4);
    };

    doc.setFontSize(8);
    labelValue('CLIENTE:', comprobante.nombre_razon_social || 'PÚBLICO GENERAL', 54);
    labelValue('DOC:', comprobante.numero_documento_cliente || '00000000', 54);
    labelValue('FECHA:', new Date(comprobante.fecha_emision).toLocaleString(), 54);
    y += 2;

    // --- Line Separator (punteado para look de ticket) ---
    const dashedLine = () => {
        doc.setLineDashPattern([0.6, 0.6], 0);
        doc.line(left, y, right, y);
        doc.setLineDashPattern([], 0);
    };
    dashedLine();
    y += 4;

    // --- Items header ---
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN', left, y);
    doc.text('CANT', qtyX, y, { align: 'center' });
    doc.text('TOTAL', right, y, { align: 'right' });
    y += 1.5;
    doc.setLineWidth(0.2);
    doc.line(left, y, right, y);
    y += 4;
    doc.setFont('helvetica', 'normal');

    let totalPromoSavings = 0;
    (comprobante.items || []).forEach(item => {
        if (item.codigo_producto === 'DESC-PROMO') {
            totalPromoSavings += Math.abs(parseFloat(item.total));
            return;
        }

        const descLines = doc.splitTextToSize(item.descripcion, 40);
        const rowH = descLines.length * 4;
        doc.text(descLines, left, y);
        // CANT y TOTAL alineados a la primera línea de la descripción.
        doc.text(String(item.cantidad), qtyX, y, { align: 'center' });
        doc.text(money(item.total), right, y, { align: 'right' });
        y += rowH;
    });

    y += 2;
    dashedLine();
    y += 6;

    // --- Totals ---
    const drawTotalLine = (label, value, isBold = false) => {
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.text(label, qtyX - 5, y, { align: 'right' });
        doc.text(money(value), right, y, { align: 'right' });
        y += 5;
    };

    drawTotalLine('OP. GRAV:', comprobante.subtotal);
    drawTotalLine('IGV:', comprobante.igv);

    if (totalPromoSavings > 0) {
        drawTotalLine('DESC. PROMO:', -totalPromoSavings);
    }

    if (comprobante.descuentoPuntos && parseFloat(comprobante.descuentoPuntos) > 0) {
        drawTotalLine('PUNTOS:', -parseFloat(comprobante.descuentoPuntos));
    }

    // Total destacado entre dos líneas.
    y += 1;
    doc.setLineWidth(0.3);
    doc.line(left, y, right, y);
    y += 5;
    doc.setFontSize(12);
    drawTotalLine('TOTAL:', comprobante.total, true);
    doc.setFontSize(8);
    y += 0.5;
    doc.line(left, y, right, y);
    y += 4;

    // Forma de pago.
    doc.setFont('helvetica', 'normal');
    doc.text(`Forma de Pago: ${comprobante.forma_pago}`, left, y);
    y += 6;

    // --- Footer ---
    y += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('¡Gracias por su compra!', width / 2, y, { align: 'center' });
    y += 4;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('CBMedic - Sistema Farmacéutico', width / 2, y, { align: 'center' });

    // --- Save/Open ---
    const fileName = `ticket-${numeroComprobante}.pdf`;

    // Para descarga automática usamos output('bloburl') o save()
    // Si queremos visualizarlo usamos windows.open(doc.output('bloburl'))
    doc.save(fileName);
};

// Genera el mismo ticket pero retorna el base64 del PDF (sin descargarlo).
// Usado para enviar por WhatsApp. No lanza — retorna null si falla.
export const getTicketBase64 = async (comprobante, farmacia, posConfig) => {
    try {
        const logo = await loadLogoImage(posConfig?.comprobanteLogoUrl);

        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [80, 250] });

        const width = 80;
        const left = 5;
        const right = 75;
        const qtyX = 50;
        let y = 10;

        doc.setTextColor(0, 0, 0);
        doc.setDrawColor(0, 0, 0);

        if (logo && logo.width > 0 && logo.height > 0) {
            try {
                const logoH = 14;
                const logoW = Math.min(40, (logo.width / logo.height) * logoH);
                doc.addImage(logo.dataUrl, 'PNG', (width - logoW) / 2, y - 4, logoW, logoH);
                y += logoH + 2;
            } catch { /* sin logo */ }
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(farmacia?.nombre || 'CBMedic', width / 2, y, { align: 'center' });
        y += 6;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const addressLines = doc.splitTextToSize(farmacia?.direccion || '', 70);
        doc.text(addressLines, width / 2, y, { align: 'center' });
        y += (addressLines.length * 4);
        doc.text(`RUC: ${farmacia?.ruc || ''}`, width / 2, y, { align: 'center' });
        y += 7;

        let tipoComprobante = '';
        if (!comprobante.numero_documento_cliente || comprobante.numero_documento_cliente === '00000000') {
            tipoComprobante = 'NOTA DE VENTA';
        } else if (comprobante.tipo_documento_cliente === '6' || comprobante.serie?.startsWith('F')) {
            tipoComprobante = 'FACTURA ELECTRÓNICA';
        } else {
            tipoComprobante = 'BOLETA ELECTRÓNICA';
        }
        const numeroComprobante = `${comprobante.serie}-${String(comprobante.numero).padStart(6, '0')}`;

        doc.setLineWidth(0.3);
        doc.rect(left, y - 4, right - left, 11);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(tipoComprobante, width / 2, y, { align: 'center' });
        doc.setFontSize(9);
        doc.text(numeroComprobante, width / 2, y + 4.5, { align: 'center' });
        y += 12;

        const labelValue = (label, value, maxWidth) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, left, y);
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(String(value), maxWidth);
            doc.text(lines, left + 16, y);
            y += Math.max(4, lines.length * 4);
        };

        doc.setFontSize(8);
        labelValue('CLIENTE:', comprobante.nombre_razon_social || 'PÚBLICO GENERAL', 54);
        labelValue('DOC:', comprobante.numero_documento_cliente || '00000000', 54);
        labelValue('FECHA:', new Date(comprobante.fecha_emision).toLocaleString(), 54);
        y += 2;

        const dashedLine = () => {
            doc.setLineDashPattern([0.6, 0.6], 0);
            doc.line(left, y, right, y);
            doc.setLineDashPattern([], 0);
        };
        dashedLine();
        y += 4;

        doc.setFont('helvetica', 'bold');
        doc.text('DESCRIPCIÓN', left, y);
        doc.text('CANT', qtyX, y, { align: 'center' });
        doc.text('TOTAL', right, y, { align: 'right' });
        y += 1.5;
        doc.setLineWidth(0.2);
        doc.line(left, y, right, y);
        y += 4;
        doc.setFont('helvetica', 'normal');

        const money = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;
        let totalPromoSavings = 0;
        (comprobante.items || []).forEach(item => {
            if (item.codigo_producto === 'DESC-PROMO') {
                totalPromoSavings += Math.abs(parseFloat(item.total));
                return;
            }
            const descLines = doc.splitTextToSize(item.descripcion, 40);
            doc.text(descLines, left, y);
            doc.text(String(item.cantidad), qtyX, y, { align: 'center' });
            doc.text(money(item.total), right, y, { align: 'right' });
            y += descLines.length * 4;
        });

        y += 2;
        dashedLine();
        y += 6;

        const drawTotalLine = (label, value, isBold = false) => {
            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
            doc.text(label, qtyX - 5, y, { align: 'right' });
            doc.text(money(value), right, y, { align: 'right' });
            y += 5;
        };

        drawTotalLine('OP. GRAV:', comprobante.subtotal);
        drawTotalLine('IGV:', comprobante.igv);
        if (totalPromoSavings > 0) drawTotalLine('DESC. PROMO:', -totalPromoSavings);
        if (comprobante.descuentoPuntos && parseFloat(comprobante.descuentoPuntos) > 0) {
            drawTotalLine('PUNTOS:', -parseFloat(comprobante.descuentoPuntos));
        }

        y += 1;
        doc.setLineWidth(0.3);
        doc.line(left, y, right, y);
        y += 5;
        doc.setFontSize(12);
        drawTotalLine('TOTAL:', comprobante.total, true);
        doc.setFontSize(8);
        y += 0.5;
        doc.line(left, y, right, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        doc.text(`Forma de Pago: ${comprobante.forma_pago}`, left, y);
        y += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('¡Gracias por su compra!', width / 2, y, { align: 'center' });
        y += 4;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text('CBMedic - Sistema Farmacéutico', width / 2, y, { align: 'center' });

        return {
            data: doc.output('datauristring'),
            filename: `ticket-${numeroComprobante}.pdf`,
        };
    } catch (err) {
        console.error('[getTicketBase64] Error generando PDF:', err);
        return null;
    }
};
