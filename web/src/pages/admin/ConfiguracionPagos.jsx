import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from './components/ui.jsx';
import { api } from '../../lib/api.js';
import { Settings, Save, Image as ImageIcon, Trash2, Power, PowerOff, ZoomIn, ZoomOut } from 'lucide-react';

export default function ConfiguracionPagos({ farmacia }) {
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const [newMetodo, setNewMetodo] = useState('');
    const [newNombre, setNewNombre] = useState('');
    const [newColor, setNewColor] = useState('#6366f1');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (farmacia) {
            fetchConfigs();
        }
    }, [farmacia]);

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            await api.post('/configuracion-pago/init', {}, { headers: { 'x-farmacia-id': farmacia.id } });
            const { data } = await api.get('/configuracion-pago', { headers: { 'x-farmacia-id': farmacia.id } });
            setConfigs(data);
        } catch (err) {
            console.error("Error fetching configs:", err);
            setError("Error al cargar configuraciones");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = (updatedConfig) => {
        setConfigs(prev => prev.map(c => c.id === updatedConfig.id ? updatedConfig : c));
    };

    const handleDelete = async (id) => {
        if (!confirm("¿Seguro que deseas eliminar este método?")) return;
        try {
            await api.delete(`/configuracion-pago/${id}`, { headers: { 'x-farmacia-id': farmacia.id } });
            setConfigs(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            console.error("Error elminando", err);
            alert("Error al eliminar la configuración");
        }
    };

    const handleCreate = async () => {
        if (!newMetodo || !newNombre) return alert("Completa ambos campos");
        setIsCreating(true);
        try {
            const { data } = await api.post('/configuracion-pago', {
                metodo: newMetodo,
                nombre: newNombre,
                color: newColor
            }, { headers: { 'x-farmacia-id': farmacia.id } });
            setConfigs(prev => [...prev, data]);
            setNewMetodo('');
            setNewNombre('');
            setNewColor('#6366f1');
        } catch (err) {
            console.error(err);
            alert("Error al crear el método. Tal vez ya existe.");
        } finally {
            setIsCreating(false);
        }
    };

    if (loading) return <div className="p-6 text-center text-gray-500">Cargando configuraciones...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Settings size={28} className="text-indigo-600" />
                    Configuraciones de Método de Pago
                </h2>
                <p className="text-gray-500 mt-1">Configura nombres, visibilidad e imágenes (QRs o Datos de Cuenta) para las pasarelas de pago de la farmacia sugerida.</p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                    {error}
                </div>
            )}

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <Input 
                        label="Identificador interno (Ej: Izypay)" 
                        value={newMetodo} 
                        onChange={(e) => setNewMetodo(e.target.value)} 
                    />
                </div>
                <div className="flex-1 w-full">
                    <Input 
                        label="Nombre Mostrar (POS)" 
                        value={newNombre} 
                        onChange={(e) => setNewNombre(e.target.value)} 
                    />
                </div>
                <div className="w-20">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Color</label>
                    <input 
                        type="color" 
                        value={newColor} 
                        onChange={(e) => setNewColor(e.target.value)} 
                        className="w-full h-10 rounded border border-gray-300 cursor-pointer p-1"
                    />
                </div>
                <Button variant="primary" onClick={handleCreate} disabled={isCreating}>
                    + Nuevo Método
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {configs.map(config => (
                    <ConfigCard 
                        key={config.id} 
                        config={config} 
                        farmacia={farmacia} 
                        onChange={handleUpdate} 
                        onDelete={() => handleDelete(config.id)}
                    />
                ))}
            </div>

            <hr className="border-gray-200" />

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <ConfiguracionGeneralPOS farmacia={farmacia} />
            </div>
        </div>
    );
}

