import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { Card, Button, Input, Modal, Select } from './components/ui';
import { Search, Edit, Trash, Eye, Calendar, Tag, Check, X as CloseIcon } from 'lucide-react';

const BatchRow = ({ batch, isAdmin, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        lote: batch.lote || '',
        fechaVencimiento: batch.fechaVencimiento ? new Date(batch.fechaVencimiento).toISOString().split('T')[0] : ''
    });
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.put(`/products/${batch.id}`, editForm);
            setIsEditing(false);
            onUpdate();
        } catch (error) {
            alert(error.response?.data?.error || 'Error al actualizar el lote');
        } finally {
            setLoading(false);
        }
    };

    if (isEditing) {
        return (
            <tr className="border-t bg-indigo-50/30">
                <td className="p-2">
                    <input 
                        type="text" 
                        value={editForm.lote} 
                        onChange={(e) => setEditForm({...editForm, lote: e.target.value})}
                        className="w-full text-xs p-1 border rounded"
                        placeholder="Lote"
                    />
                </td>
                <td className="p-2 text-center font-bold text-gray-500">{batch.stockActual}</td>
                <td className="p-2">
                    <input 
                        type="date" 
                        value={editForm.fechaVencimiento} 
                        onChange={(e) => setEditForm({...editForm, fechaVencimiento: e.target.value})}
                        className="w-full text-xs p-1 border rounded"
                    />
                </td>
                <td className="p-2">
                    <div className="flex justify-center gap-1">
                        <button 
                            onClick={handleSave} 
                            disabled={loading}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                        >
                            <Check size={14} />
                        </button>
                        <button 
                            onClick={() => setIsEditing(false)} 
                            disabled={loading}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                        >
                            <CloseIcon size={14} />
                        </button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <tr className="border-t">
            <td className="p-2 font-mono text-indigo-600">{batch.lote || '---'}</td>
            <td className="p-2 text-center font-bold">{batch.stockActual}</td>
            <td className="p-2 text-gray-600">{batch.fechaVencimiento ? new Date(batch.fechaVencimiento).toLocaleDateString() : 'N/A'}</td>
            {isAdmin && (
                <td className="p-2 text-center">
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                        <Edit size={14} />
                    </button>
                </td>
            )}
        </tr>
    );
};

