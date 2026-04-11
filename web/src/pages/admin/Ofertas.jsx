import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit3, Zap, Award, Heart } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, Button, Input } from './components/ui';

const Select = ({ label, value, onChange, options, required = false, name = '' }) => (
  <div>
    {label && <label className="text-sm font-medium text-gray-700 mb-1 block">{label} {required && <span className="text-red-500">*</span>}</label>}
    <select
      value={value || ''}
      onChange={onChange}
      required={required}
      name={name}
      className="w-full p-3 border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    >
      <option value="">-- Seleccionar --</option>
      {options.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
    </select>
  </div>
);
const Modal = ({ isOpen, title, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {children}
      </Card>
    </div>
  );
};

const createEmptyRule = () => ({
  triggerProductoId: '',
  sugeridoProductoId: '',
  prioridad: 5,
  mensaje: '',
  activo: true,
});

const normalizeDecimal = (value, fallback) => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
};

const LoyaltySettings = ({ config, onChange, onSave, loading }) => (
  <Card>
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Award size={24} /> Puntos de Lealtad
        </h2>
        <p className="text-sm text-gray-500">Define cuántos soles se necesitan para sumar 1 punto y cuánto vale cada punto al canjearlo.</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        className={`px-4 py-2 text-sm font-semibold border ${config.activo ? 'bg-green-100 text-green-800 border-green-400' : 'bg-red-100 text-red-800 border-red-400'
          }`}
        onClick={() => onChange({ ...config, activo: !config.activo })}
      >
        {config.activo ? 'Programa activo' : 'Programa inactivo'}
      </Button>
    </div>
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      <Input
        label="Soles requeridos para sumar 1 punto"
        type="number"
        min="1"
        step="0.1"
        value={config.solesPorPunto}
        onChange={(e) => onChange({ ...config, solesPorPunto: e.target.value })}
        required
      />
      <Input
        label="Valor en S/ por punto canjeado"
        type="number"
        min="0.01"
        step="0.01"
        value={config.valorPorPunto}
        onChange={(e) => onChange({ ...config, valorPorPunto: e.target.value })}
        required
      />
      <Input
        label="Límite máx. puntos por compra (0 = sin límite)"
        type="number"
        min="0"
        value={config.maxPuntosCanje || 0}
        onChange={(e) => onChange({ ...config, maxPuntosCanje: e.target.value })}
        required
      />
    </div>
    <div className="mt-4 flex justify-end">
      <Button onClick={onSave} disabled={loading}>
        {loading ? 'Guardando...' : 'Guardar configuración'}
      </Button>
    </div>
  </Card>
);

