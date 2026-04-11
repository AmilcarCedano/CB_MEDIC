import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import {
    Plus, X, Search, Tag, Percent, Package, Edit2, Trash2,
    ToggleLeft, ToggleRight, ShoppingBag, TrendingDown, AlertTriangle
} from 'lucide-react';

const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-xl shadow-md p-4 md:p-6 ${className}`}>{children}</div>
);
const Button = ({ children, variant = 'primary', size = 'md', onClick, disabled = false, className = '', type = 'button' }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-lg transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${variant === 'primary' ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700'
            : variant === 'success' ? 'bg-green-600 text-white hover:bg-green-700'
            : variant === 'outline' ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
        ${size === 'sm' ? 'text-sm px-3 py-1.5' : 'text-base'} ${className}`}
    >{children}</button>
);

function calcDescuento(precioNormal, precioPromo) {
    if (!precioNormal || precioNormal <= 0) return 0;
    return Math.round(((precioNormal - precioPromo) / precioNormal) * 100);
}

function PromoModal({ isOpen, onClose, onSave, farmacia, editingPromo }) {
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [precioPromo, setPrecioPromo] = useState('');
    const [activo, setActivo] = useState(true);
    const [selectedItems, setSelectedItems] = useState([]); // [{producto, cantidad}]
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isOpen) return;
        api.get('/products', { params: { farmaciaId: farmacia.id } })
            .then(r => setProducts(r.data || []))
            .catch(() => {});
        if (editingPromo) {
            setNombre(editingPromo.nombre);
            setDescripcion(editingPromo.descripcion || '');
            setPrecioPromo(String(editingPromo.precioPromo));
            setActivo(editingPromo.activo);
            setSelectedItems(editingPromo.items.map(i => ({ producto: i.producto, cantidad: i.cantidad })));
        } else {
            setNombre(''); setDescripcion(''); setPrecioPromo(''); setActivo(true); setSelectedItems([]);
        }
        setError(null);
        setSearch('');
    }, [isOpen, editingPromo]);

    const filteredProducts = useMemo(() => {
        const q = search.toLowerCase();
        return products.filter(p => p.nombre.toLowerCase().includes(q) || p.codigoBarras?.includes(q));
    }, [search, products]);

    const addProduct = (product) => {
        setSelectedItems(prev => {
            const existing = prev.find(i => i.producto.id === product.id);
            if (existing) return prev.map(i => i.producto.id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i);
            return [...prev, { producto: { ...product, precioVenta: parseFloat(product.precioVenta) }, cantidad: 1 }];
        });
        setSearch('');
    };

    const updateCantidad = (id, val) => {
        const n = Math.max(1, parseInt(val) || 1);
        setSelectedItems(prev => prev.map(i => i.producto.id === id ? { ...i, cantidad: n } : i));
    };

    const removeItem = (id) => setSelectedItems(prev => prev.filter(i => i.producto.id !== id));

    const precioNormal = selectedItems.reduce((s, i) => s + i.producto.precioVenta * i.cantidad, 0);
    const descPct = calcDescuento(precioNormal, parseFloat(precioPromo) || 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!nombre.trim()) return setError('El nombre es requerido.');
        if (!precioPromo || parseFloat(precioPromo) <= 0) return setError('El precio promocional debe ser mayor a 0.');
        if (selectedItems.length === 0) return setError('Agrega al menos un producto.');
        setSaving(true);
        try {
            await onSave({
                nombre, descripcion, precioPromo: parseFloat(precioPromo), activo,
                items: selectedItems.map(i => ({ productoId: i.producto.id, cantidad: i.cantidad })),
            }, editingPromo?.id);
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Error guardando la promoción.');
        } finally { setSaving(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Tag size={24} className="text-indigo-600" />
                        {editingPromo ? 'Editar Promoción' : 'Nueva Promoción'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Nombre y descripción */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-700 mb-1 block">Nombre de la Campaña *</label>
                            <input value={nombre} onChange={e => setNombre(e.target.value)} required
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                placeholder="Ej: Campaña Verano" />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-700 mb-1 block">Descripción (opcional)</label>
                            <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                placeholder="Descripción breve..." />
                        </div>
                    </div>

                    {/* Buscar productos */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1 block flex items-center gap-1">
                            <Package size={14} /> Agregar Productos al Combo
                        </label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                placeholder="Buscar producto por nombre o código..." />
                        </div>
                        {search.length > 0 && (
                            <div className="mt-1 border border-gray-200 rounded-lg max-h-44 overflow-y-auto bg-white shadow-lg z-10">
                                {filteredProducts.length === 0
                                    ? <p className="p-3 text-sm text-gray-500">Sin resultados.</p>
                                    : filteredProducts.slice(0, 10).map(p => (
                                        <button key={p.id} type="button"
                                            onClick={() => addProduct(p)}
                                            className="w-full text-left px-4 py-2 hover:bg-indigo-50 flex justify-between items-center border-b last:border-0">
                                            <span className="text-sm font-medium">{p.nombre}</span>
                                            <span className="text-xs text-indigo-600 font-bold">S/ {parseFloat(p.precioVenta).toFixed(2)}</span>
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Items seleccionados */}
                    {selectedItems.length > 0 && (
                        <div className="border border-indigo-100 rounded-xl overflow-hidden">
                            <div className="bg-indigo-50 px-4 py-2 flex justify-between text-xs font-bold text-indigo-700 uppercase">
                                <span>Producto</span><span className="flex gap-8"><span>Cant.</span><span>Subtotal</span></span>
                            </div>
                            {selectedItems.map(item => (
                                <div key={item.producto.id} className="px-4 py-2 flex items-center justify-between border-b last:border-0 bg-white">
                                    <span className="text-sm font-medium text-gray-800 flex-1">{item.producto.nombre}</span>
                                    <div className="flex items-center gap-3">
                                        <input type="number" min="1" value={item.cantidad}
                                            onChange={e => updateCantidad(item.producto.id, e.target.value)}
                                            className="w-16 text-center border border-gray-300 rounded-lg p-1 text-sm font-bold" />
                                        <span className="text-sm text-indigo-600 font-bold w-20 text-right">
                                            S/ {(item.producto.precioVenta * item.cantidad).toFixed(2)}
                                        </span>
                                        <button type="button" onClick={() => removeItem(item.producto.id)}
                                            className="text-red-400 hover:text-red-600"><X size={16} /></button>
                                    </div>
                                </div>
                            ))}
                            <div className="px-4 py-2 bg-gray-50 flex justify-between text-sm font-bold">
                                <span className="text-gray-600">Precio Normal Total:</span>
                                <span>S/ {precioNormal.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* Precio promo y descuento calculado */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-700 mb-1 block">Precio Promocional (S/) *</label>
                            <input type="number" step="0.01" min="0.01" value={precioPromo}
                                onChange={e => setPrecioPromo(e.target.value)} required
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-lg font-bold text-indigo-600"
                                placeholder="0.00" />
                        </div>
                        <div className="flex flex-col justify-end">
                            {precioPromo && selectedItems.length > 0 && (
                                <div className={`p-3 rounded-lg text-center ${descPct > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                    <p className="text-xs text-gray-500">Descuento</p>
                                    <p className={`text-2xl font-extrabold ${descPct > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {descPct > 0 ? `-${descPct}%` : `+${Math.abs(descPct)}%`}
                                    </p>
                                    <p className="text-xs text-gray-500">Ahorro: S/ {Math.max(0, precioNormal - parseFloat(precioPromo || 0)).toFixed(2)}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Estado activo */}
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setActivo(!activo)}
                            className={`transition-colors ${activo ? 'text-green-500' : 'text-gray-400'}`}>
                            {activo ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        </button>
                        <span className="text-sm font-medium text-gray-700">
                            Promoción {activo ? 'activa' : 'inactiva'}
                        </span>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertTriangle size={16} className="text-red-500" />
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" variant="primary" disabled={saving}>
                            {saving ? 'Guardando...' : editingPromo ? 'Actualizar Promoción' : 'Crear Promoción'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Promociones({ farmacia }) {
    const [promociones, setPromociones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchPromociones = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/promociones', { headers: { 'x-farmacia-id': farmacia.id } });
            setPromociones(data);
        } catch (err) {
            console.error('Error fetching promociones:', err);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchPromociones(); }, [farmacia.id]);

    const handleSave = async (payload, id) => {
        if (id) {
            await api.put(`/promociones/${id}`, payload, { headers: { 'x-farmacia-id': farmacia.id } });
        } else {
            await api.post('/promociones', payload, { headers: { 'x-farmacia-id': farmacia.id } });
        }
        await fetchPromociones();
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar esta promoción?')) return;
        await api.delete(`/promociones/${id}`, { headers: { 'x-farmacia-id': farmacia.id } });
        setPromociones(prev => prev.filter(p => p.id !== id));
    };

    const handleToggle = async (promo) => {
        try {
            await api.put(`/promociones/${promo.id}`,
                { ...promo, activo: !promo.activo, items: promo.items.map(i => ({ productoId: i.productoId, cantidad: i.cantidad })) },
                { headers: { 'x-farmacia-id': farmacia.id } }
            );
            setPromociones(prev => prev.map(p => p.id === promo.id ? { ...p, activo: !p.activo } : p));
        } catch (err) { console.error(err); }
    };

    const filtered = promociones.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                        <Tag size={30} className="text-indigo-600" /> Promociones
                    </h1>
                    <p className="text-gray-500 mt-1">Crea combos de productos con precio especial para tus clientes.</p>
                </div>
                <Button variant="primary" onClick={() => { setEditingPromo(null); setModalOpen(true); }}>
                    <Plus size={18} /> Nueva Promoción
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="bg-indigo-50 border border-indigo-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-indigo-600 font-semibold uppercase">Total</p>
                            <p className="text-2xl font-bold text-indigo-900">{promociones.length}</p>
                        </div>
                        <ShoppingBag size={28} className="text-indigo-300" />
                    </div>
                </Card>
                <Card className="bg-green-50 border border-green-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-green-600 font-semibold uppercase">Activas</p>
                            <p className="text-2xl font-bold text-green-900">{promociones.filter(p => p.activo).length}</p>
                        </div>
                        <ToggleRight size={28} className="text-green-300" />
                    </div>
                </Card>
                <Card className="bg-red-50 border border-red-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-red-600 font-semibold uppercase">Inactivas</p>
                            <p className="text-2xl font-bold text-red-900">{promociones.filter(p => !p.activo).length}</p>
                        </div>
                        <ToggleLeft size={28} className="text-red-300" />
                    </div>
                </Card>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-11 p-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="Buscar promociones..." />
            </div>

            {/* List */}
            {loading ? (
                <Card><div className="text-center py-12 text-gray-400">Cargando...</div></Card>
            ) : filtered.length === 0 ? (
                <Card>
                    <div className="text-center py-16">
                        <Tag size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-xl font-bold text-gray-500">Sin promociones</p>
                        <p className="text-gray-400 mt-1">Crea tu primera promoción para empezar.</p>
                        <Button variant="primary" className="mt-4" onClick={() => { setEditingPromo(null); setModalOpen(true); }}>
                            <Plus size={16} /> Crear Promoción
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filtered.map(promo => {
                        const precioNormal = promo.items.reduce((s, i) => s + i.producto.precioVenta * i.cantidad, 0);
                        const descPct = calcDescuento(precioNormal, promo.precioPromo);
                        return (
                            <Card key={promo.id} className={`border-2 transition-all ${promo.activo ? 'border-indigo-100 hover:border-indigo-300' : 'border-gray-100 opacity-70'}`}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-lg font-bold text-gray-900 truncate">{promo.nombre}</h3>
                                            {descPct > 0 && (
                                                <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <TrendingDown size={12} /> -{descPct}%
                                                </span>
                                            )}
                                        </div>
                                        {promo.descripcion && <p className="text-sm text-gray-500 mt-0.5">{promo.descripcion}</p>}
                                    </div>
                                    <button onClick={() => handleToggle(promo)}
                                        className={`ml-2 transition-colors ${promo.activo ? 'text-green-500 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`}>
                                        {promo.activo ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                                    </button>
                                </div>

                                {/* Products */}
                                <div className="space-y-1 mb-4">
                                    {promo.items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-50 last:border-0">
                                            <span className="text-gray-700">{item.cantidad}x {item.producto.nombre}</span>
                                            <span className="text-gray-500">S/ {(item.producto.precioVenta * item.cantidad).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Price */}
                                <div className="bg-indigo-50 rounded-xl p-3 flex justify-between items-center mb-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Precio Normal</p>
                                        <p className="text-sm font-semibold text-gray-500 line-through">S/ {precioNormal.toFixed(2)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-indigo-600">Precio Promo</p>
                                        <p className="text-xl font-extrabold text-indigo-700">S/ {promo.precioPromo.toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="flex-1"
                                        onClick={() => { setEditingPromo(promo); setModalOpen(true); }}>
                                        <Edit2 size={14} /> Editar
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDelete(promo.id)}>
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <PromoModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                farmacia={farmacia}
                editingPromo={editingPromo}
            />
        </div>
    );
}
