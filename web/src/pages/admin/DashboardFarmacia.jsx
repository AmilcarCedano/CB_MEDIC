import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Card, Button, Input } from './components/ui';
import {
  BarChart3, TrendingUp, Package, Users, ShoppingCart, AlertTriangle,
  Clock, DollarSign, RefreshCw, Calendar, ArrowUp, ArrowDown, CreditCard, FileText, Download
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import * as XLSX from 'xlsx';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const date = new Date(data.fecha);
    return (
      <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100 z-50">
        <p className="font-bold text-gray-900 mb-1 capitalize">
          {date.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })} • {date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <div className="text-sm text-gray-600 mb-2">
          <p>Comp: <span className="font-semibold text-gray-800">{data.comprobante}</span></p>
          <p>Cliente: <span className="font-semibold text-gray-800 truncate max-w-[150px] inline-block align-bottom">{data.cliente}</span></p>
        </div>
        <div className="pt-2 border-t border-gray-100 font-bold text-indigo-600 text-base">
          Total: S/ {data.total.toFixed(2)}
        </div>
      </div>
    );
  }
  return null;
};

const DashboardFarmacia = ({ farmacia }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [desde, setDesde] = useState(thirtyDaysAgo.toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(today.toISOString().slice(0, 10));

  const [inputDesde, setInputDesde] = useState(desde);
  const [inputHasta, setInputHasta] = useState(hasta);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ farmaciaId: farmacia.id });
      if (desde) params.append('desde', desde);
      if (hasta) params.append('hasta', hasta);
      const { data: result } = await api.get(`/dashboard/stats?${params}`);
      setData(result);
    } catch {
      setError('No se pudieron cargar las estadísticas.');
    } finally {
      setLoading(false);
    }
  }, [farmacia, desde, hasta]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAplicarFiltro = () => {
    setDesde(inputDesde);
    setHasta(inputHasta);
  };

  const setPreset = (days) => {
    const h = new Date();
    const d = new Date(h);
    d.setDate(d.getDate() - days);
    
    const dStr = d.toISOString().slice(0, 10);
    const hStr = h.toISOString().slice(0, 10);
    
    setInputDesde(dStr);
    setInputHasta(hStr);
    setDesde(dStr);
    setHasta(hStr);
  };

  const exportToExcel = () => {
    if (!data) return;
    const { kpis, ventasPorMetodo, topProductos } = data;

    const workbook = XLSX.utils.book_new();

    // Hoja de Resumen
    // Hoja General (Resumen + Detalle)
    const generalData = [
      ["REPORTE EJECUTIVO DE FARMACIA", farmacia.nombre.toUpperCase()],
      ["RANGO DE FECHAS", `${desde} AL ${hasta}`],
      ["", ""],
      ["RESUMEN FINANCIERO DEL PERIODO", ""],
      ["Monto Total Ventas (S/)", kpis.totalRevenue],
      ["Cantidad de Comprobantes", kpis.totalVentasPeriodo],
      ["", ""],
      ["DETALLE CRONOLÓGICO DE OPERACIONES", ""],
      ["FECHA", "HORA", "COMPROBANTE", "CLIENTE", "MÉTODO PAGO", "MONTO TOTAL (S/)"]
    ];

    // Agregar las filas de ventas detalladas
    (ventasDiarias || []).forEach(v => {
      const d = new Date(v.fecha);
      generalData.push([
        d.toLocaleDateString('es-PE'),
        d.toLocaleTimeString('es-PE'),
        v.comprobante,
        v.cliente,
        v.metodo,
        v.total
      ]);
    });

    const generalSheet = XLSX.utils.aoa_to_sheet(generalData);
    XLSX.utils.book_append_sheet(workbook, generalSheet, "General");

    // Mantener los desglose por pestaña para mejor orden si el usuario los necesita, 
    // pero el reporte principal ya tiene todo lo detallado.
    const paymentSheet = XLSX.utils.json_to_sheet(ventasPorMetodo.map(v => ({
      Metodo: v.metodo,
      Total: v.total,
      Transacciones: v.cantidad
    })));
    XLSX.utils.book_append_sheet(workbook, paymentSheet, "Metodos de Pago");

    const productsSheet = XLSX.utils.json_to_sheet(topProductos.map(p => ({
      Producto: p.nombre,
      Cantidad: p.cantidad
    })));
    XLSX.utils.book_append_sheet(workbook, productsSheet, "Top Productos");

    XLSX.writeFile(workbook, `Reporte_${farmacia.nombre}_${desde}_${hasta}.xlsx`);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col justify-center items-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
          <RefreshCw size={26} className="animate-spin text-white" />
        </div>
        <span className="text-gray-500 font-medium">Cargando dashboard...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="border border-red-100">
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-200">
            <AlertTriangle size={26} className="text-white" />
          </div>
          <p className="text-red-600 font-semibold">{error}</p>
          <Button variant="primary" size="sm" onClick={fetchData} className="flex items-center gap-1">
            <RefreshCw size={16} /> Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  const { kpis, ventasDiarias, ventasPorMetodo, topProductos, proximosVencer, stockBajo, topClientes } = data || {};

  const formatMoney = (n) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
            <BarChart3 size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{farmacia.nombre}</h2>
            <p className="text-xs sm:text-sm text-gray-500">RUC {farmacia.ruc} • {farmacia.direccion}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex gap-1 sm:border-r sm:pr-3 sm:border-gray-200">
            {[{ label: 'Hoy', days: 0 }, { label: '7D', days: 7 }, { label: '30D', days: 30 }].map(p => (
              <button
                key={p.label}
                onClick={() => setPreset(p.days)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-nowrap">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Desde:</span>
            <Input type="date" value={inputDesde} onChange={(e) => setInputDesde(e.target.value)} className="!py-1.5 !text-xs w-32" />
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Hasta:</span>
            <Input type="date" value={inputHasta} onChange={(e) => setInputHasta(e.target.value)} className="!py-1.5 !text-xs w-32" />
            <Button variant="primary" size="sm" onClick={handleAplicarFiltro} className="flex items-center gap-1 shadow-sm whitespace-nowrap">
              Aplicar
            </Button>
          </div>
          <div className="flex gap-1 sm:pl-2 sm:border-l sm:border-gray-200">
            <Button variant="outline" size="sm" onClick={exportToExcel} className="text-emerald-600 border border-emerald-200 hover:bg-emerald-50">
              <Download size={16} className="mr-1" /> Exportar Excel
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ventas Hoy</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <DollarSign size={18} className="text-indigo-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatMoney(kpis.ventasHoy)}</p>
            <p className="text-xs text-gray-400 mt-1">{kpis.ventasHoyCount} comprobantes</p>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ventas Período</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp size={18} className="text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatMoney(kpis.totalRevenue)}</p>
            <p className="text-xs text-gray-400 mt-1">{kpis.totalVentasPeriodo} ventas</p>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Productos</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Package size={18} className="text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{kpis.totalProductos}</p>
            <p className="text-xs text-gray-400 mt-1">{kpis.productosStockBajo} con stock bajo</p>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Clientes</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                <Users size={18} className="text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{kpis.totalClientes}</p>
            <p className="text-xs text-gray-400 mt-1">registrados</p>
          </div>
        </div>
      )}

      {/* Sales Chart + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Chart - Ventas Diarias (takes 2 cols) */}
        <Card className="lg:col-span-2 !shadow-sm border border-gray-100 !p-4 sm:!p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <TrendingUp size={18} className="text-indigo-600" />
            </span>
            Todas las Ventas del Período
          </h3>
          {ventasDiarias && ventasDiarias.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={ventasDiarias} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis 
                  dataKey="fecha" 
                  tick={{ fontSize: 11, fill: '#6b7280' }} 
                  tickFormatter={(v) => {
                    const date = new Date(v);
                    const diffDays = (new Date(hasta) - new Date(desde)) / (1000 * 60 * 60 * 24);
                    if (diffDays <= 3) {
                      return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                    }
                    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
                  }} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#6b7280' }} 
                  tickFormatter={(v) => `S/${v}`} 
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={<CustomTooltip />}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#6366f1" 
                  strokeWidth={2} 
                  fill="url(#colorTotal)" 
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }}
                  dot={{ r: 3, fill: '#ffffff', stroke: '#6366f1', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-60 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <BarChart3 size={28} className="text-gray-300" />
              <p className="text-sm font-medium">No hay datos de ventas en este período</p>
            </div>
          )}
        </Card>

        {/* Pie Chart - Por metodo */}
        <Card className="!shadow-sm border border-gray-100 !p-4 sm:!p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CreditCard size={18} className="text-emerald-600" />
            </span>
            Métodos de Pago según Período
          </h3>
          {ventasPorMetodo && ventasPorMetodo.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={ventasPorMetodo}
                    dataKey="total"
                    nameKey="metodo"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    strokeWidth={2}
                    paddingAngle={5}
                  >
                    {ventasPorMetodo.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(v, name) => [`S/ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, name]} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-2">
                {ventasPorMetodo.map((v, i) => (
                  <div key={v.metodo} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-700 font-medium truncate max-w-[100px]">{v.metodo}</span>
                    </div>
                    <div className="text-right flex flex-col">
                      <span className="font-bold text-gray-900 tabular-nums">S/ {Number(v.total).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-gray-500">{v.cantidad} transacc.</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-52 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <CreditCard size={28} className="text-gray-300" />
              <p className="text-sm font-medium">Sin datos disponibles</p>
            </div>
          )}
        </Card>
      </div>

      {/* Top Productos bar chart + Top Clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Top Productos */}
        <Card className="!shadow-sm border border-gray-100 !p-4 sm:!p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package size={18} className="text-blue-600" />
            </span>
            Top 10 Productos Más Vendidos
          </h3>
          {topProductos && topProductos.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProductos} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="nombre" type="category" width={120} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  formatter={(v) => [v, 'Unidades']}
                />
                <Bar dataKey="cantidad" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-60 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Package size={28} className="text-gray-300" />
              <p className="text-sm font-medium">Sin datos</p>
            </div>
          )}
        </Card>

        {/* Top Clientes */}
        <Card className="!shadow-sm border border-gray-100 !p-4 sm:!p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Users size={18} className="text-purple-600" />
            </span>
            Clientes Más Frecuentes
          </h3>
          {topClientes && topClientes.length > 0 ? (
            <div className="space-y-3">
              {topClientes.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-indigo-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{c.nombre}</p>
                      <p className="text-xs text-gray-400">{c.doc}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm tabular-nums">{formatMoney(c.total)}</p>
                    <p className="text-xs text-gray-400">{c.compras} compras</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-60 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Users size={28} className="text-gray-300" />
              <p className="text-sm font-medium">Sin datos de clientes</p>
            </div>
          )}
        </Card>
      </div>

      {/* Alertas: Próximos a vencer + Stock bajo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximos a vencer */}
        <Card className="!shadow-sm border border-gray-100 !p-4 sm:!p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle size={18} className="text-amber-600" />
            </span>
            Productos Próximos a Vencer
            {proximosVencer && proximosVencer.length > 0 && (
              <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">{proximosVencer.length}</span>
            )}
          </h3>
          {proximosVencer && proximosVencer.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {proximosVencer.map((p) => {
                const diasRestantes = Math.ceil((new Date(p.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24));
                const isExpired = diasRestantes <= 0;
                const isUrgent = diasRestantes <= 7;
                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${isExpired ? 'bg-red-50 border-red-500' : isUrgent ? 'bg-amber-50 border-amber-500' : 'bg-yellow-50 border-yellow-400'}`}>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{p.nombre}</p>
                      <p className="text-xs text-gray-400">{p.codigoBarras} • Stock: {p.stockActual}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isExpired ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-yellow-600'}`}>
                        {isExpired ? 'VENCIDO' : `${diasRestantes} días`}
                      </p>
                      <p className="text-xs text-gray-400">{new Date(p.fechaVencimiento).toLocaleDateString('es-PE')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-40 bg-emerald-50 rounded-xl border border-dashed border-emerald-200">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg">✓</div>
              <p className="text-sm font-medium text-emerald-700">No hay productos próximos a vencer</p>
            </div>
          )}
        </Card>

        {/* Stock bajo */}
        <Card className="!shadow-sm border border-gray-100 !p-4 sm:!p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <ArrowDown size={18} className="text-red-600" />
            </span>
            Productos con Stock Bajo
            {stockBajo && stockBajo.length > 0 && (
              <span className="ml-auto px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">{stockBajo.length}</span>
            )}
          </h3>
          {stockBajo && stockBajo.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {stockBajo.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border-l-4 border-red-400">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{p.nombre}</p>
                    <p className="text-xs text-gray-400">{p.codigoBarras}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600 tabular-nums">{p.stockActual}</p>
                    <p className="text-xs text-gray-400">Mín: {p.stockMinimo}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-40 bg-emerald-50 rounded-xl border border-dashed border-emerald-200">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg">✓</div>
              <p className="text-sm font-medium text-emerald-700">Todos los productos tienen stock suficiente</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DashboardFarmacia;