function ConfiguracionGeneralPOS({ farmacia }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, [farmacia?.id]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/config/pos', { headers: { 'x-farmacia-id': farmacia.id } });
            setConfig(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/config/pos', config, { headers: { 'x-farmacia-id': farmacia.id } });
            alert("Configuración general guardada");
        } catch (err) {
            alert("Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Cargando ajustes generales...</div>;

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 border-b pb-2">Ajustes Generales del POS</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Porcentaje de IGV (%)</label>
                        <div className="flex items-center gap-2">
                            <Input 
                                type="number"
                                step="0.01"
                                value={config?.igvPercent}
                                onChange={(e) => setConfig({ ...config, igvPercent: e.target.value })}
                            />
                            <span className="text-gray-500 font-bold">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Este valor se utiliza para desglosar el IGV en los comprobantes de venta.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 font-bold text-red-600">Alerta de Medicamentos a Vencer (Meses)</label>
                        <div className="flex items-center gap-2">
                            <Input 
                                type="number"
                                step="1"
                                min="1"
                                max="24"
                                value={config?.margenVencimientoMeses}
                                onChange={(e) => setConfig({ ...config, margenVencimientoMeses: e.target.value })}
                            />
                            <span className="text-gray-500 font-bold text-xs uppercase">Meses</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 uppercase">Define cuántos meses antes de vencer debe salir la notificación en el POS.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                            <p className="font-semibold text-gray-900">Descarga automática de Ticket</p>
                            <p className="text-xs text-gray-500">¿Abrir PDF del ticket automáticamente al finalizar una venta?</p>
                        </div>
                        <button 
                            onClick={() => setConfig({ ...config, autoDownloadTicket: !config.autoDownloadTicket })}
                            className={`p-2 rounded-full transition-colors ${config?.autoDownloadTicket ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-500'}`}
                        >
                            {config?.autoDownloadTicket ? <Power size={24} /> : <PowerOff size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                    <Save size={18} className="mr-2" />
                    Guardar Ajustes POS
                </Button>
            </div>
        </div>
    );
}

function ConfigCard({ config, farmacia, onChange, onDelete }) {
    const [isSaving, setIsSaving] = useState(false);
    const [localName, setLocalName] = useState(config.nombre);
    const [localActive, setLocalActive] = useState(config.activo);
    const [localImage, setLocalImage] = useState(config.imagenUrl);
    const [localColor, setLocalColor] = useState(config.color || '#6366f1');
    const [localTexto, setLocalTexto] = useState(config.texto || '');
    const [localZoom, setLocalZoom] = useState(config.zoom || 1);

    useEffect(() => {
        setLocalName(config.nombre);
        setLocalActive(config.activo);
        setLocalImage(config.imagenUrl);
        setLocalColor(config.color || '#6366f1');
        setLocalTexto(config.texto || '');
        setLocalZoom(config.zoom || 1);
    }, [config]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { data } = await api.put(`/configuracion-pago/${config.id}`, {
                nombre: localName,
                activo: localActive,
                imagenUrl: localImage,
                color: localColor,
                texto: localTexto,
                zoom: localZoom
            }, { headers: { 'x-farmacia-id': farmacia.id } });
            onChange(data);
            alert("Configuración guardada correctamente");
        } catch (err) {
            console.error("Error updating config:", err);
            alert("Error al guardar la configuración");
        } finally {
            setIsSaving(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);
        formData.append('metodo', config.metodo);

        setIsSaving(true);
        try {
            const { data } = await api.post('/configuracion-pago/upload', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    'x-farmacia-id': farmacia.id
                }
            });
            setLocalImage(data.imageUrl);
        } catch (err) {
            console.error("Error uploading image:", err);
            alert("Error al subir la imagen");
        } finally {
            setIsSaving(false);
            e.target.value = null; // reset input
        }
    };

    const handleRemoveImage = () => {
        setLocalImage(null);
    };

    const serverUrl = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : 'http://localhost:4000';

    return (
        <Card className={`relative transition-all border-2 ${localActive ? 'border-indigo-100 hover:border-indigo-300' : 'border-gray-100 opacity-80'}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="font-bold text-lg text-gray-900 border-b pb-1">
                    Método: {config.metodo}
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={onDelete}
                        className="p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors"
                        title="Eliminar Método"
                    >
                        <Trash2 size={20} />
                    </button>
                    <button 
                        onClick={() => setLocalActive(!localActive)}
                        className={`p-2 rounded-full transition-colors ${localActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                        title={localActive ? "Desactivar Método" : "Activar Método"}
                    >
                        {localActive ? <Power size={20} /> : <PowerOff size={20} />}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Input 
                            label="Nombre Mostrar (POS)"
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            disabled={!localActive}
                        />
                    </div>
                    <div className="w-16">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Color</label>
                        <input 
                            type="color" 
                            value={localColor} 
                            onChange={(e) => setLocalColor(e.target.value)} 
                            disabled={!localActive}
                            className="w-full h-10 rounded border border-gray-300 cursor-pointer p-0.5"
                        />
                    </div>
                </div>
                
                <div className="mt-4">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Imagen / QR (Opcional)</label>
                    {localImage ? (
                        <div className="space-y-2">
                            <div className="relative border rounded-lg p-2 bg-gray-50 flex flex-col items-center group overflow-hidden">
                                <div 
                                    className="transition-transform duration-200"
                                    style={{ transform: `scale(${localZoom})` }}
                                >
                                    <img 
                                        src={`${serverUrl}${localImage}`} 
                                        alt={localName} 
                                        className="max-h-40 object-contain rounded"
                                    />
                                </div>
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg gap-2">
                                    <label className="cursor-pointer bg-white text-gray-800 p-2 rounded-full hover:bg-gray-100">
                                        <ImageIcon size={18} />
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isSaving || !localActive} />
                                    </label>
                                    <button onClick={handleRemoveImage} className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <button 
                                    onClick={() => setLocalZoom(prev => Math.max(0.5, prev - 0.1))}
                                    className="p-1 hover:bg-gray-200 rounded"
                                    title="Alejar"
                                >
                                    <ZoomOut size={20} />
                                </button>
                                <span className="text-xs font-bold text-gray-600 w-12 text-center">
                                    {Math.round(localZoom * 100)}%
                                </span>
                                <button 
                                    onClick={() => setLocalZoom(prev => Math.min(3, prev + 0.1))}
                                    className="p-1 hover:bg-gray-200 rounded"
                                    title="Acercar"
                                >
                                    <ZoomIn size={20} />
                                </button>
                                <button 
                                    onClick={() => setLocalZoom(1)}
                                    className="text-[10px] text-indigo-600 font-bold hover:underline"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    ) : (
                        <label className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-50 hover:border-indigo-300 transition-colors ${!localActive ? 'opacity-50 pointer-events-none' : ''}`}>
                            <ImageIcon size={32} className="mb-2 text-gray-400" />
                            <span className="text-sm">Click para subir foto/QR</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isSaving || !localActive} />
                        </label>
                    )}
                </div>

                <div className="mt-4">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Texto / Instrucciones (Si no hay imagen)</label>
                    <textarea 
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 bg-white"
                        rows="3"
                        placeholder="Ej: Transferencia al BCP N° 191-..."
                        value={localTexto}
                        onChange={(e) => setLocalTexto(e.target.value)}
                        disabled={!localActive}
                    />
                </div>

                <div className="pt-4 border-t border-gray-100 mt-4">
                    <Button 
                        variant="primary" 
                        onClick={handleSave} 
                        disabled={isSaving || (
                            localName === config.nombre && 
                            localActive === config.activo && 
                            localImage === config.imagenUrl && 
                            localColor === (config.color || '#6366f1') &&
                            localTexto === (config.texto || '') &&
                            localZoom === (config.zoom || 1)
                        )}
                        className="w-full"
                    >
                        <Save size={18} />
                        {isSaving ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                </div>
            </div>
        </Card>
    );
}
