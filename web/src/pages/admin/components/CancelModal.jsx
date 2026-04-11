import React, { useState } from 'react';
import { Trash2, X, AlertTriangle, Lock } from 'lucide-react';
import { api } from '../../../lib/api';

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
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
                variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                    variant === 'outline' ? 'border border-gray-300 text-gray-700 hover:bg-gray-50' :
                        'bg-indigo-600 text-white hover:bg-indigo-700'
            } ${size === 'sm' ? 'text-sm' : 'text-base'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
        {children}
    </button>
);

export default function CancelModal({ isOpen, onClose, comprobante, onSuccess }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!comprobante) return null;

    const handleCancel = async () => {
        if (!password) {
            setError('Debe ingresar la contraseña');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await api.delete(`/sales/${comprobante.id}`, {
                data: { password }
            });

            alert('Comprobante cancelado exitosamente');
            onSuccess();
            onClose();
            setPassword('');
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Error cancelando comprobante');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cancelar Comprobante">
            <div className="space-y-4">
                {/* Advertencia */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle size={24} className="text-red-600 flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-red-900 mb-1">¡Acción Irreversible!</h4>
                        <p className="text-sm text-red-800">
                            Esta acción anulará el comprobante y devolverá el stock al inventario.
                            El comprobante quedará marcado como ANULADO.
                        </p>
                    </div>
                </div>

                {/* Información del comprobante */}
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-bold text-lg">Comprobante: {comprobante.serie}-{String(comprobante.numero).padStart(6, '0')}</h4>
                    <p className="text-gray-600">Total: S/ {parseFloat(comprobante.total).toFixed(2)}</p>
                    <p className="text-sm text-gray-500">Cliente: {comprobante.nombre_razon_social || 'Público General'}</p>
                    <p className="text-sm text-gray-500">Fecha: {new Date(comprobante.fecha_emision).toLocaleString()}</p>
                </div>

                {/* Input de contraseña */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Lock size={16} className="inline mr-1" />
                        Contraseña de Administrador <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Ingrese la contraseña"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                        onKeyPress={(e) => e.key === 'Enter' && handleCancel()}
                    />
                    <p className="text-xs text-gray-500 mt-1">Contraseña maestra requerida para esta acción</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                        <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-red-800 text-sm">{error}</p>
                    </div>
                )}

                {/* Botones de acción */}
                <div className="flex gap-3 justify-end pt-4">
                    <Button onClick={onClose} variant="outline">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleCancel}
                        variant="danger"
                        disabled={loading || !password}
                    >
                        <Trash2 size={18} />
                        {loading ? 'Procesando...' : 'Confirmar Cancelación'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
