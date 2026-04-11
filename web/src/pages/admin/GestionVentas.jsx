import React, { useState, useEffect } from 'react';
import { FileText, Download, FileDown, Edit3, Trash2, MoreVertical, RotateCcw, Eye, ShoppingBag, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, Button } from './components/ui';
import { generateComprobantePDF, generateTicketPDF } from '../../lib/pdfGenerator';
import { generateComprobanteXML } from '../../lib/xmlGenerator';
import ReturnModal from './components/ReturnModal';
import CancelModal from './components/CancelModal';
import DetailsModal from './components/DetailsModal';

const StatusBadge = ({ status }) => {
    const statusStyles = {
        PENDIENTE: 'bg-yellow-100 text-yellow-800',
        ACEPTADO: 'bg-green-100 text-green-800',
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

const MethodBadge = ({ method, configs }) => {
    let color = '#6366f1'; // Indigo default
    if (method === 'Efectivo') color = '#16a34a'; // Green
    else {
        const match = configs.find(c => c.metodo === method || c.nombre === method);
        if (match?.color) color = match.color;
    }
    return (
        <span className="px-3 py-1 text-xs font-semibold rounded-full border whitespace-nowrap" style={{ backgroundColor: `${color}15`, color, borderColor: `${color}40` }}>
            {method || 'N/A'}
        </span>
    );
};


const ExpiryTimer = ({ createdAt }) => {
    const [timeLeft, setTimeLeft] = useState("");
    useEffect(() => {
        const update = () => {
            const created = new Date(createdAt).getTime();
            const diff = (created + 24 * 60 * 60 * 1000) - Date.now();
            if (diff <= 0) { setTimeLeft("Expirado"); return; }
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            setTimeLeft(`${h}h ${m}m`);
        };
        update();
        const timer = setInterval(update, 60000);
        return () => clearInterval(timer);
    }, [createdAt]);
    return (
        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 mt-1 max-w-fit">
            <Clock size={10} /> {timeLeft}
        </div>
    );
};

export default function GestionVentas({ farmacia, user }) {
    const [comprobantes, setComprobantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [returnModal, setReturnModal] = useState({ isOpen: false, comprobante: null });
    const [cancelModal, setCancelModal] = useState({ isOpen: false, comprobante: null });
    const [detailsModal, setDetailsModal] = useState({ isOpen: false, comprobante: null });
    const [openMenuId, setOpenMenuId] = useState(null);
    const [pagoConfigs, setPagoConfigs] = useState([]);

    const fetchComprobantes = async () => {
        if (!farmacia?.id) return;
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get('/sales', { headers: { 'x-farmacia-id': farmacia.id } });
            setComprobantes(data);
        } catch (err) {
            console.error("Error fetching comprobantes:", err);
            setError("No se pudieron cargar las ventas.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchPagoConfigs = async () => {
            if (!farmacia?.id) return;
            try {
                const { data } = await api.get('/configuracion-pago', { headers: { 'x-farmacia-id': farmacia.id } });
                setPagoConfigs(data);
            } catch (err) {
                console.error("Error fetching pago configs:", err);
            }
        };
        fetchPagoConfigs();
        fetchComprobantes();
    }, [farmacia]);

    // Cerrar menú al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [openMenuId]);

    const handleDeletePermanent = async (comprobanteId) => {
        if (window.confirm('¿Eliminar permanentemente este comprobante? Esta acción no se puede deshacer.')) {
            try {
                await api.delete(`/sales/${comprobanteId}/permanent`, { headers: { 'x-farmacia-id': farmacia.id } });
                fetchComprobantes();
            } catch (err) {
                console.error("Error deleting comprobante:", err);
                alert(err.response?.data?.details || 'No se pudo eliminar el comprobante.');
            }
        }
    };

    const handleDownloadPDF = (comprobante) => {
        generateComprobantePDF(comprobante, farmacia);
    };

    const handleDownloadTicket = (comprobante) => {
        generateTicketPDF(comprobante, farmacia);
    };

    const handleDownloadXML = (comprobante) => {
        generateComprobanteXML(comprobante, farmacia);
    };

    const handleOpenReturnModal = (comprobante) => {
        setReturnModal({ isOpen: true, comprobante });
        setOpenMenuId(null);
    };

    const handleOpenCancelModal = (comprobante) => {
        setCancelModal({ isOpen: true, comprobante });
        setOpenMenuId(null);
    };

    const toggleMenu = (comprobanteId) => {
        setOpenMenuId(openMenuId === comprobanteId ? null : comprobanteId);
    };

    const handleOpenDetailsModal = (comprobante) => {
        setDetailsModal({ isOpen: true, comprobante });
        setOpenMenuId(null);
    };

    if (!farmacia?.id) {
        return <Card><p>Seleccione una farmacia para ver sus ventas.</p></Card>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3"><ShoppingBag /> Gestión de Ventas</h1>
                    <p className="text-gray-500">Administra tus ventas, devoluciones y anulaciones en {farmacia?.nombre}</p>
                </div>
            </div>

            <Card>
                {loading && <p className="text-center p-6">Cargando ventas...</p>}
                {error && <p className="text-center text-red-500 p-6">{error}</p>}
                {!loading && !error && (
                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Comprobante</th>
                                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Fecha</th>
                                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Cliente</th>
                                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Total</th>
                                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Método</th>
                                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {comprobantes
                                    .filter(comp => {
                                        if (user?.role === 'ADMIN') return true;
                                        const created = new Date(comp.fecha_emision).getTime();
                                        return (created + 24 * 60 * 60 * 1000) > Date.now();
                                    })
                                    .map(comp => (
                                        <tr key={comp.id} className={`hover:bg-gray-50 ${comp.tieneDevolucion ? 'bg-purple-50' : ''}`}>
                                            <td className="p-4 font-medium text-gray-900">
                                                <div className="flex items-center gap-2">
                                                    <span>{comp.serie}-{String(comp.numero).padStart(6, '0')}</span>
                                                    {comp.tieneDevolucion && (
                                                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                                                            <RotateCcw size={12} className="inline mr-1" />
                                                            Devuelto
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-gray-600">{new Date(comp.fecha_emision).toLocaleString()}</span>
                                                    {user?.role === 'VENDEDOR' && <ExpiryTimer createdAt={comp.fecha_emision} />}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-600">{comp.nombre_razon_social || 'Público General'}</td>
                                            <td className="p-4 text-sm font-bold text-indigo-600">S/ {parseFloat(comp.total).toFixed(2)}</td>
                                            <td className="p-4"><MethodBadge method={comp.forma_pago} configs={pagoConfigs} /></td>
                                            <td className="p-4 flex gap-2 relative">
                                                <Button variant="outline" size="sm" className="p-2" onClick={() => handleDownloadPDF(comp)}>
                                                    <Download size={16} /> PDF
                                                </Button>
                                                {/* Botones principales para acceso rápido */}
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="p-2 hidden md:inline-flex"
                                                    onClick={() => handleOpenDetailsModal(comp)}
                                                    title="Ver Detalles"
                                                >
                                                    <Eye size={16} />
                                                </Button>

                                                {/* Menú de acciones */}
                                                <div className="relative">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="p-2"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleMenu(comp.id);
                                                        }}
                                                    >
                                                        <MoreVertical size={16} />
                                                    </Button>

                                                    {openMenuId === comp.id && (
                                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                                            <button
                                                                onClick={() => handleOpenDetailsModal(comp)}
                                                                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm md:hidden"
                                                            >
                                                                <Eye size={16} className="text-gray-600" />
                                                                Ver Detalles
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownloadXML(comp)}
                                                                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
                                                            >
                                                                <FileDown size={16} className="text-gray-600" />
                                                                Descargar XML
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownloadTicket(comp)}
                                                                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
                                                            >
                                                                <FileText size={16} className="text-gray-600" />
                                                                Ver Ticket
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenReturnModal(comp)}
                                                                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm border-t"
                                                                disabled={comp.estado_sunat === 'ANULADO'}
                                                            >
                                                                <RotateCcw size={16} className="text-blue-600" />
                                                                Devolución
                                                            </button>
                                                            {user?.role === 'ADMIN' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleOpenCancelModal(comp)}
                                                                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm border-t"
                                                                        disabled={comp.estado_sunat === 'ANULADO'}
                                                                    >
                                                                        <Trash2 size={16} className="text-red-600" />
                                                                        Cancelar
                                                                    </button>
                                                                    {comp.estado_sunat === 'ANULADO' && (
                                                                        <button
                                                                            onClick={() => handleDeletePermanent(comp.id)}
                                                                            className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-sm border-t text-red-700"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                            Eliminar Permanente
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Modales */}
            <ReturnModal
                isOpen={returnModal.isOpen}
                onClose={() => setReturnModal({ isOpen: false, comprobante: null })}
                comprobante={returnModal.comprobante}
                onSuccess={fetchComprobantes}
            />

            <CancelModal
                isOpen={cancelModal.isOpen}
                onClose={() => setCancelModal({ isOpen: false, comprobante: null })}
                comprobante={cancelModal.comprobante}
                onSuccess={fetchComprobantes}
            />

            <DetailsModal
                isOpen={detailsModal.isOpen}
                onClose={() => setDetailsModal({ isOpen: false, comprobante: null })}
                comprobante={detailsModal.comprobante}
            />
        </div>
    );
}
