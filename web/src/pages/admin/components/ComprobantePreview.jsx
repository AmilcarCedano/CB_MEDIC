import React from 'react';

export default function ComprobantePreview({ comprobante, farmacia }) {
    if (!comprobante) return null;

    const {
        serie,
        numero,
        fecha_emision,
        cliente,
        items,
        subtotal,
        igv,
        total,
        forma_pago
    } = comprobante;

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl mx-auto my-4 text-gray-800">
            <div className="grid grid-cols-2 gap-4 border-b pb-6 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{farmacia?.nombre || 'Nombre de Farmacia'}</h1>
                    <p className="text-sm">{farmacia?.direccion || 'Dirección de la farmacia'}</p>
                    <p className="text-sm">RUC: {farmacia?.ruc || 'RUC de la farmacia'}</p>
                </div>
                <div className="text-right border border-gray-400 p-4 rounded-lg">
                    <h2 className="text-xl font-bold">R.U.C. {farmacia?.ruc || 'RUC de la farmacia'}</h2>
                    <h3 className="text-lg font-semibold">{comprobante.tipo_comprobante === '01' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}</h3>
                    <p className="text-lg font-bold">{serie}-{String(numero).padStart(6, '0')}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                    <h4 className="font-bold mb-2">Cliente:</h4>
                    <p>{cliente?.nombreRazon || 'Público General'}</p>
                    <p>{cliente?.tipoDoc}: {cliente?.numeroDoc || '00000000'}</p>
                    <p>{cliente?.direccion || ''}</p>
                </div>
                <div className="text-right">
                    <p><strong>Fecha de Emisión:</strong> {new Date(fecha_emision).toLocaleDateString()}</p>
                    <p><strong>Moneda:</strong> {comprobante.moneda}</p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 text-left font-bold">Cant.</th>
                            <th className="p-2 text-left font-bold">Descripción</th>
                            <th className="p-2 text-right font-bold">P. Unit.</th>
                            <th className="p-2 text-right font-bold">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => (
                            <tr key={item.id} className="border-b">
                                <td className="p-2">{item.cantidad}</td>
                                <td className="p-2">{item.descripcion}</td>
                                <td className="p-2 text-right">S/ {parseFloat(item.precio_unitario).toFixed(2)}</td>
                                <td className="p-2 text-right">S/ {parseFloat(item.total).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end mt-6">
                <div className="w-full max-w-xs space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="font-bold">Subtotal:</span>
                        <span>S/ {parseFloat(subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold">IGV (18%):</span>
                        <span>S/ {parseFloat(igv).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                        <span>TOTAL:</span>
                        <span>S/ {parseFloat(total).toFixed(2)}</span>
                    </div>
                </div>
            </div>
            
            <div className="text-center mt-6 text-xs text-gray-500">
                <p>Forma de Pago: {forma_pago}</p>
                <p>Representación impresa de la {comprobante.tipo_comprobante === '01' ? 'Factura Electrónica' : 'Boleta de Venta Electrónica'}.</p>
            </div>
        </div>
    );
}
