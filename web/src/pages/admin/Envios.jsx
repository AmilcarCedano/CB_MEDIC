import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card, Button, Input, Modal } from './components/ui';
import { Plus, ArrowLeft, Eye, FileText, CheckCircle, Trash2, Clock } from 'lucide-react';
import ProductosStock from './ProductosStock';

const shipStatusMeta = {
  BORRADOR: { label: "Pendiente", classes: "bg-amber-100 text-amber-800" },
  COTIZADO: { label: "Cotizado", classes: "bg-blue-100 text-blue-800" },
  APLICADO: { label: "Aplicado", classes: "bg-green-100 text-green-800" },
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
    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
      <Clock size={10} /> {timeLeft}
    </div>
  );
};

const Envios = ({ farmacia, user }) => {
  const [view, setView] = useState('list'); // 'list', 'new', 'details'
  const [selectedEnvio, setSelectedEnvio] = useState(null);
  const [envios, setEnvios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quoteTarget, setQuoteTarget] = useState(null);
  const [quoteValue, setQuoteValue] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchEnvios = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/envios?farmaciaId=${farmacia.id}`);
      setEnvios(data);
    } catch (err) {
      setError('No se pudieron cargar los envíos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'list') {
      fetchEnvios();
    }
  }, [farmacia, view]);

  const handleQuoteSubmit = async (event) => {
    event.preventDefault();
    if (!quoteTarget) return;
    const amount = Number(quoteValue);
    if (Number.isNaN(amount) || amount < 0) {
      setError("Ingresa un monto de envio valido.");
      return;
    }
    setQuoteLoading(true);
    try {
      await api.post(`/envios/${quoteTarget.id}/quote`, { shippingCost: amount });
      fetchEnvios();
      setQuoteTarget(null);
    } catch (err) {
      setError(err?.response?.data?.error || "No se pudo registrar la cotizacion.");
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleConfirmShipment = async (envioId) => {
    setConfirmingId(envioId);
    setError(null);
    try {
      await api.post(`/envios/${envioId}/confirm`);
      fetchEnvios();
    } catch (err) {
      setError(err?.response?.data?.error || "No se pudo confirmar el envio.");
    } finally {
      setConfirmingId(null);
    }
  };

    const handleDeleteSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setDeleteLoading(true);
    try {
      await api.delete(`/envios/${deleteTarget.id}?password=${encodeURIComponent(deletePassword)}`);
      fetchEnvios();
      setDeleteTarget(null);
      setDeletePassword("");
    } catch (err) {
      setError(err?.response?.data?.error || "No se pudo eliminar el ingreso.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (view === 'new') {
    return <ProductosStock farmacia={farmacia} onBack={() => setView('list')} />;
  }

  if (view === 'details' && selectedEnvio) {
    const meta = shipStatusMeta[selectedEnvio.estado] || shipStatusMeta.BORRADOR;
    const totalProductos = selectedEnvio.items.length;
    const totalStock = selectedEnvio.items.reduce((sum, item) => sum + (item.payload?.stockActual || 0), 0);
    const totalCosto = selectedEnvio.items.reduce((sum, item) => sum + ((item.payload?.precioCosto || 0) * (item.payload?.stockActual || 0)), 0);
    const totalVenta = selectedEnvio.items.reduce((sum, item) => sum + ((item.payload?.precioVenta || 0) * (item.payload?.stockActual || 0)), 0);

    return (
      <div className="space-y-6">
        <Button onClick={() => setView('list')} variant="outline">
          <ArrowLeft className="mr-2" size={18} /> Volver a la lista
        </Button>

        <Card>
          <div className="border-b pb-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-bold text-gray-900">{selectedEnvio.titulo}</h2>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${meta.classes}`}>
                {meta.label}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-600 font-medium">Total Productos</p>
                <p className="text-2xl font-bold text-blue-900">{totalProductos}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-xs text-green-600 font-medium">Stock Total</p>
                <p className="text-2xl font-bold text-green-900">{totalStock}</p>
              </div>
              {user?.role === 'ADMIN' && (
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">Valor Costo</p>
                  <p className="text-2xl font-bold text-purple-900">S/ {totalCosto.toFixed(2)}</p>
                </div>
              )}
              <div className="bg-amber-50 p-3 rounded-lg">
                <p className="text-xs text-amber-600 font-medium">Valor Venta</p>
                <p className="text-2xl font-bold text-amber-900">S/ {totalVenta.toFixed(2)}</p>
              </div>
            </div>
            {selectedEnvio.shippingCost && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Costo de Envío: <span className="font-bold text-gray-900">S/ {Number(selectedEnvio.shippingCost).toFixed(2)}</span></p>
              </div>
            )}
            <div className="mt-4 text-sm text-gray-500">
              <p>Fecha de creación: <span className="font-medium text-gray-700">{new Date(selectedEnvio.createdAt).toLocaleString('es-PE')}</span></p>
              {selectedEnvio.appliedAt && (
                <p>Fecha de aplicación: <span className="font-medium text-gray-700">{new Date(selectedEnvio.appliedAt).toLocaleString('es-PE')}</span></p>
              )}
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-4">Productos Registrados</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">#</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">Código</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">Nombre</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">Categoría</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">Stock</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">Stock Mín</th>
                  {user?.role === 'ADMIN' && <th className="text-left p-3 text-sm font-semibold text-gray-700">P. Costo</th>}
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">P. Venta</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selectedEnvio.items.map((item, index) => {
                  const payload = item.payload || {};
                  const subtotalCosto = (payload.precioCosto || 0) * (payload.stockActual || 0);
                  const subtotalVenta = (payload.precioVenta || 0) * (payload.stockActual || 0);

                  return (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-sm text-gray-600">{index + 1}</td>
                      <td className="p-3 text-sm font-mono text-gray-700">{payload.codigoBarras || '-'}</td>
                      <td className="p-3">
                        <div className="font-semibold text-gray-900">{payload.nombre || '-'}</div>
                        {payload.principioActivo && (
                          <div className="text-xs text-gray-500">{payload.principioActivo}</div>
                        )}
                        {payload.presentacion && (
                          <div className="text-xs text-gray-500">{payload.presentacion}</div>
                        )}
                      </td>
                      <td className="p-3 text-sm text-gray-600">{payload.categoriaNombre || '-'}</td>
                      <td className="p-3 text-sm">
                        <span className="font-bold text-gray-900">{payload.stockActual || 0}</span>
                      </td>
                      <td className="p-3 text-sm text-gray-500">{payload.stockMinimo || '-'}</td>
                      {user?.role === 'ADMIN' && (
                        <td className="p-3 text-sm text-gray-700">S/ {Number(payload.precioCosto || 0).toFixed(2)}</td>
                      )}
                      <td className="p-3 text-sm font-semibold text-gray-900">S/ {Number(payload.precioVenta || 0).toFixed(2)}</td>
                      <td className="p-3 text-sm">
                        {user?.role === 'ADMIN' && <div className="text-gray-600">C: S/ {subtotalCosto.toFixed(2)}</div>}
                        <div className="font-semibold text-gray-900">V: S/ {subtotalVenta.toFixed(2)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-gray-50 font-bold">
                  <td colSpan="4" className="p-3 text-right text-gray-700">TOTALES:</td>
                  <td className="p-3 text-gray-900">{totalStock}</td>
                  <td className="p-3"></td>
                  {user?.role === 'ADMIN' && <td className="p-3"></td>}
                  <td className="p-3"></td>
                  <td className="p-3">
                    {user?.role === 'ADMIN' && <div className="text-purple-700">C: S/ {totalCosto.toFixed(2)}</div>}
                    <div className="text-amber-700">V: S/ {totalVenta.toFixed(2)}</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {(selectedEnvio.items.some(item => item.payload?.lote) || selectedEnvio.items.some(item => item.payload?.fechaVencimiento)) ? (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Información Adicional</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedEnvio.items.some(item => item.payload?.lote) && (
                  <div>
                    <p className="text-blue-700 font-medium">Productos con Lote:</p>
                    {selectedEnvio.items.filter(item => item.payload?.lote).map((item, idx) => (
                      <p key={idx} className="text-blue-600">• {item.payload.nombre}: {item.payload.lote}</p>
                    ))}
                  </div>
                )}
                {selectedEnvio.items.some(item => item.payload?.fechaVencimiento) && (
                  <div>
                    <p className="text-blue-700 font-medium">Productos con Vencimiento:</p>
                    {selectedEnvio.items.filter(item => item.payload?.fechaVencimiento).map((item, idx) => (
                      <p key={idx} className="text-blue-600">• {item.payload.nombre}: {new Date(item.payload.fechaVencimiento).toLocaleDateString('es-PE')}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Ingresos</h2>
        <Button onClick={() => setView('new')}>
          <Plus className="mr-2" size={18} />
          Registrar Nuevo Ingreso
        </Button>
      </div>
      <Card>
        {loading && <p>Cargando envíos...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">Título</th>
                  <th className="text-left p-4">Estado</th>
                  <th className="text-left p-4">Items</th>
                  {user?.role === 'ADMIN' && <th className="text-left p-4">Costo</th>}
                  <th className="text-left p-4">Fecha / Expira</th>
                  <th className="text-left p-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {envios
                  .filter(env => {
                    if (user?.role === 'ADMIN') return true;
                    const created = new Date(env.createdAt).getTime();
                    return (created + 24 * 60 * 60 * 1000) > Date.now();
                  })
                  .map((envio) => {
                  const meta = shipStatusMeta[envio.estado] || shipStatusMeta.BORRADOR;
                  return (
                    <tr key={envio.id} className="border-b">
                      <td className="p-4">{envio.titulo}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${meta.classes}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-4">{envio.items.length}</td>
                      {user?.role === 'ADMIN' && (
                        <td className="p-4">{envio.shippingCost ? `S/ ${Number(envio.shippingCost).toFixed(2)}` : 'N/A'}</td>
                      )}
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{new Date(envio.createdAt).toLocaleDateString()}</span>
                          {user?.role === 'VENDEDOR' && <ExpiryTimer createdAt={envio.createdAt} />}
                        </div>
                      </td>
                      <td className="p-4 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setSelectedEnvio(envio);
                          setView('details');
                        }}>
                          <Eye size={16} />
                        </Button>
                        {envio.estado === 'BORRADOR' && (
                          <Button 
                            variant="success" 
                            size="sm" 
                            onClick={() => handleConfirmShipment(envio.id)}
                            disabled={confirmingId === envio.id}
                            title="Aceptar Ingreso"
                          >
                            <CheckCircle size={16} /> Aceptar
                          </Button>
                        )}
                        {user?.role === 'ADMIN' && (
                          <Button 
                            variant="danger" 
                            size="sm" 
                            onClick={() => setDeleteTarget(envio)}
                            title="Eliminar y Revertir Ingreso"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {quoteTarget && (
        <Modal
          isOpen={!!quoteTarget}
          onClose={() => setQuoteTarget(null)}
          title={`Registrar Cotización para: ${quoteTarget.titulo}`}
        >
          <form onSubmit={handleQuoteSubmit} className="space-y-4">
            <Input
              label="Monto del Envío (S/)"
              type="number"
              step="0.01"
              value={quoteValue}
              onChange={(e) => setQuoteValue(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setQuoteTarget(null)}>Cancelar</Button>
              <Button type="submit" disabled={quoteLoading}>
                {quoteLoading ? 'Guardando...' : 'Guardar Cotización'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => {
            setDeleteTarget(null);
            setDeletePassword("");
          }}
          title={`Eliminar Ingreso: ${deleteTarget.titulo}`}
        >
          <form onSubmit={handleDeleteSubmit} className="space-y-4">
            <p className="text-sm text-red-600 font-semibold mb-2">
              Esta acción no se puede deshacer. Se purgarán todos los datos del ingreso y, si el ingreso ya fue aplicado al inventario, el stock añadido será descontado automáticamente.
            </p>
            <Input
              label="Contraseña de Autorización"
              type="password"
              placeholder="Contraseña del administrador"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button type="submit" variant="danger" disabled={deleteLoading}>
                {deleteLoading ? "Eliminando..." : "Eliminar Permanentemente"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Envios;

