import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateServicioPDF = (comprobante, farmacia) => {
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
    const tipoComprobante = comprobante.tipo_comprobante === '01' ? 'FACTURA ELECTRÓNICA' : 'Factura Electrónica';
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
    doc.text(comprobante.numero_documento_cliente || '00000000', 40, 56);

    doc.setFont('helvetica', 'bold');
    doc.text('Fecha de Emisión:', 120, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(comprobante.fecha_emision).toLocaleDateString(), 165, 50);

    // --- Items Table ---
    const tableColumn = ["Cant.", "Servicio", "P. Unit.", "Total"];
    const tableRows = [];

    comprobante.items.forEach(item => {
        const itemData = [
            item.cantidad,
            item.descripcion,
            `S/ ${parseFloat(item.precio_unitario).toFixed(2)}`,
            `S/ ${parseFloat(item.total).toFixed(2)}`
        ];
        tableRows.push(itemData);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 65,
        headStyles: {
            fillColor: [99, 102, 241], // Indigo color for services
            textColor: 255
        },
        styles: {
            fontSize: 10,
        },
    });

    // --- Totals ---
    const finalY = doc.lastAutoTable.finalY || 80;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');

    doc.text('Subtotal:', 140, finalY + 10);
    doc.text(`S/ ${parseFloat(comprobante.subtotal).toFixed(2)}`, 170, finalY + 10);

    doc.text('IGV (18%):', 140, finalY + 16);
    doc.text(`S/ ${parseFloat(comprobante.igv).toFixed(2)}`, 170, finalY + 16);

    doc.setFontSize(14);
    doc.text('TOTAL:', 140, finalY + 24);
    doc.text(`S/ ${parseFloat(comprobante.total).toFixed(2)}`, 170, finalY + 24);

    // --- Footer ---
    doc.setFontSize(8);
    doc.text(`Forma de Pago: ${comprobante.forma_pago}`, 14, finalY + 40);
    doc.text(`Comprobante de Servicio Médico - ${tipoComprobante}.`, 14, finalY + 44);

    // --- Save ---
    doc.save(`servicio-${numeroComprobante}.pdf`);
};
