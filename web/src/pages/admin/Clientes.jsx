import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Plus, Edit3, Trash2, FileSearch, Clock, Award, Smartphone, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../lib/api';
import * as XLSX from 'xlsx';

// --- UI Components ---
const Card = ({ children, className = '' }) => <div className={`bg-white rounded-xl shadow-lg p-4 md:p-6 ${className}`}>{children}</div>;
const Button = ({ children, variant = 'primary', size = 'md', onClick, disabled = false, className = '', type = 'button' }) => (
    <button onClick={onClick} disabled={disabled} type={type} className={`flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors ${variant === 'primary' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : variant === 'secondary' ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' : variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'} ${size === 'sm' ? 'text-sm' : 'text-base'} ${className}`}>{children}</button>
);
const Input = ({ label, type = 'text', value, onChange, placeholder = '', required = false, className = '', name = '', disabled = false }) => (
    <div>
        {label && <label className="text-sm font-medium text-gray-700 mb-1 block">{label} {required && <span className="text-red-500">*</span>}</label>}
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} name={name} disabled={disabled} className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${className}`} />
    </div>
);
const Select = ({ label, value, onChange, options, required = false, className = '', name = '' }) => (
    <div>
        {label && <label className="text-sm font-medium text-gray-700 mb-1 block">{label} {required && <span className="text-red-500">*</span>}</label>}
        <select value={value} onChange={onChange} required={required} name={name} className={`w-full p-3 border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${className}`}>
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);
const Modal = ({ isOpen, title, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-xl space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">X</button>
                </div>
                {children}
            </Card>
        </div>
    );
};

const docTypeOptions = [{ value: 'DNI', label: 'DNI' }, { value: 'RUC', label: 'RUC' }];

export default function Clientes({ farmacia, user }) {
    if (!farmacia?.id) return <Card><p>Seleccione una farmacia para ver sus clientes.</p></Card>;

    const [clients, setClients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingClients, setLoadingClients] = useState(true);
    const [errorClients, setErrorClients] = useState(null);
    
    // State for the new unified modal
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [clientModalData, setClientModalData] = useState({
        tipoDoc: 'DNI', numeroDoc: '', nombreRazon: '', direccion: '', telefono: '', email: '', distrito: '', provincia: '', departamento: '',
    });
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState(null);

    // History & Habitual state
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedClientForHistory, setSelectedClientForHistory] = useState(null);
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [habitualItems, setHabitualItems] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [expandedSale, setExpandedSale] = useState(null);

    const fetchClients = async () => {
        setLoadingClients(true);
        try {
            const { data } = await api.get('/clientes', { headers: { 'x-farmacia-id': farmacia.id } });
            setClients(data);
        } catch (err) {
            console.error("Error fetching clients:", err);
            setErrorClients("No se pudieron cargar los clientes.");
        } finally {
            setLoadingClients(false);
        }
    };

    useEffect(() => { fetchClients(); }, [farmacia.id]);

    const handleDocumentSearch = async () => {
        const { tipoDoc, numeroDoc } = clientModalData;
        if (!numeroDoc.trim()) return;
        setSearchLoading(true);
        setSearchError(null);
        try {
            const { data: result } = await api.get(`/reniec/search?type=${tipoDoc}&number=${numeroDoc}`);
            if (result.success) {
                setClientModalData(prev => ({ 
                    ...prev, 
                    nombreRazon: result.nombreRazon, 
                    direccion: result.direccion || '',
                    distrito: result.distrito || '',
                    provincia: result.provincia || '',
                    departamento: result.departamento || '',
                }));
            } else {
                setSearchError(result.error || `Documento ${numeroDoc} no encontrado.`);
            }
        } catch (err) {
            setSearchError(err.response?.data?.error || 'El servicio de búsqueda no está disponible.');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSaveClient = async (e) => {
        e.preventDefault();
        if (!clientModalData.nombreRazon.trim()) {
            setSearchError("El nombre o razón social es obligatorio.");
            return;
        }
        try {
            const payload = { ...clientModalData };
            if (editingClient) {
                await api.put(`/clientes/${editingClient.id}`, payload, { headers: { 'x-farmacia-id': farmacia.id } });
            } else {
                await api.post('/clientes', payload, { headers: { 'x-farmacia-id': farmacia.id } });
            }
            fetchClients();
            setIsClientModalOpen(false);
        } catch (err) {
            setSearchError(err.response?.data?.error || "No se pudo guardar el cliente.");
        }
    };

    const handleOpenCreate = () => {
        setEditingClient(null);
        setClientModalData({
            tipoDoc: 'DNI', numeroDoc: '', nombreRazon: '', direccion: '', telefono: '', email: '', distrito: '', provincia: '', departamento: '', puntosAcumulados: 0
        });
        setSearchError(null);
        setIsClientModalOpen(true);
    };

    const handleOpenEdit = (client) => {
        setEditingClient(client);
        setClientModalData({
            tipoDoc: client.tipoDoc || 'DNI',
            numeroDoc: client.numeroDoc || '',
            nombreRazon: client.nombreRazon || '',
            direccion: client.direccion || '',
            distrito: client.distrito || '',
            provincia: client.provincia || '',
            departamento: client.departamento || '',
            telefono: client.telefono || '',
            email: client.email || '',
            puntosAcumulados: client.puntosAcumulados || 0,
        });
        setSearchError(null);
        setIsClientModalOpen(true);
    };
    
    const handleRemove = async (id) => {
        if (window.confirm('¿Confirmas la eliminación de este cliente?')) {
            try {
                await api.delete(`/clientes/${id}`, { headers: { 'x-farmacia-id': farmacia.id } });
                fetchClients();
            } catch (err) { alert(err.response?.data?.error || "Error al eliminar el cliente."); }
        }
    };

    const filteredClients = useMemo(() => {
        return clients.filter(client =>
            client.nombreRazon.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.numeroDoc.includes(searchTerm)
        );
    }, [clients, searchTerm]);

    const handleOpenHistory = async (client) => {
        setSelectedClientForHistory(client);
        setIsHistoryModalOpen(true);
        setLoadingHistory(true);
        setPurchaseHistory([]);
        setHabitualItems([]);
        try {
            const [historyRes, habitualRes] = await Promise.all([
                api.get(`/clientes/${client.id}/history`, { headers: { 'x-farmacia-id': farmacia.id } }),
                api.get(`/clientes/${client.id}/habituales`, { headers: { 'x-farmacia-id': farmacia.id } })
            ]);
            setPurchaseHistory(historyRes.data);
            setHabitualItems(habitualRes.data);
        } catch (err) {
            console.error("Error fetching history/habitual:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const toggleHabitual = async (item, type) => {
        try {
            const payload = {
                clienteId: selectedClientForHistory.id,
                productoId: type === 'PRODUCT' ? (item.productoId || item.id) : null,
                servicioId: type === 'SERVICE' ? (item.servicioId || item.id) : null,
                cantidad: 1
            };
            const { data } = await api.post('/clientes/habitual', payload, { headers: { 'x-farmacia-id': farmacia.id } });
            
            // Refresh habitual items
            const habitualRes = await api.get(`/clientes/${selectedClientForHistory.id}/habituales`, { headers: { 'x-farmacia-id': farmacia.id } });
            setHabitualItems(habitualRes.data);
        } catch (err) {
            console.error("Error toggling habitual:", err);
        }
    };

    const isHabitual = (itemId, type) => {
        return habitualItems.some(h => 
            (type === 'PRODUCT' && h.productoId === itemId) || 
            (type === 'SERVICE' && h.servicioId === itemId)
        );
    };

    const handleExportExcel = () => {
        if (!clients.length) return;
        
        const dataToExport = clients.map(c => ({
            'ID': c.id,
            'Tipo Doc': c.tipoDoc,
            'Nro Documento': c.numeroDoc,
            'Nombre / Razón Social': c.nombreRazon,
            'Dirección': c.direccion || '',
            'Distrito': c.distrito || '',
            'Provincia': c.provincia || '',
            'Departamento': c.departamento || '',
            'Teléfono': c.telefono || '',
            'Email': c.email || '',
            'Puntos Acumulados': c.puntosAcumulados || 0,
            'Fecha Registro': new Date(c.createdAt).toLocaleDateString()
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        XLSX.utils.book_append_sheet(wb, ws, "Clientes");
        XLSX.writeFile(wb, `Reporte_Clientes_${farmacia.nombre}.xlsx`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3"><Users /> Gestión de Clientes</h1>
                    <p className="text-gray-500">{farmacia?.nombre}</p>
                </div>
            </div>

            <Card>
                <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                    <div className="relative w-full md:w-80">
                        <Input placeholder="Buscar por Nombre o Documento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleExportExcel} disabled={clients.length === 0}>
                            <FileSearch size={18} /> Exportar Excel
                        </Button>
                        <Button variant="primary" onClick={handleOpenCreate}><Plus size={18} /> Nuevo Cliente</Button>
                    </div>
                </div>

                {loadingClients ? <p>Cargando...</p> : errorClients ? <p className="text-red-500">{errorClients}</p> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Nombre / Razón Social</th>
                                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Documento</th>
                                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Teléfono</th>
                                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Puntos</th>
                                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredClients.map((client) => (
                                    <tr key={client.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-medium text-gray-900">{client.nombreRazon}</td>
                                        <td className="p-4 text-sm text-gray-600">{client.tipoDoc}: {client.numeroDoc}</td>
                                        <td className="p-4 text-sm text-gray-600">{client.telefono || 'N/A'}</td>
                                        <td className="p-4 text-sm font-bold text-yellow-600">{client.puntosAcumulados}</td>
                                        <td className="p-4 flex gap-2">
                                            <Button variant="outline" size="sm" className="p-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={() => handleOpenHistory(client)} title="Historial y Recetas"><Clock size={16} /></Button>
                                            <Button variant="outline" size="sm" className="p-2" onClick={() => handleOpenEdit(client)} title="Editar"><Edit3 size={16} /></Button>
                                            {user?.role === 'ADMIN' && (
                                                <Button variant="danger" size="sm" className="p-2" onClick={() => handleRemove(client.id)} title="Eliminar"><Trash2 size={16} /></Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Modal isOpen={isClientModalOpen} title={editingClient ? 'Editar Cliente' : 'Registrar Nuevo Cliente'} onClose={() => setIsClientModalOpen(false)}>
                <form className="space-y-4" onSubmit={handleSaveClient}>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                            <Select label="Tipo Doc." name="tipoDoc" value={clientModalData.tipoDoc} onChange={(e) => setClientModalData(p => ({...p, tipoDoc: e.target.value}))} options={docTypeOptions} required />
                        </div>
                        <div className="col-span-2">
                            <Input label="Número de Documento" name="numeroDoc" value={clientModalData.numeroDoc} onChange={(e) => setClientModalData(p => ({...p, numeroDoc: e.target.value}))} required />
                        </div>
                    </div>
                    <div className="flex justify-end items-center">
                        <Button type="button" variant="secondary" size="sm" onClick={handleDocumentSearch} disabled={searchLoading}>
                            <FileSearch size={16} /> {searchLoading ? 'Buscando...' : 'Consultar'}
                        </Button>
                    </div>
                    {searchError && <p className="text-sm text-red-600">{searchError}</p>}
                    <Input label="Nombre / Razón Social" name="nombreRazon" value={clientModalData.nombreRazon} onChange={(e) => setClientModalData(p => ({...p, nombreRazon: e.target.value}))} required />
                    <Input label="Dirección Completa" name="direccion" placeholder="Se autocompleta con SUNAT (Editable)" value={clientModalData.direccion} onChange={(e) => setClientModalData(p => ({...p, direccion: e.target.value}))} />
                    <div className='grid grid-cols-3 gap-3'>
                        <Input label="Distrito" name="distrito" value={clientModalData.distrito} onChange={(e) => setClientModalData(p => ({ ...p, distrito: e.target.value }))} placeholder="Distrito" />
                        <Input label="Provincia" name="provincia" value={clientModalData.provincia} onChange={(e) => setClientModalData(p => ({ ...p, provincia: e.target.value }))} placeholder="Provincia" />
                        <Input label="Dpto" name="departamento" value={clientModalData.departamento} onChange={(e) => setClientModalData(p => ({ ...p, departamento: e.target.value }))} placeholder="Departamento" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Teléfono" name="telefono" value={clientModalData.telefono} onChange={(e) => setClientModalData(p => ({...p, telefono: e.target.value}))} />
                        <Input label="Email" type="email" name="email" value={clientModalData.email} onChange={(e) => setClientModalData(p => ({...p, email: e.target.value}))} />
                    </div>
                    {user?.role === 'ADMIN' && editingClient && (
                         <Input label="Puntos Acumulados" name="puntosAcumulados" type="number" value={clientModalData.puntosAcumulados} onChange={(e) => setClientModalData(p => ({...p, puntosAcumulados: Number(e.target.value)}))} />
                    )}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="secondary" onClick={() => setIsClientModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" variant="primary">{editingClient ? 'Guardar Cambios' : 'Registrar Cliente'}</Button>
                    </div>
                </form>
            </Modal>

            {/* --- History & Habitual Modal --- */}
            <Modal isOpen={isHistoryModalOpen} title={`Historial: ${selectedClientForHistory?.nombreRazon}`} onClose={() => setIsHistoryModalOpen(false)}>
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    
                    {/* Habitual Items Quick View */}
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                        <h4 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                            <Star size={16} className="fill-indigo-500 text-indigo-500" /> Recetas Habituales
                        </h4>
                        {habitualItems.length === 0 ? (
                            <p className="text-xs text-indigo-400 italic">No hay recetas habituales marcadas aún.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {habitualItems.map(h => (
                                    <div key={h.id} className="bg-white px-3 py-1.5 rounded-full border border-indigo-200 text-xs font-medium text-indigo-700 flex items-center gap-2 shadow-sm">
                                        {h.producto?.nombre || h.servicio?.nombre}
                                        <button onClick={() => toggleHabitual(h.producto || h.servicio, h.productoId ? 'PRODUCT' : 'SERVICE')} className="text-red-400 hover:text-red-600 font-bold">×</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Purchase History List */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Clock size={16} /> Compras Recientes</h4>
                        {loadingHistory ? (
                            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
                        ) : purchaseHistory.length === 0 ? (
                            <p className="text-center py-8 text-gray-400 italic">Este cliente no registra compras aún.</p>
                        ) : (
                            purchaseHistory.map(sale => (
                                <div key={sale.id} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                                    <div 
                                        className="bg-gray-50 p-4 flex items-center justify-between cursor-pointer hover:bg-indigo-50/30 transition-colors"
                                        onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{new Date(sale.fecha_emision).toLocaleDateString()}</span>
                                            <span className="text-sm font-bold text-gray-800">{sale.serie}-{sale.numero.toString().padStart(6, '0')}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-lg font-black text-indigo-600">S/ {parseFloat(sale.total).toFixed(2)}</span>
                                            {expandedSale === sale.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                                        </div>
                                    </div>
                                    
                                    {expandedSale === sale.id && (
                                        <div className="p-4 bg-white divide-y divide-gray-50">
                                            {sale.comprobanteitem.map(item => (
                                                 <div key={item.id} className="py-2 flex items-center justify-between">
                                                     <div className="flex flex-col">
                                                         <span className="text-sm font-medium text-gray-900">{item.descripcion}</span>
                                                         <span className="text-xs text-gray-500">Cant: {item.cantidad} x S/ {parseFloat(item.precio_unitario * 1.18).toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex items-center gap-2">
                                                         <span className="text-sm font-bold text-gray-700">S/ {parseFloat(item.total).toFixed(2)}</span>
                                                         {(item.productoId || item.servicioId) && (
                                                             <button 
                                                                 onClick={(e) => {
                                                                     e.stopPropagation();
                                                                     toggleHabitual(item, item.productoId ? 'PRODUCT' : 'SERVICE');
                                                                 }}
                                                                 className={`p-1.5 rounded-lg transition-all ${isHabitual(item.productoId || item.servicioId, item.productoId ? 'PRODUCT' : 'SERVICE') ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400 hover:text-yellow-500'}`}
                                                                 title="Marcar como Receta Habitual"
                                                             >
                                                                 <Star size={16} fill={isHabitual(item.productoId || item.servicioId, item.productoId ? 'PRODUCT' : 'SERVICE') ? "currentColor" : "none"} />
                                                             </button>
                                                         )}
                                                     </div>
                                                 </div>
                                            ))}
                                            
                                            {/* Resumen de Canje de Puntos */}
                                            {parseFloat(sale.descuentoPuntos) > 0 && (
                                                <div className="py-3 mt-2 bg-yellow-50 rounded-lg px-4 border border-yellow-100">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2 text-yellow-800">
                                                            <Award size={16} />
                                                            <span className="text-sm font-bold">Canje de Puntos</span>
                                                        </div>
                                                        <span className="text-sm font-bold text-red-600">- S/ {parseFloat(sale.descuentoPuntos).toFixed(2)}</span>
                                                    </div>
                                                    <p className="text-[11px] text-yellow-600 mt-1 italic">
                                                        Se utilizaron {sale.puntosCanjeados} puntos en esta compra.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    <div className="pt-4 border-t flex justify-end">
                        <Button variant="secondary" onClick={() => setIsHistoryModalOpen(false)}>Cerrar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
