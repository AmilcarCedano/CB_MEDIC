import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateComprobantePDF = (comprobante, farmacia) => {
    const doc = new jsPDF();

    // --- Header ---
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(farmacia?.nombre || 'Nombre de Farmacia', 14, 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(farmacia?.direccion || 'Dirección de la farmacia', 14, 28);
    doc.text(`RUC: ${farmacia?.ruc || 'RUC de la farmacia'}`, 14, 34);

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
    
    doc.rect(105, 15, 90, 25); // Box around the invoice details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`R.U.C. ${farmacia?.ruc || 'RUC de la farmacia'}`, 110, 22);
    doc.text(tipoComprobante, 110, 29);
    doc.text(numeroComprobante, 110, 36);

    // --- Client Info ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', 14, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(comprobante.nombre_razon_social || 'Público General', 35, 50);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Documento:', 14, 56);
    doc.setFont('helvetica', 'normal');
    doc.setFont('helvetica', 'normal');
    doc.text(comprobante.numero_documento_cliente || '00000000', 40, 56);

    let currentY = 56;
    if (comprobante.direccion_cliente) {
        currentY += 6;
        doc.setFont('helvetica', 'bold');
        doc.text('Dirección:', 14, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const splitText = doc.splitTextToSize(comprobante.direccion_cliente, 90);
        doc.text(splitText, 35, currentY);
        doc.setFontSize(12);
        
        currentY += splitText.length * 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Fecha de Emisión:', 120, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(comprobante.fecha_emision).toLocaleDateString(), 165, 50);

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
            `S/ ${(parseFloat(item.total) / parseFloat(item.cantidad)).toFixed(2)}`,
            `S/ ${parseFloat(item.total).toFixed(2)}`
        ];
        tableRows.push(itemData);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: Math.max(65, currentY + 5),
        headStyles: {
            fillColor: [230, 230, 230],
            textColor: 40
        },
        styles: {
            fontSize: 10,
        },
    });

    // --- Totals ---
    const finalY = doc.lastAutoTable.finalY || 80;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    let currentTotalsY = finalY + 10;

    doc.text('Op. Gravada:', 140, currentTotalsY);
    doc.text(`S/ ${parseFloat(comprobante.subtotal).toFixed(2)}`, 190, currentTotalsY, { align: 'right' });
    currentTotalsY += 6;

    doc.text('IGV (18%):', 140, currentTotalsY);
    doc.text(`S/ ${parseFloat(comprobante.igv).toFixed(2)}`, 190, currentTotalsY, { align: 'right' });
    currentTotalsY += 6;

    if (totalPromoSavings > 0) {
        doc.text('Descuento Promo:', 140, currentTotalsY);
        doc.text(`- S/ ${totalPromoSavings.toFixed(2)}`, 190, currentTotalsY, { align: 'right' });
        currentTotalsY += 6;
    }

    if (comprobante.descuentoPuntos && parseFloat(comprobante.descuentoPuntos) > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Canje Puntos:', 140, currentTotalsY);
        doc.text(`- S/ ${parseFloat(comprobante.descuentoPuntos).toFixed(2)}`, 190, currentTotalsY, { align: 'right' });
        currentTotalsY += 8;
    }
    
    doc.setFontSize(14);
    doc.text('TOTAL:', 140, currentTotalsY);
    doc.text(`S/ ${parseFloat(comprobante.total).toFixed(2)}`, 190, currentTotalsY, { align: 'right' });

    // --- Footer ---
    doc.setFontSize(8);
    currentTotalsY += 15;
    doc.text(`Forma de Pago: ${comprobante.forma_pago}`, 14, currentTotalsY);
    doc.text(`Representación impresa de la ${tipoComprobante}.`, 14, currentTotalsY + 4);

    // --- Save ---
    doc.save(`comprobante-${numeroComprobante}.pdf`);
};

export const generateTicketPDF = (comprobante, farmacia) => {
    // 80mm width is ~226.7 points. Height depends on items. Estimated 200mm to start.
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [80, 250] // Ancho 80mm, altura ampliada para evitar cortes
    });

    const width = 80;
    let y = 10;

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
    y += 8;

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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(tipoComprobante, width / 2, y, { align: 'center' });
    y += 5;
    doc.text(numeroComprobante, width / 2, y, { align: 'center' });
    y += 8;

    // --- Client Info ---
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE:', 5, y);
    doc.setFont('helvetica', 'normal');
    doc.text(comprobante.nombre_razon_social || 'PÚBLICO GENERAL', 20, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('DOC:', 5, y);
    doc.setFont('helvetica', 'normal');
    doc.text(comprobante.numero_documento_cliente || '00000000', 20, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('FECHA:', 5, y);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(comprobante.fecha_emision).toLocaleString(), 20, y);
    y += 6;

    // --- Line Separator ---
    doc.line(5, y, 75, y);
    y += 4;

    // --- Items ---
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN', 5, y);
    doc.text('CANT', 45, y);
    doc.text('TOTAL', 75, y, { align: 'right' });
    y += 4;
    doc.setFont('helvetica', 'normal');

    let totalPromoSavings = 0;
    (comprobante.items || []).forEach(item => {
        if (item.codigo_producto === 'DESC-PROMO') {
            totalPromoSavings += Math.abs(parseFloat(item.total));
            return;
        }

        const descLines = doc.splitTextToSize(item.descripcion, 40);
        doc.text(descLines, 5, y);
        doc.text(String(item.cantidad), 45, y);
        doc.text(`S/ ${parseFloat(item.total).toFixed(2)}`, 75, y, { align: 'right' });
        y += (descLines.length * 4);
    });

    y += 2;
    doc.line(5, y, 75, y);
    y += 6;

    // --- Totals ---
    const drawTotalLine = (label, value, isBold = false) => {
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.text(label, 45, y);
        doc.text(`S/ ${parseFloat(value).toFixed(2)}`, 75, y, { align: 'right' });
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

    y += 2;
    doc.setFontSize(11);
    drawTotalLine('TOTAL:', comprobante.total, true);

    // --- Footer ---
    y += 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Gracias por su compra', width / 2, y, { align: 'center' });
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text('CBMedic - Sistema Farmacéutico', width / 2, y, { align: 'center' });

    // --- Save/Open ---
    const fileName = `ticket-${numeroComprobante}.pdf`;
    
    // Para descarga automática usamos output('bloburl') o save()
    // Si queremos visualizarlo usamos windows.open(doc.output('bloburl'))
    doc.save(fileName);
};
