const escapeXML = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>&'\"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

export const generateComprobanteXML = (comprobante, farmacia) => {
    const numeroComprobante = `${comprobante.serie}-${String(comprobante.numero).padStart(6, '0')}`;
    const fechaEmision = new Date(comprobante.fecha_emision).toISOString().split('T')[0];
    const tipoComprobante = comprobante.tipo_comprobante; // '01' for Factura, '03' for Boleta
    const clienteTipoDoc = comprobante.tipo_documento_cliente === '6' ? '6' : '1';

    let xml = [];
    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">');
    xml.push('    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
    xml.push('    <cbc:CustomizationID>2.0</cbc:CustomizationID>');
    xml.push(`    <cbc:ID>${numeroComprobante}</cbc:ID>`);
    xml.push(`    <cbc:IssueDate>${fechaEmision}</cbc:IssueDate>`);
    xml.push(`    <cbc:InvoiceTypeCode listID="0101">${tipoComprobante}</cbc:InvoiceTypeCode>`);
    xml.push('    <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>');
    
    xml.push('    <cac:Signature>');
    xml.push(`        <cbc:ID>${farmacia.ruc}</cbc:ID>`);
    xml.push('        <cac:SignatoryParty>');
    xml.push('            <cac:PartyIdentification>');
    xml.push(`                <cbc:ID schemeID="6">${farmacia.ruc}</cbc:ID>`);
    xml.push('            </cac:PartyIdentification>');
    xml.push('            <cac:PartyName>');
    xml.push(`                <cbc:Name><![CDATA[${escapeXML(farmacia.nombre)}]]></cbc:Name>`);
    xml.push('            </cac:PartyName>');
    xml.push('        </cac:SignatoryParty>');
    xml.push('        <cac:DigitalSignatureAttachment>');
    xml.push('            <cac:ExternalReference>');
    xml.push('                <cbc:URI>#SIGN-HERE</cbc:URI>');
    xml.push('            </cac:ExternalReference>');
    xml.push('        </cac:DigitalSignatureAttachment>');
    xml.push('    </cac:Signature>');

    xml.push('    <cac:AccountingSupplierParty>');
    xml.push('        <cac:Party>');
    xml.push('            <cac:PartyIdentification>');
    xml.push(`                <cbc:ID schemeID="6">${farmacia.ruc}</cbc:ID>`);
    xml.push('            </cac:PartyIdentification>');
    xml.push('            <cac:PartyName>');
    xml.push(`                <cbc:Name><![CDATA[${escapeXML(farmacia.nombre)}]]></cbc:Name>`);
    xml.push('            </cac:PartyName>');
    xml.push('            <cac:PartyLegalEntity>');
    xml.push(`                <cbc:RegistrationName><![CDATA[${escapeXML(farmacia.nombre)}]]></cbc:RegistrationName>`);
    xml.push('                <cac:RegistrationAddress>');
    xml.push('                    <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>');
    xml.push('                    <cac:AddressLine>');
    xml.push(`                        <cbc:Line><![CDATA[${escapeXML(farmacia.direccion)}]]></cbc:Line>`);
    xml.push('                    </cac:AddressLine>');
    xml.push('                </cac:RegistrationAddress>');
    xml.push('            </cac:PartyLegalEntity>');
    xml.push('        </cac:Party>');
    xml.push('    </cac:AccountingSupplierParty>');

    xml.push('    <cac:AccountingCustomerParty>');
    xml.push('        <cac:Party>');
    xml.push('            <cac:PartyIdentification>');
    xml.push(`                <cbc:ID schemeID="${clienteTipoDoc}">${escapeXML(comprobante.numero_documento_cliente)}</cbc:ID>`);
    xml.push('            </cac:PartyIdentification>');
    xml.push('            <cac:PartyLegalEntity>');
    xml.push(`                <cbc:RegistrationName><![CDATA[${escapeXML(comprobante.nombre_razon_social)}]]></cbc:RegistrationName>`);
    xml.push('            </cac:PartyLegalEntity>');
    xml.push('        </cac:Party>');
    xml.push('    </cac:AccountingCustomerParty>');

    xml.push('    <cac:TaxTotal>');
    xml.push(`        <cbc:TaxAmount currencyID="PEN">${parseFloat(comprobante.igv).toFixed(2)}</cbc:TaxAmount>`);
    xml.push('        <cac:TaxSubtotal>');
    xml.push(`            <cbc:TaxableAmount currencyID="PEN">${parseFloat(comprobante.subtotal).toFixed(2)}</cbc:TaxableAmount>`);
    xml.push(`            <cbc:TaxAmount currencyID="PEN">${parseFloat(comprobante.igv).toFixed(2)}</cbc:TaxAmount>`);
    xml.push('            <cac:TaxCategory>');
    xml.push('                <cac:TaxScheme>');
    xml.push('                    <cbc:ID>1000</cbc:ID>');
    xml.push('                    <cbc:Name>IGV</cbc:Name>');
    xml.push('                    <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>');
    xml.push('                </cac:TaxScheme>');
    xml.push('            </cac:TaxCategory>');
    xml.push('        </cac:TaxSubtotal>');
    xml.push('    </cac:TaxTotal>');

    xml.push('    <cac:LegalMonetaryTotal>');
    xml.push(`        <cbc:LineExtensionAmount currencyID="PEN">${parseFloat(comprobante.subtotal).toFixed(2)}</cbc:LineExtensionAmount>`);
    xml.push(`        <cbc:TaxInclusiveAmount currencyID="PEN">${parseFloat(comprobante.total).toFixed(2)}</cbc:TaxInclusiveAmount>`);
    xml.push(`        <cbc:PayableAmount currencyID="PEN">${parseFloat(comprobante.total).toFixed(2)}</cbc:PayableAmount>`);
    xml.push('    </cac:LegalMonetaryTotal>');

    comprobante.items.forEach((item, index) => {
        xml.push('    <cac:InvoiceLine>');
        xml.push(`        <cbc:ID>${index + 1}</cbc:ID>`);
        xml.push(`        <cbc:InvoicedQuantity unitCode="NIU">${item.cantidad}</cbc:InvoicedQuantity>`);
        xml.push(`        <cbc:LineExtensionAmount currencyID="PEN">${parseFloat(item.subtotal).toFixed(2)}</cbc:LineExtensionAmount>`);
        xml.push('        <cac:PricingReference>');
        xml.push('            <cac:AlternativeConditionPrice>');
        xml.push(`                <cbc:PriceAmount currencyID="PEN">${(parseFloat(item.total) / item.cantidad).toFixed(2)}</cbc:PriceAmount>`);
        xml.push('                <cbc:PriceTypeCode>01</cbc:PriceTypeCode>');
        xml.push('            </cac:AlternativeConditionPrice>');
        xml.push('        </cac:PricingReference>');
        xml.push('        <cac:TaxTotal>');
        xml.push(`            <cbc:TaxAmount currencyID="PEN">${parseFloat(item.igv).toFixed(2)}</cbc:TaxAmount>`);
        xml.push('            <cac:TaxSubtotal>');
        xml.push(`                <cbc:TaxableAmount currencyID="PEN">${parseFloat(item.subtotal).toFixed(2)}</cbc:TaxableAmount>`);
        xml.push(`                <cbc:TaxAmount currencyID="PEN">${parseFloat(item.igv).toFixed(2)}</cbc:TaxAmount>`);
        xml.push('                <cac:TaxCategory>');
        xml.push('                    <cbc:Percent>18.00</cbc:Percent>');
        xml.push('                    <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>');
        xml.push('                    <cac:TaxScheme>');
        xml.push('                        <cbc:ID>1000</cbc:ID>');
        xml.push('                        <cbc:Name>IGV</cbc:Name>');
        xml.push('                        <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>');
        xml.push('                    </cac:TaxScheme>');
        xml.push('                </cac:TaxCategory>');
        xml.push('            </cac:TaxSubtotal>');
        xml.push('        </cac:TaxTotal>');
        xml.push('        <cac:Item>');
        xml.push(`            <cbc:Description><![CDATA[${escapeXML(item.descripcion)}]]></cbc:Description>`);
        xml.push('            <cac:SellersItemIdentification>');
        xml.push(`                <cbc:ID>${item.productoId}</cbc:ID>`);
        xml.push('            </cac:SellersItemIdentification>');
        xml.push('        </cac:Item>');
        xml.push('        <cac:Price>');
        xml.push(`            <cbc:PriceAmount currencyID="PEN">${parseFloat(item.precio_unitario).toFixed(2)}</cbc:PriceAmount>`);
        xml.push('        </cac:Price>');
        xml.push('    </cac:InvoiceLine>');
    });
    
    xml.push('</Invoice>');

    const xmlString = xml.join('\n');

    // Create a blob and trigger download
    const blob = new Blob([xmlString], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${farmacia.ruc}-${tipoComprobante}-${numeroComprobante}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};