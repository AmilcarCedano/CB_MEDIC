import React from 'react';
import { X, FileText, User, Calendar, DollarSign, Package, Award } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const statusStyles = {
        PENDIENTE: 'bg-yellow-100 text-yellow-800',
        ACEPTADO: 'bg-green-100 text-green-800',
        COMPLETO: 'bg-green-100 text-green-800',
        RECHAZADO: 'bg-red-100 text-red-800',
        ENVIADO: 'bg-blue-100 text-blue-800',
        ANULADO: 'bg-gray-200 text-gray-800 line-through',
    };
    return (
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
            {status}
        </span>
    );
};

export default function DetailsModal({ isOpen, onClose, comprobante }) {
    if (!comprobante) return null;

    const rawItems = comprobante.items || comprobante.comprobanteitem || [];
    const items = rawItems.filter(i => i.codigo_producto !== 'DESC-PROMO');
    const totalPromoDiscount = rawItems
        .filter(i => i.codigo_producto === 'DESC-PROMO')
        .reduce((sum, i) => sum + Math.abs(parseFloat(i.total)), 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Detalles del Comprobante">
            <div className="space-y-6">
                {/* Información del Comprobante */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-lg border border-indigo-100">
                    <div className="flex items-center gap-3 mb-4">
                        <FileText size={32} className="text-indigo-600" />
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">
                                {comprobante.serie}-{String(comprobante.numero).padStart(6, '0')}
                            </h3>
                            <p className="text-sm text-gray-600">
                                {comprobante.nombre_razon_social?.toUpperCase() === 'PÚBLICO GENERAL' || !comprobante.numero_documento_cliente || comprobante.numero_documento_cliente === '00000000'
                                    ? 'Nota de Venta'
                                    : comprobante.tipo_documento_cliente === '6' || comprobante.serie?.startsWith('F')
                                        ? 'Factura Electrónica'
                                        : 'Boleta de Venta'}
                            </p>
                        </div>
                        <div className="ml-auto">
                            <StatusBadge status={comprobante.estado_sunat} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-gray-500" />
                            <div>
                                <p className="text-xs text-gray-500">Fecha de Emisión</p>
                                <p className="font-semibold">{new Date(comprobante.fecha_emision).toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <DollarSign size={18} className="text-gray-500" />
                            <div>
                                <p className="text-xs text-gray-500">Forma de Pago</p>
                                <p className="font-semibold">{comprobante.forma_pago}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Información del Cliente */}
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <User size={20} className="text-gray-600" />
                        <h4 className="font-bold text-lg">Información del Cliente</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs text-gray-500">Nombre / Razón Social</p>
                            <p className="font-semibold">{comprobante.nombre_razon_social || 'Público General'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Documento</p>
                            <p className="font-semibold">
                                {comprobante.tipo_documento_cliente || 'DNI'}: {comprobante.numero_documento_cliente || '-'}
                            </p>
                        </div>
                        {comprobante.direccion_cliente && (
                            <div className="col-span-2">
                                <p className="text-xs text-gray-500">Dirección</p>
                                <p className="font-semibold">{comprobante.direccion_cliente}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Productos */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Package size={20} className="text-gray-600" />
                        <h4 className="font-bold text-lg">Productos</h4>
                    </div>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-3 text-left text-xs font-semibold text-gray-600">Producto</th>
                                    <th className="p-3 text-center text-xs font-semibold text-gray-600">Cantidad</th>
                                    <th className="p-3 text-right text-xs font-semibold text-gray-600">Precio Unit.</th>
                                    <th className="p-3 text-right text-xs font-semibold text-gray-600">Subtotal</th>
                                    <th className="p-3 text-right text-xs font-semibold text-gray-600">IGV</th>
                                    <th className="p-3 text-right text-xs font-semibold text-gray-600">Total</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {items.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="p-3 text-sm">
                                            <p className="font-medium">{item.descripcion || item.producto?.nombre}</p>
                                            {item.codigo_producto && (
                                                <p className="text-xs text-gray-500">Código: {item.codigo_producto}</p>
                                            )}
                                        </td>
                                        <td className="p-3 text-center text-sm font-semibold">{item.cantidad}</td>
                                        <td className="p-3 text-right text-sm">S/ {(parseFloat(item.total) / parseFloat(item.cantidad)).toFixed(2)}</td>
                                        <td className="p-3 text-right text-sm">S/ {parseFloat(item.subtotal).toFixed(2)}</td>
                                        <td className="p-3 text-right text-sm">S/ {parseFloat(item.igv).toFixed(2)}</td>
                                        <td className="p-3 text-right text-sm font-bold text-indigo-600">
                                            S/ {parseFloat(item.total).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Totales */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-lg border border-indigo-100">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Op. Gravada:</span>
                            <span className="font-semibold">S/ {parseFloat(comprobante.subtotal).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700 font-medium text-sm">IGV (18%):</span>
                            <span className="font-semibold text-sm">S/ {parseFloat(comprobante.igv).toFixed(2)}</span>
                        </div>
                        {totalPromoDiscount > 0 && (
                            <div className="flex justify-between items-center text-sm text-emerald-700 bg-emerald-50 p-1 rounded">
                                <span className="font-bold">Descuento Promo:</span>
                                <span className="font-black">- S/ {totalPromoDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        {comprobante.descuentoPuntos && parseFloat(comprobante.descuentoPuntos) > 0 && (
                            <div className="flex justify-between items-center text-sm text-indigo-700">
                                <span className="font-medium">Canje Puntos:</span>
                                <span className="font-bold">- S/ {parseFloat(comprobante.descuentoPuntos).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t-2 border-indigo-200">
                            <span className="text-xl font-bold text-gray-900">TOTAL A PAGAR:</span>
                            <span className="text-2xl font-bold text-indigo-600">S/ {parseFloat(comprobante.total).toFixed(2)}</span>
                        </div>
                    </div>

                    {comprobante.montoRecibido && (
                        <div className="mt-4 pt-4 border-t border-indigo-200 space-y-1">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Monto Recibido:</span>
                                <span className="font-semibold">S/ {parseFloat(comprobante.montoRecibido).toFixed(2)}</span>
                            </div>
                            {comprobante.vuelto && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Vuelto:</span>
                                    <span className="font-semibold text-green-600">S/ {parseFloat(comprobante.vuelto).toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Observaciones */}
                {comprobante.observaciones && (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <h4 className="font-bold text-sm mb-2">Observaciones:</h4>
                        <p className="text-sm text-gray-700">{comprobante.observaciones}</p>
                    </div>
                )}

                {/* Información SUNAT */}
                {comprobante.estado_sunat !== 'PENDIENTE' && comprobante.estado_sunat !== 'COMPLETO' && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-bold text-sm mb-2">Información SUNAT:</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            {comprobante.fecha_envio_sunat && (
                                <div>
                                    <p className="text-xs text-gray-500">Fecha de Envío:</p>
                                    <p className="font-semibold">{new Date(comprobante.fecha_envio_sunat).toLocaleString()}</p>
                                </div>
                            )}
                            {comprobante.hash_cpe && (
                                <div className="col-span-2">
                                    <p className="text-xs text-gray-500">Hash CPE:</p>
                                    <p className="font-mono text-xs break-all">{comprobante.hash_cpe}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