export default function Ofertas({ farmacia }) {
  const [rules, setRules] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState(createEmptyRule());
  const [error, setError] = useState(null);
  const [loyaltyConfig, setLoyaltyConfig] = useState({ valorPorPunto: 0.10, solesPorPunto: 10, activo: true });
  const [loyaltySaving, setLoyaltySaving] = useState(false);

  const fetchAllData = async () => {
    if (!farmacia?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, productosRes, loyaltyRes] = await Promise.all([
        api.get('/ofertas', { headers: { 'x-farmacia-id': farmacia.id } }),
        api.get('/ofertas/productos', { headers: { 'x-farmacia-id': farmacia.id } }),
        api.get('/ofertas/lealtad', { headers: { 'x-farmacia-id': farmacia.id } }),
      ]);
      setRules(Array.isArray(rulesRes.data) ? rulesRes.data : []);
      setProductos(Array.isArray(productosRes.data) ? productosRes.data : []);
      setLoyaltyConfig({
        valorPorPunto: normalizeDecimal(loyaltyRes.data?.valorPorPunto, 0.10),
        solesPorPunto: normalizeDecimal(loyaltyRes.data?.solesPorPunto, 10),
        maxPuntosCanje: parseInt(loyaltyRes.data?.maxPuntosCanje || 0),
        activo: loyaltyRes.data?.activo !== false,
      });
    } catch (err) {
      console.error("Failed to fetch data for offers page", err);
      setError("❌ No se pudieron cargar los datos. Revisa el backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmacia?.id]);

  const productoOptions = useMemo(
    () =>
      productos.map(p => ({
        value: p.id,
        label: `${p.nombre}${p.presentacion ? ` (${p.presentacion})` : ''}`,
      })),
    [productos]
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (!formData.triggerProductoId || !formData.sugeridoProductoId) {
        setError("Selecciona los productos disparador y sugerido.");
        return;
      }
      const payload = {
        triggerProductoId: parseInt(formData.triggerProductoId),
        sugeridoProductoId: parseInt(formData.sugeridoProductoId),
        prioridad: parseInt(formData.prioridad),
        mensaje: formData.mensaje,
        activo: formData.activo,
      };
      if (editingRule) {
        await api.put(`/ofertas/${editingRule.id}`, payload, { headers: { 'x-farmacia-id': farmacia.id } });
      } else {
        await api.post('/ofertas', payload, { headers: { 'x-farmacia-id': farmacia.id } });
      }
      fetchAllData();
      setIsModalOpen(false);
      setEditingRule(null);
    } catch (err) {
      setError(err.response?.data?.error || "❌ No se pudo guardar la regla.");
    }
  };

  const handleRemove = async (id) => {
    if (window.confirm('¿Confirmas la eliminación de esta regla?')) {
      try {
        await api.delete(`/ofertas/${id}`, { headers: { 'x-farmacia-id': farmacia.id } });
        fetchAllData();
      } catch (err) {
        console.error(err);
        alert("❌ No se pudo eliminar la regla.");
      }
    }
  };

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData(createEmptyRule());
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      triggerProductoId: String(rule.triggerProductoId),
      sugeridoProductoId: String(rule.sugeridoProductoId),
      prioridad: rule.prioridad,
      mensaje: rule.mensaje,
      activo: rule.activo,
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleLoyaltySave = async () => {
    setLoyaltySaving(true);
    setError(null);
    try {
      await api.post('/ofertas/lealtad', loyaltyConfig, { headers: { 'x-farmacia-id': farmacia.id } });
    } catch (err) {
      console.error('Error saving loyalty config', err);
      setError(err.response?.data?.error || "❌ No se pudo guardar la configuración de lealtad.");
    } finally {
      setLoyaltySaving(false);
    }
  };

  if (!farmacia?.id) return <Card><p>⚙️ Seleccione una farmacia para gestionar sus ofertas.</p></Card>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3"><Heart size={32} className="text-indigo-600" /> Fidelización y Sugerencias</h1>
          <p className="text-gray-500 mt-1">Gestiona puntos de lealtad y sugerencias de venta cruzada en el POS.</p>
        </div>
        <Button variant="primary" onClick={handleOpenCreate} className="shadow-lg"><Plus size={18} /> Crear sugerencia</Button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <LoyaltySettings
        config={loyaltyConfig}
        onChange={setLoyaltyConfig}
        onSave={handleLoyaltySave}
        loading={loyaltySaving}
      />

      <Card>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Zap size={24} className="text-yellow-500" /> Lista de sugerencias configuradas ({rules.length})</h2>

        {loading ? (
          <div className="text-center py-8"><p className="text-gray-500">⏳ Cargando reglas...</p></div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-2">📭 Sin sugerencias de venta cruzada todavía</p>
            <p className="text-sm text-gray-400">Crea una sugerencia para que el sistema ofrezca complementos al vendedor</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Si compra...</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Sugerir...</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Mensaje</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Prioridad</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rules.map((rule) => (
                  <tr key={`rule-${rule.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                        {rule.triggerProducto?.nombre || `Producto #${rule.triggerProductoId}`}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full border bg-green-50 text-green-700 border-green-200">
                        {rule.sugeridoProducto?.nombre || `Producto #${rule.sugeridoProductoId}`}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600 italic max-w-xs truncate">"{rule.mensaje}"</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${rule.prioridad >= 8 ? 'bg-red-500' : rule.prioridad >= 5 ? 'bg-yellow-500' : 'bg-green-500'}`}>
                        {rule.prioridad}
                      </span>
                    </td>
                    <td className="p-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(rule)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-indigo-200 text-indigo-600 bg-white hover:bg-indigo-50 transition-colors"
                        title="Editar sugerencia"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(rule.id)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors"
                        title="Eliminar sugerencia"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} title={editingRule ? 'Editar sugerencia de venta' : 'Crear nueva sugerencia de venta'} onClose={() => setIsModalOpen(false)}>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-700"><strong>📋 Lógica:</strong> Cuando el cliente agrega el producto disparador, el sistema sugiere el producto configurado.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Select
              label="🎯 Producto disparador (Si el cliente compra...)"
              name="triggerProductoId"
              value={formData.triggerProductoId}
              onChange={handleFormChange}
              options={productoOptions}
              required
            />
            <Select
              label="💡 Producto sugerido (...agregar al carrito)"
              name="sugeridoProductoId"
              value={formData.sugeridoProductoId}
              onChange={handleFormChange}
              options={productoOptions}
              required
            />
          </div>

          <Input
            label="📝 Mensaje para el vendedor"
            name="mensaje"
            value={formData.mensaje}
            onChange={handleFormChange}
            required
            placeholder="Ej: Recuerda ofrecer un protector gástrico junto a este medicamento."
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">⭐ Prioridad (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                name="prioridad"
                value={formData.prioridad}
                onChange={handleFormChange}
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Mayor número = más urgente</p>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="activo"
                  checked={formData.activo}
                  onChange={handleFormChange}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium text-gray-700">✅ Activada</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">{editingRule ? 'Guardar Cambios' : 'Crear sugerencia'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
