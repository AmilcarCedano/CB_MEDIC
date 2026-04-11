import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Card, Button, Input, Select } from './components/ui';
import {
  Shield, Search, ChevronLeft, ChevronRight, Clock,
  User, ShoppingCart, Package, LogIn, Trash2, Edit,
  CheckCircle, AlertTriangle, RefreshCw, Filter, X
} from 'lucide-react';

const MODULOS = [
  { value: '', label: 'Todos los módulos' },
  { value: 'VENTAS', label: 'Ventas' },
  { value: 'INVENTARIO', label: 'Inventario' },
  { value: 'INGRESOS', label: 'Ingresos' },
  { value: 'USUARIOS', label: 'Usuarios' },
  { value: 'AUTENTICACION', label: 'Autenticación' },
  { value: 'CLIENTES', label: 'Clientes' },
  { value: 'CAJA', label: 'Caja' },
];

const ACCIONES = [
  { value: '', label: 'Todas las acciones' },
  { value: 'CREAR', label: 'Crear' },
  { value: 'EDITAR', label: 'Editar' },
  { value: 'ELIMINAR', label: 'Eliminar' },
  { value: 'CONFIRMAR', label: 'Confirmar' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'DEVOLUCION', label: 'Devolución' },
  { value: 'ANULAR', label: 'Anular' },
];

