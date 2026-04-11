import React, { useState } from 'react';
import { RotateCcw, X, AlertTriangle } from 'lucide-react';
import { api } from '../../../lib/api';

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

const Button = ({ children, variant = 'primary', size = 'md', onClick, disabled = false, className = '' }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors ${variant === 'primary' ? 'bg-indigo-600 text-white hover:bg-indigo-700' :
            variant === 'secondary' ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' :
                variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                    variant === 'success' ? 'bg-green-600 text-white hover:bg-green-700' :
                        variant === 'outline' ? 'border border-gray-300 text-gray-700 hover:bg-gray-50' :
                            'bg-indigo-600 text-white hover:bg-indigo-700'
            } ${size === 'sm' ? 'text-sm' : 'text-base'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
        {children}
    </button>
);

export default function ReturnModal({ isOpen, onClose, comprobante, onSuccess }) {
    const [selectedItems, setSelectedItems] = useState([]);
    const [returnQuantities, setReturnQuantities] = useState({});
    const [motivo, setMotivo] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!comprobante) return null;

    const items = comprobante.items || comprobante.comprobanteitem || [];

    const handleSelectAll = () => {
        const allIds = items.map(item => item.id);
        setSelectedItems(allIds);
        const quantities = {};
        items.forEach(item => {
            quantities[item.id] = item.cantidad;
        });
        setReturnQuantities(quantities);
    };

    const handleDeselectAll = () => {
        setSelectedItems([]);
        setReturnQuantities({});
    };

    const toggleItem = (itemId) => {
        if (selectedItems.includes(itemId)) {
            setSelectedItems(selectedItems.filter(id => id !== itemId));
            const newQuantities = { ...returnQuantities };
            delete newQuantities[itemId];
            setReturnQuantities(newQuantities);
        } else {
            setSelectedItems([...selectedItems, itemId]);
            const item = items.find(i => i.id === itemId);
            setReturnQuantities({
                ...returnQuantities,
                [itemId]: item.cantidad
            });
        }
    };

    const setReturnQuantity = (itemId, value) => {
        const item = items.find(i => i.id === itemId);
        const cantidad = Math.min(Math.max(1, parseInt(value) || 1), item.cantidad);
        setReturnQuantities({
            ...returnQuantities,
            [itemId]: cantidad
        });
    };

    const calculateReturnTotal = () => {
        let total = 0;
        selectedItems.forEach(itemId => {
            const item = items.find(i => i.id === itemId);
            if (item) {
                const cantidad = returnQuantities[itemId] || item.cantidad;
                total += parseFloat(item.precio_unitario) * cantidad;
            }
        });
        return total;
    };

    const handleProcessReturn = async () => {
        if (selectedItems.length === 0) {
            setError('Debe seleccionar al menos un producto');
            return;
        }

        if (!motivo || motivo.trim().length === 0) {
            setError('El motivo es obligatorio');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const returnItems = selectedItems.map(itemId => {
                const item = items.find(i => i.id === itemId);
                const isService = !!item.servicioId; // Si tiene servicioId, es un servicio
                return {
                    productId: isService ? item.servicioId : item.productoId,
                    type: isService ? 'SERVICE' : 'PRODUCT',
                    quantity: returnQuantities[itemId] || item.cantidad,
                    cantidad: returnQuantities[itemId] || item.cantidad // Duplicar por si backend usa uno u otro
                };
            });

            const { data } = await api.post(`/sales/return/${comprobante.id}`, {
                items: returnItems,
                motivo: motivo.trim()
            });

            alert('Devolución procesada exitosamente');
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Error procesando devolución');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Devolución de Productos">
            <div className="space-y-4">
                {/* Información del comprobante */}
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-bold text-lg">Comprobante: {comprobante.serie}-{String(comprobante.numero).padStart(6, '0')}</h4>
                    <p className="text-gray-600">Total: S/ {parseFloat(comprobante.total).toFixed(2)}</p>
                    <p className="text-sm text-gray-500">Cliente: {comprobante.nombre_razon_social || 'Público General'}</p>
                </div>

                {/* Botones de selección */}
                <div className="flex justify-between items-center">
                    <Button onClick={handleSelectAll} variant="secondary" size="sm">
                        Devolver Todo
                    </Button>
                    <Button onClick={handleDeselectAll} variant="outline" size="sm">
                        Limpiar Selección
                    </Button>
                </div>

                {/* Tabla de productos */}
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600">Sel.</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600">Producto</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600">Cant. Vendida</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600">Cant. a Devolver</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600">Precio Unit.</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {items.map(item => (
                                <tr key={item.id} className={selectedItems.includes(item.id) ? 'bg-indigo-50' : ''}>
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.includes(item.id)}
                                            onChange={() => toggleItem(item.id)}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="p-3 text-sm">{item.descripcion || item.producto?.nombre}</td>
                                    <td className="p-3 text-sm">{item.cantidad}</td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            min="1"
                                            max={item.cantidad}
                                            value={returnQuantities[item.id] || item.cantidad}
                                            onChange={(e) => setReturnQuantity(item.id, e.target.value)}
                                            disabled={!selectedItems.includes(item.id)}
                                            className="w-20 p-1 border rounded text-sm"
                                        />
                                    </td>
                                    <td className="p-3 text-sm">S/ {parseFloat(item.precio_unitario).toFixed(2)}</td>
                                    <td className="p-3 text-sm font-semibold">
                                        S/ {(parseFloat(item.precio_unitario) * (returnQuantities[item.id] || item.cantidad)).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Motivo */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Motivo de Devolución <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Ej: Producto defectuoso, cliente insatisfecho, error en la venta..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        rows="3"
                    />
                    <p className="text-xs text-gray-500 mt-1">Obligatorio</p>
                </div>

                {/* Resumen */}
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold">Productos seleccionados:</span>
                        <span>{selectedItems.length} de {items.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">Total a devolver:</span>
                        <span className="font-bold text-2xl text-indigo-600">S/ {calculateReturnTotal().toFixed(2)}</span>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
                        <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-red-800 text-sm">{error}</p>
                    </div>
                )}

                {/* Botones de acción */}
                <div className="flex gap-3 justify-end">
                    <Button onClick={onClose} variant="outline">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleProcessReturn}
                        variant="success"
                        disabled={loading || selectedItems.length === 0}
                    >
                        <RotateCcw size={18} />
                        {loading ? 'Procesando...' : 'Procesar Devolución'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