const Inventario = ({ farmacia, user }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [viewingBatchesProduct, setViewingBatchesProduct] = useState(null);
  const [categories, setCategories] = useState([]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/products?farmaciaId=${farmacia.id}`);
      setProducts(data);
    } catch (err) {
      setError('No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get(`/categories?farmaciaId=${farmacia.id}`);
      setCategories(data);
    } catch (err) {
      console.error("Error fetching categories", err);
    }
  };

  useEffect(() => {
    if (farmacia?.id) {
      fetchProducts();
      fetchCategories();
    }
  }, [farmacia]);

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const { id, ...data } = editingProduct;
      
      // Validar que no se reduzca el stock si no es admin
      const originalProduct = products.find(p => p.id === id);
      if (user?.role !== 'ADMIN' && originalProduct && Number(data.stockActual) < originalProduct.stockActual) {
        alert(`No tienes permiso para reducir el stock. Solo puedes aumentarlo. El stock actual es ${originalProduct.stockActual}.`);
        return;
      }

      await api.put(`/products/${id}`, { ...data, farmaciaId: farmacia.id });
      setEditingProduct(null);
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar el producto.');
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;

    try {
      await api.delete(`/products/${deletingProduct.id}`, { data: { farmaciaId: farmacia.id } });
      setDeletingProduct(null);
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar el producto.');
    }
  };

  // --- AGREGACION DE PRODUCTOS POR CODIGO DE BARRAS ---
  const aggregatedProducts = useMemo(() => {
    if (!products) return [];
    const map = new Map();
    const lowerSearch = searchTerm.toLowerCase();

    // 1. Agrupar todo primero sin filtrar para tener la lista completa de lotes por código
    const groups = new Map();
    products.forEach(p => {
        const key = p.codigoBarras || `no-barcode-${p.id}`;
        if (!groups.has(key)) {
            groups.set(key, { ...p, batches: [p], stockTotal: p.stockActual });
        } else {
            const g = groups.get(key);
            g.batches.push(p);
            g.stockActual += p.stockActual;
            // Mantener la fecha de vencimiento más próxima para mostrar en la lista principal
            if (p.fechaVencimiento && (!g.fechaVencimiento || new Date(p.fechaVencimiento) < new Date(g.fechaVencimiento))) {
                g.fechaVencimiento = p.fechaVencimiento;
            }
        }
    });

    // 2. Filtrar los grupos: Si algún lote dentro del grupo coincide con la búsqueda, mostrar el grupo
    return Array.from(groups.values()).filter(g => {
        if (!searchTerm) return true;
        // Coincide nombre o código de barras en el registro principal o en cualquiera de sus lotes
        const matchMain = g.nombre.toLowerCase().includes(lowerSearch) || (g.codigoBarras && g.codigoBarras.toLowerCase().includes(lowerSearch));
        const matchBatches = g.batches.some(b => b.lote && b.lote.toLowerCase().includes(lowerSearch));
        return matchMain || matchBatches;
    });
  }, [products, searchTerm]);

  return (
    <Card>
      <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Stock e Inventario Global</h2>
        <div className="relative">
          <Input
            placeholder="Buscar por nombre o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        </div>
        <Button variant="secondary" onClick={fetchProducts} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar Stock"}
        </Button>
      </div>

      <div className="overflow-x-auto">
        {loading && <p className="text-center p-8 text-gray-400">Actualizando niveles de inventario...</p>}
        {error && <p className="text-center p-4 text-red-500 font-medium">{error}</p>}
        {!loading && aggregatedProducts.length === 0 && (
          <p className="text-center p-8 text-gray-500">No se encontraron productos en el inventario.</p>
        )}
        {!loading && aggregatedProducts.length > 0 && (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 font-bold text-gray-700">Medicamento / Producto</th>
                <th className="text-left p-4 font-bold text-gray-700">Stock Total</th>
                <th className="text-left p-4 font-bold text-gray-700">Venc. Próximo</th>
                {user?.role === 'ADMIN' && <th className="text-left p-4 font-bold text-gray-700">Precio Venta</th>}
                <th className="text-center p-4 font-bold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedProducts.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-indigo-900">{p.nombre}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1"><Tag size={12} /> {p.categoria?.nombre} • {p.codigoBarras || 'Sin código'}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-sm font-black ${p.stockActual <= (p.stockMinimo || 0) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {p.stockActual}
                    </span>
                  </td>
                  <td className="p-4">
                    {p.fechaVencimiento ? (
                      <div className={`flex items-center gap-1 text-sm font-medium ${new Date(p.fechaVencimiento) < new Date(Date.now() + 60*24*60*60*1000) ? 'text-red-600' : 'text-gray-600'}`}>
                        <Calendar size={14} /> {new Date(p.fechaVencimiento).toLocaleDateString()}
                      </div>
                    ) : <span className="text-gray-400 text-xs">Sin fecha</span>}
                  </td>
                  {user?.role === 'ADMIN' && (
                    <td className="p-4 font-bold text-green-700">S/ {Number(p.precioVenta || 0).toFixed(2)}</td>
                  )}
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                       <button onClick={() => setViewingBatchesProduct(p)} className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors" title="Ver Lotes">
                          <Eye size={20} />
                       </button>
                       {user?.role === 'ADMIN' && (
                         <button onClick={() => setEditingProduct(p)} className="p-2 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors" title="Editar">
                           <Edit size={20} />
                         </button>
                       )}
                       {user?.role === 'ADMIN' && (
                         <button onClick={() => setDeletingProduct(p)} className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors" title="Eliminar">
                            <Trash size={20} />
                         </button>
                       )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL: VER TODOS LOS LOTES */}
      {(() => {
        // Encontrar el producto actualizado en la lista agregada para que el modal refleje los cambios en tiempo real
        const currentData = viewingBatchesProduct ? aggregatedProducts.find(p => (p.codigoBarras || `no-barcode-${p.id}`) === (viewingBatchesProduct.codigoBarras || `no-barcode-${viewingBatchesProduct.id}`)) : null;
        if (!currentData) return null;

        return (
          <Modal isOpen={true} onClose={() => setViewingBatchesProduct(null)} title={`Lotes de ${currentData.nombre}`}>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Se encontraron {currentData.batches.length} lotes para este producto.</p>
              <div className="overflow-hidden border rounded-lg">
                  <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                          <tr>
                              <th className="p-2 text-left">Lote</th>
                              <th className="p-2 text-center">Stock</th>
                              <th className="p-2 text-left">Vencimiento</th>
                              {user?.role === 'ADMIN' && <th className="p-2 text-center">Acciones</th>}
                          </tr>
                      </thead>
                      <tbody>
                          {currentData.batches.map((b) => (
                              <BatchRow key={b.id} batch={b} isAdmin={user?.role === 'ADMIN'} onUpdate={fetchProducts} />
                          ))}
                      </tbody>
                  </table>
              </div>
              <div className="flex justify-end pt-4">
                 <Button onClick={() => setViewingBatchesProduct(null)} variant="primary">Cerrar</Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* MODAL: EDITAR PRODUCTO */}
      {editingProduct && (
        <Modal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} title="Editar Información Maestra">
          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <Input label="Nombre" value={editingProduct.nombre} onChange={(e) => setEditingProduct({ ...editingProduct, nombre: e.target.value })} required />
            <Select label="Categoría" value={editingProduct.categoriaId} onChange={(e) => setEditingProduct({ ...editingProduct, categoriaId: Number(e.target.value) })} required>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Stock Actual (Total)" type="number" value={editingProduct.stockActual} onChange={(e) => setEditingProduct({ ...editingProduct, stockActual: Number(e.target.value) })} required />
              <Input label="Stock Mínimo" type="number" value={editingProduct.stockMinimo || 0} onChange={(e) => setEditingProduct({ ...editingProduct, stockMinimo: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {user?.role === 'ADMIN' && (
                <Input label="Precio de Costo (S/)" type="number" step="0.01" value={editingProduct.precioCosto || 0} onChange={(e) => setEditingProduct({ ...editingProduct, precioCosto: Number(e.target.value) })} />
              )}
              <Input label="Precio de Venta (S/)" type="number" step="0.01" value={editingProduct.precioVenta} onChange={(e) => setEditingProduct({ ...editingProduct, precioVenta: Number(e.target.value) })} required />
            </div>
            <Input label="Código de Barras" value={editingProduct.codigoBarras} onChange={(e) => setEditingProduct({ ...editingProduct, codigoBarras: e.target.value })} />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="secondary" onClick={() => setEditingProduct(null)}>Cancelar</Button>
              <Button type="submit">Guardar Cambios</Button>
            </div>
          </form>
        </Modal>
      )}

      {deletingProduct && (
        <Modal isOpen={!!deletingProduct} onClose={() => setDeletingProduct(null)} title="Confirmar Eliminación">
          <p className="text-gray-600">¿Estás seguro de que quieres eliminar este producto del sistema? Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setDeletingProduct(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDeleteProduct}>Eliminar permanentemente</Button>
          </div>
        </Modal>
      )}
    </Card>
  );
};

export default Inventario;