const accionConfig = {
  CREAR: { icon: <CheckCircle size={14} />, color: 'bg-green-100 text-green-800', border: 'border-green-300' },
  EDITAR: { icon: <Edit size={14} />, color: 'bg-blue-100 text-blue-800', border: 'border-blue-300' },
  ELIMINAR: { icon: <Trash2 size={14} />, color: 'bg-red-100 text-red-800', border: 'border-red-300' },
  CONFIRMAR: { icon: <CheckCircle size={14} />, color: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-300' },
  LOGIN: { icon: <LogIn size={14} />, color: 'bg-purple-100 text-purple-800', border: 'border-purple-300' },
  DEVOLUCION: { icon: <RefreshCw size={14} />, color: 'bg-amber-100 text-amber-800', border: 'border-amber-300' },
  ANULAR: { icon: <AlertTriangle size={14} />, color: 'bg-red-100 text-red-800', border: 'border-red-300' },
};

const moduloConfig = {
  VENTAS: { icon: <ShoppingCart size={14} />, color: 'text-blue-700' },
  INVENTARIO: { icon: <Package size={14} />, color: 'text-teal-700' },
  INGRESOS: { icon: <Package size={14} />, color: 'text-indigo-700' },
  USUARIOS: { icon: <User size={14} />, color: 'text-purple-700' },
  AUTENTICACION: { icon: <LogIn size={14} />, color: 'text-gray-700' },
  CLIENTES: { icon: <User size={14} />, color: 'text-orange-700' },
  CAJA: { icon: <ShoppingCart size={14} />, color: 'text-green-700' },
};

const RegistroAuditoria = ({ farmacia, user }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [stats, setStats] = useState(null);

  const [filters, setFilters] = useState({
    modulo: '',
    accion: '',
    desde: '',
    hasta: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ farmaciaId: farmacia.id, page, limit: 30 });
      if (filters.modulo) params.append('modulo', filters.modulo);
      if (filters.accion) params.append('accion', filters.accion);
      if (filters.desde) params.append('desde', filters.desde);
      if (filters.hasta) params.append('hasta', filters.hasta);

      const { data } = await api.get(`/auditoria?${params}`);
      setLogs(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError('No se pudo cargar el registro de auditoría.');
    } finally {
      setLoading(false);
    }
  }, [farmacia, filters]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get(`/auditoria/stats?farmaciaId=${farmacia.id}`);
      setStats(data);
    } catch (e) { /* silently fail */ }
  }, [farmacia]);

  useEffect(() => {
    fetchLogs(1);
    fetchStats();
  }, [fetchLogs, fetchStats]);

  const clearFilters = () => {
    setFilters({ modulo: '', accion: '', desde: '', hasta: '', search: '' });
  };

  const filteredLogs = filters.search
    ? logs.filter(log =>
        log.descripcion?.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.usuario?.fullName?.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.modulo?.toLowerCase().includes(filters.search.toLowerCase())
      )
    : logs;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const hasActiveFilters = filters.modulo || filters.accion || filters.desde || filters.hasta;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={24} className="text-indigo-600" />
            Registro de Auditoría
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Control y seguimiento de todas las acciones realizadas en la farmacia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={16} className="mr-1" />
            Filtros {hasActiveFilters && <span className="ml-1 px-1.5 py-0.5 bg-indigo-600 text-white text-xs rounded-full">!</span>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { fetchLogs(1); fetchStats(); }}>
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      {/* Active Shifts Monitor for Admin */}
      {user?.role === 'ADMIN' && (
        <ActiveShiftsMonitor farmacia={farmacia} />
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
            <p className="text-xs text-indigo-600 font-semibold uppercase">Acciones Hoy</p>
            <p className="text-3xl font-bold text-indigo-900 mt-1">{stats.totalHoy}</p>
          </div>
          {stats.porModulo?.slice(0, 3).map((m, i) => {
            const cfgM = moduloConfig[m.modulo] || { color: 'text-gray-700' };
            const colors = ['from-blue-50 to-blue-100 border-blue-200', 'from-green-50 to-green-100 border-green-200', 'from-amber-50 to-amber-100 border-amber-200'];
            return (
              <div key={m.modulo} className={`bg-gradient-to-br ${colors[i]} rounded-xl p-4 border`}>
                <p className={`text-xs font-semibold uppercase ${cfgM.color}`}>{m.modulo}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{m.count}</p>
                <p className="text-xs text-gray-500">registros totales</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">Filtros Avanzados</h3>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X size={14} className="mr-1" /> Limpiar
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label="Módulo"
              value={filters.modulo}
              onChange={(e) => setFilters({ ...filters, modulo: e.target.value })}
            >
              {MODULOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
            <Select
              label="Acción"
              value={filters.accion}
              onChange={(e) => setFilters({ ...filters, accion: e.target.value })}
            >
              {ACCIONES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Select>
            <Input
              label="Desde"
              type="date"
              value={filters.desde}
              onChange={(e) => setFilters({ ...filters, desde: e.target.value })}
            />
            <Input
              label="Hasta"
              type="date"
              value={filters.hasta}
              onChange={(e) => setFilters({ ...filters, hasta: e.target.value })}
            />
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar en registros..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
      </div>

      {/* Error */}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Logs Timeline */}
      <Card>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <RefreshCw size={24} className="animate-spin text-indigo-500" />
            <span className="ml-2 text-gray-500">Cargando registros...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Shield size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No se encontraron registros</p>
            <p className="text-sm">Los eventos de auditoría aparecerán aquí conforme se registren acciones.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => {
              const ac = accionConfig[log.accion] || { icon: <Clock size={14} />, color: 'bg-gray-100 text-gray-800', border: 'border-gray-300' };
              const mc = moduloConfig[log.modulo] || { icon: null, color: 'text-gray-600' };
              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-all border-l-4 ${ac.border}`}
                >
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${ac.color}`}>
                    {ac.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${ac.color}`}>
                        {log.accion}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${mc.color}`}>
                        {mc.icon} {log.modulo}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 leading-snug">{log.descripcion}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} />
                        {formatDate(log.fecha)} {formatTime(log.fecha)}
                      </span>
                      {log.usuario && (
                        <span className="inline-flex items-center gap-1">
                          <User size={11} />
                          {log.usuario.fullName} ({log.usuario.role})
                        </span>
                      )}
                      {log.ip && (
                        <span className="text-gray-300">IP: {log.ip}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <p className="text-sm text-gray-500">
              Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1)}
              >
                <ChevronLeft size={16} /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLogs(pagination.page + 1)}
              >
                Siguiente <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

const ActiveShiftsMonitor = ({ farmacia }) => {
  const [monitorData, setMonitorData] = useState({ turnosActivos: [], hayTurnosAbiertos: false });
  const [loading, setLoading] = useState(false);

  const fetchMonitor = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/caja/monitor', { headers: { 'x-farmacia-id': farmacia.id } });
      setMonitorData(data);
    } catch (error) {
      console.error('Error fetching monitor:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitor();
  }, [farmacia.id]);

  if (!monitorData.hayTurnosAbiertos && !loading) return null;

  return (
    <Card className="border-green-200 bg-green-50/30">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Clock size={18} className="text-green-600" />
          Cajas Abiertas Actualmente
        </h3>
        <Button variant="outline" size="sm" onClick={fetchMonitor} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {monitorData.turnosActivos.map(t => {
          const total = parseFloat(t.montoInicial) + parseFloat(t.montoVentas) - parseFloat(t.montoEgresos);
          return (
            <div key={t.id} className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-sm text-gray-900">{t.usuario.fullName}</p>
                  <p className="text-xs text-gray-500">Abierto: {new Date(t.fechaApertura).toLocaleTimeString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded-full uppercase">Activo</span>
              </div>
              <div className="mt-2 pt-2 border-t flex justify-between items-center text-sm">
                <span className="text-gray-600">En Caja:</span>
                <span className="font-bold text-green-600">S/ {total.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default RegistroAuditoria;
