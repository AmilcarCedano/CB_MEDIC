import React, { useState, useEffect } from 'react';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Lock,
    Unlock,
    Clock,
    FileText,
    User,
    Calendar,
    AlertCircle,
    CheckCircle,
    X,
    Plus,
    Eye,
    Shield,
    Edit
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card, Button, Input, Modal } from './components/ui';

// Fila de una tabla del resumen (medicamento, servicio o devolución), con
// badge opcional (promo / nombre editado / devuelto) debajo del nombre.
const FilaResumen = ({ nombre, cantidad, precioUnitario, total, badges }) => (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-3 py-2.5 text-sm bg-white">
        <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{nombre}</p>
            {badges}
        </div>
        <span className="text-gray-500 tabular-nums text-right">{cantidad}</span>
        <span className="text-gray-500 tabular-nums text-right">S/{precioUnitario.toFixed(2)}</span>
        <span className="font-bold text-gray-900 tabular-nums text-right">S/{total.toFixed(2)}</span>
    </div>
);

// Tabla genérica (encabezado + filas con scroll) reutilizada por cada sección.
const TablaResumen = ({ titulo, colorClasses, headerCols, children, maxH = "max-h-64" }) => (
    <div className="rounded-xl border border-gray-200 overflow-hidden h-full flex flex-col">
        <div className={`px-3 py-2 ${colorClasses}`}>
            <p className="text-xs font-bold uppercase tracking-wide">{titulo}</p>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
            {headerCols}
        </div>
        <div className={`${maxH} overflow-y-auto divide-y divide-gray-100 flex-1`}>
            {children}
        </div>
    </div>
);

// Detalle de lo vendido en un turno: totales + listas de qué se vendió, a qué
// precio, si vino de una promoción, si se editó el nombre, y si tuvo una
// devolución después. Se usa en la vista previa, el resumen final de cierre,
// y en el Historial de Cierres (turnos pasados) — un solo lugar para los tres.
const ResumenDetalle = ({ resumen }) => {
    const {
        resumenVentas,
        detalleMedicamentos = [],
        detalleServicios = [],
        detallePromociones = [],
        detalleDevoluciones = [],
        detalleEgresos = [],
        desglosePagos = [],
    } = resumen;
    const hayDevoluciones = (resumenVentas?.unidadesDevueltas ?? 0) > 0;

    return (
        <div className="space-y-5">
            <div className={`grid grid-cols-2 ${hayDevoluciones ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 text-center`}>
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <p className="text-3xl font-black text-indigo-800 tabular-nums">{resumenVentas?.medicamentosVendidos ?? 0}</p>
                    <p className="text-xs text-indigo-600 font-semibold mt-1">Medicamentos vendidos</p>
                    {resumenVentas?.medicamentosDevueltos > 0 && (
                        <p className="text-[10px] text-red-600 font-bold mt-0.5">↩️ {resumenVentas.medicamentosDevueltos} devuelto(s)</p>
                    )}
                </div>
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-3xl font-black text-amber-800 tabular-nums">{resumenVentas?.serviciosRealizados ?? 0}</p>
                    <p className="text-xs text-amber-600 font-semibold mt-1">Servicios realizados</p>
                    {resumenVentas?.serviciosDevueltos > 0 && (
                        <p className="text-[10px] text-red-600 font-bold mt-0.5">↩️ {resumenVentas.serviciosDevueltos} devuelto(s)</p>
                    )}
                </div>
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                    <p className="text-3xl font-black text-rose-800 tabular-nums">{resumenVentas?.promocionesVendidas ?? 0}</p>
                    <p className="text-xs text-rose-600 font-semibold mt-1">Promociones vendidas</p>
                </div>
                {hayDevoluciones && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-3xl font-black text-red-700 tabular-nums">{resumenVentas.unidadesDevueltas}</p>
                        <p className="text-xs text-red-600 font-semibold mt-1">Unidades devueltas (-S/{resumenVentas.montoDevuelto.toFixed(2)})</p>
                    </div>
                )}
            </div>

            {(detalleMedicamentos.length > 0 || detalleServicios.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {detalleMedicamentos.length > 0 && (
                        <TablaResumen
                            titulo="Medicamentos vendidos"
                            colorClasses="bg-indigo-50 text-indigo-700"
                            headerCols={<><span>Producto</span><span className="text-right">Cant.</span><span className="text-right">P. Unit</span><span className="text-right">Total</span></>}
                        >
                            {detalleMedicamentos.map((m, idx) => (
                                <FilaResumen
                                    key={idx}
                                    nombre={m.nombre}
                                    cantidad={m.cantidad}
                                    precioUnitario={m.precioUnitario}
                                    total={m.total}
                                    badges={
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {m.promoNombre && (
                                                <span title={`Promoción: ${m.promoNombre}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700">🏷️ Promo</span>
                                            )}
                                            {m.cantidadDevuelta && (
                                                <span title={m.motivoDevolucion || undefined} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700">↩️ {m.cantidadDevuelta} devuelto(s) · -S/{m.montoDevuelto.toFixed(2)}</span>
                                            )}
                                        </div>
                                    }
                                />
                            ))}
                        </TablaResumen>
                    )}

                    {detalleServicios.length > 0 && (
                        <TablaResumen
                            titulo="Servicios realizados"
                            colorClasses="bg-amber-50 text-amber-700"
                            headerCols={<><span>Servicio</span><span className="text-right">Cant.</span><span className="text-right">P. Unit</span><span className="text-right">Total</span></>}
                        >
                            {detalleServicios.map((s, idx) => (
                                <FilaResumen
                                    key={idx}
                                    nombre={s.nombre}
                                    cantidad={s.cantidad}
                                    precioUnitario={s.precioUnitario}
                                    total={s.total}
                                    badges={
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {s.nombreOriginal && (
                                                <span title={`Nombre original: ${s.nombreOriginal}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700">✏️ Editado</span>
                                            )}
                                            {s.cantidadDevuelta && (
                                                <span title={s.motivoDevolucion || undefined} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700">↩️ {s.cantidadDevuelta} devuelto(s) · -S/{s.montoDevuelto.toFixed(2)}</span>
                                            )}
                                        </div>
                                    }
                                />
                            ))}
                        </TablaResumen>
                    )}
                </div>
            )}

            {(detallePromociones.length > 0 || detalleDevoluciones.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {detallePromociones.length > 0 && (
                        <div className="rounded-xl border border-rose-200 overflow-hidden">
                            <div className="px-3 py-2 bg-rose-100"><p className="text-xs font-bold uppercase tracking-wide text-rose-700">Promociones aplicadas</p></div>
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 bg-rose-50 text-[10px] font-bold text-rose-600 uppercase tracking-wide">
                                <span>Promoción</span><span className="text-right">Vendidas</span><span className="text-right">Monto neto</span>
                            </div>
                            <div className="divide-y divide-rose-100 max-h-40 overflow-y-auto">
                                {detallePromociones.map((p, idx) => (
                                    <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-3 py-2.5 text-sm bg-white">
                                        <span className="font-medium text-rose-900 truncate">{p.nombre}</span>
                                        <span className="text-rose-700 tabular-nums text-right">x{p.cantidad}</span>
                                        <span className="text-rose-700 font-bold tabular-nums text-right">S/{(p.monto ?? 0).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {detalleDevoluciones.length > 0 && (
                        <div className="rounded-xl border border-red-200 overflow-hidden">
                            <div className="px-3 py-2 bg-red-100"><p className="text-xs font-bold uppercase tracking-wide text-red-700">Devoluciones del turno</p></div>
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 bg-red-50 text-[10px] font-bold text-red-600 uppercase tracking-wide">
                                <span>Producto/Servicio</span><span className="text-right">Cant.</span><span className="text-right">Monto</span>
                            </div>
                            <div className="divide-y divide-red-100 max-h-40 overflow-y-auto">
                                {detalleDevoluciones.map((d, idx) => (
                                    <div key={idx} title={d.motivo || undefined} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-3 py-2.5 text-sm bg-white">
                                        <span className="font-medium text-red-900 truncate">{d.nombre}</span>
                                        <span className="text-red-700 tabular-nums text-right">x{d.cantidad}</span>
                                        <span className="text-red-700 font-bold tabular-nums text-right">-S/{d.monto.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {(detalleEgresos.length > 0 || desglosePagos.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {detalleEgresos.length > 0 && (
                        <div className="rounded-xl border border-orange-200 overflow-hidden">
                            <div className="px-3 py-2 bg-orange-100"><p className="text-xs font-bold uppercase tracking-wide text-orange-700">Egresos del turno (retiros de caja)</p></div>
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 bg-orange-50 text-[10px] font-bold text-orange-600 uppercase tracking-wide">
                                <span>Motivo</span><span className="text-right">Hora</span><span className="text-right">Monto</span>
                            </div>
                            <div className="divide-y divide-orange-100 max-h-40 overflow-y-auto">
                                {detalleEgresos.map((e, idx) => (
                                    <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-3 py-2.5 text-sm bg-white">
                                        <span className="font-medium text-orange-900 truncate" title={e.motivo}>{e.motivo}</span>
                                        <span className="text-orange-600 text-xs tabular-nums text-right">{new Date(e.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="text-orange-700 font-bold tabular-nums text-right">-S/{e.monto.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {desglosePagos.length > 0 && (
                        <div className="rounded-xl border border-teal-200 overflow-hidden">
                            <div className="px-3 py-2 bg-teal-100"><p className="text-xs font-bold uppercase tracking-wide text-teal-700">Desglose por método de pago</p></div>
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 bg-teal-50 text-[10px] font-bold text-teal-600 uppercase tracking-wide">
                                <span>Método</span><span className="text-right">Ventas</span><span className="text-right">Monto</span>
                            </div>
                            <div className="divide-y divide-teal-100 max-h-40 overflow-y-auto">
                                {desglosePagos.map((p, idx) => (
                                    <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-3 py-2.5 text-sm bg-white">
                                        <span className="font-medium text-teal-900 truncate">{p.metodo}</span>
                                        <span className="text-teal-700 tabular-nums text-right">x{p.cantidad}</span>
                                        <span className="text-teal-700 font-bold tabular-nums text-right">S/{p.total.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const CajaFinanzas = ({ farmacia, user }) => {
    const isAdmin = user?.role === 'ADMIN';
    const [vistaActual, setVistaActual] = useState('operativa'); // 'operativa' | 'admin'
    const [turnoActivo, setTurnoActivo] = useState(null);
    const [monitorData, setMonitorData] = useState({ turnosActivos: [], hayTurnosAbiertos: false });
    const [loading, setLoading] = useState(true);
    const [showModalApertura, setShowModalApertura] = useState(false);
    const [showModalEgreso, setShowModalEgreso] = useState(false);
    const [showModalCierre, setShowModalCierre] = useState(false);
    const [montoInicial, setMontoInicial] = useState('0');
    const [montoEgreso, setMontoEgreso] = useState('');
    const [motivoEgreso, setMotivoEgreso] = useState('');
    const [observacionesCierre, setObservacionesCierre] = useState({ observaciones: '', password: '' });
    const [cierreResumen, setCierreResumen] = useState(null);
    const [showChoiceCierre, setShowChoiceCierre] = useState(false);
    const [previewResumen, setPreviewResumen] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [historialTurnos, setHistorialTurnos] = useState([]);
    const [, setEgresos] = useState([]);
    const [showDetallesModal, setShowDetallesModal] = useState(false);
    const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
    const [resumenTurnoSeleccionado, setResumenTurnoSeleccionado] = useState(null);
    const [loadingResumenTurno, setLoadingResumenTurno] = useState(false);
    const [ventas, setVentas] = useState([]);

    useEffect(() => {
        if (!turnoSeleccionado) {
            setResumenTurnoSeleccionado(null);
            return;
        }
        setLoadingResumenTurno(true);
        api.get(`/caja/turno/${turnoSeleccionado.id}/resumen`, { headers: { 'x-farmacia-id': farmacia.id } })
            .then(({ data }) => setResumenTurnoSeleccionado(data))
            .catch(() => setResumenTurnoSeleccionado(null))
            .finally(() => setLoadingResumenTurno(false));
    }, [turnoSeleccionado?.id]);

    useEffect(() => {
        fetchTurnoActivo();
        if (vistaActual === 'admin' || user?.role === 'ADMIN') {
            fetchHistorial();
            fetchEgresos();
            if (user?.role === 'ADMIN') {
                fetchMonitor();
                const interval = setInterval(fetchMonitor, 30000); // Actualizar cada 30 segundos
                return () => clearInterval(interval);
            }
        }
    }, [farmacia, vistaActual]);

    useEffect(() => {
        if (vistaActual === 'operativa' && turnoActivo) {
            fetchVentas();
        }
    }, [turnoActivo?.id]);

    const fetchTurnoActivo = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/caja/turno-activo');
            setTurnoActivo(data);
        } catch (error) {
            console.error('Error fetching turno:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistorial = async () => {
        try {
            const { data } = await api.get('/caja/historial');
            setHistorialTurnos(data);
        } catch (error) {
            console.error('Error fetching historial:', error);
        }
    };

    const fetchEgresos = async () => {
        try {
            const { data } = await api.get('/caja/egresos');
            setEgresos(data);
        } catch (error) {
            console.error('Error fetching egresos:', error);
        }
    };

    const fetchMonitor = async () => {
        try {
            const { data } = await api.get('/caja/monitor');
            setMonitorData(data);
        } catch (error) {
            console.error('Error fetching monitor:', error);
        }
    };

    const fetchVentas = async () => {
        if (!turnoActivo) return;
        try {
            const desde = encodeURIComponent(turnoActivo.fechaApertura);
            // propio=1: esta es "Mi Caja Personal", siempre solo lo que vendió
            // el usuario actual (antes, un ADMIN veía acá las ventas de toda la
            // farmacia porque el backend solo aplicaba ese filtro a VENDEDOR).
            const { data } = await api.get(`/sales?desde=${desde}&propio=1`);
            // El server ya filtra desde fechaApertura; solo excluir las posteriores al cierre
            const ventasTurno = turnoActivo.fechaCierre
                ? data.filter(v => new Date(v.fecha_emision) <= new Date(turnoActivo.fechaCierre))
                : data;
            setVentas(ventasTurno);
        } catch (error) {
            console.error('Error fetching ventas:', error);
        }
    };

    const handleAbrirTurno = async () => {
        if (montoInicial === '' || parseFloat(montoInicial) < 0) {
            alert('El monto inicial no puede ser negativo');
            return;
        }
        try {
            await api.post('/caja/abrir-turno', { montoInicial: parseFloat(montoInicial) });
            setShowModalApertura(false);
            setMontoInicial('');
            fetchTurnoActivo();
        } catch (error) {
            alert(error.response?.data?.error || 'Error al abrir turno');
        }
    };

    const handleRegistrarEgreso = async () => {
        if (!montoEgreso || parseFloat(montoEgreso) <= 0) {
            alert('El monto debe ser mayor a 0');
            return;
        }
        if (!motivoEgreso.trim()) {
            alert('El motivo es obligatorio');
            return;
        }
        try {
            await api.post('/caja/registrar-egreso', { monto: parseFloat(montoEgreso), motivo: motivoEgreso });
            setShowModalEgreso(false);
            setMontoEgreso('');
            setMotivoEgreso('');
            fetchTurnoActivo();
        } catch (error) {
            alert(error.response?.data?.error || 'Error al registrar egreso');
        }
    };

    const handleVerResumenPreview = async () => {
        setShowChoiceCierre(false);
        setLoadingPreview(true);
        try {
            const { data } = await api.get(`/caja/turno/${turnoActivo.id}/resumen`, { headers: { 'x-farmacia-id': farmacia.id } });
            setPreviewResumen(data);
        } catch (error) {
            alert(error.response?.data?.error || 'No se pudo cargar el resumen del turno');
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleCerrarTurno = async () => {
        if (!observacionesCierre.password) {
            alert('Debes ingresar tu contraseña');
            return;
        }
        try {
            const { data } = await api.post(`/caja/cerrar-turno/${turnoActivo.id}`, {
                observaciones: observacionesCierre.observaciones,
                password: observacionesCierre.password
            }, { headers: { 'x-farmacia-id': farmacia.id } });
            setShowModalCierre(false);
            setObservacionesCierre({ observaciones: '', password: '' });
            setCierreResumen(data);
            fetchTurnoActivo();
        } catch (error) {
            alert(error.response?.data?.error || 'Error al cerrar turno');
        }
    };

    const calcularTotalEnCaja = () => {
        if (!turnoActivo) return 0;
        return parseFloat(turnoActivo.montoInicial || 0) +
            parseFloat(turnoActivo.montoVentas || 0) -
            parseFloat(turnoActivo.montoEgresos || 0);
    };

    const ModalDetalles = () => {
        if (!turnoSeleccionado) return null;
        const ini = parseFloat(turnoSeleccionado.montoInicial || 0);
        const egr = parseFloat(turnoSeleccionado.montoEgresos || 0);
        // Si montoVentas no fue guardado (turnos anteriores al fix), lo deriva del final
        const rawVentas = parseFloat(turnoSeleccionado.montoVentas || 0);
        const ventas = rawVentas > 0
            ? rawVentas
            : parseFloat(turnoSeleccionado.montoFinal || 0) - ini + egr;
        const total = ini + ventas - egr;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto !p-4 sm:!p-6">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center"><FileText size={20} className="text-indigo-600" /></div>
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Detalles del Turno</h3>
                        </div>
                        <button onClick={() => setShowDetallesModal(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                            <X size={22} />
                        </button>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Cajero</p><p className="font-semibold text-gray-900 flex items-center gap-1.5"><User size={14} className="text-gray-400" />{turnoSeleccionado.usuario.fullName}</p></div>
                            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Estado</p><span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${turnoSeleccionado.estado === 'ABIERTO' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${turnoSeleccionado.estado === 'ABIERTO' ? 'bg-green-500' : 'bg-gray-400'}`}></span>{turnoSeleccionado.estado}</span></div>
                            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Apertura</p><p className="font-semibold text-gray-900 flex items-center gap-1.5"><Calendar size={14} className="text-gray-400" />{new Date(turnoSeleccionado.fechaApertura).toLocaleString()}</p></div>
                            {turnoSeleccionado.fechaCierre && (
                                <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Cierre</p><p className="font-semibold text-gray-900 flex items-center gap-1.5"><Calendar size={14} className="text-gray-400" />{new Date(turnoSeleccionado.fechaCierre).toLocaleString()}</p></div>
                            )}
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 mb-4">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><DollarSign size={16} className="text-indigo-600" />Resumen Financiero</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Fondo Inicial:</span><span className="font-semibold tabular-nums">S/ {parseFloat(turnoSeleccionado.montoInicial).toFixed(2)}</span></div>
                            <div className="flex justify-between text-green-600"><span>+ Ventas:</span><span className="font-semibold tabular-nums">S/ {ventas.toFixed(2)}</span></div>
                            <div className="flex justify-between text-red-600"><span>- Egresos:</span><span className="font-semibold tabular-nums">S/ {egr.toFixed(2)}</span></div>
                            <div className="border-t border-blue-200/70 pt-2 flex justify-between text-lg font-bold text-gray-900"><span>Total Final:</span><span className="tabular-nums">S/ {parseFloat(turnoSeleccionado.montoFinal || total).toFixed(2)}</span></div>
                        </div>
                    </div>
                    {turnoSeleccionado.desglosePagos && turnoSeleccionado.desglosePagos.length > 0 && (
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-4">
                            <h4 className="font-semibold text-gray-900 mb-3 text-sm">Desglose por Método de Pago</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {turnoSeleccionado.desglosePagos.map((p, i) => (
                                    <div key={i} className="flex justify-between items-center px-3 py-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                                        <span className="text-xs font-medium text-gray-600">{p.metodo}:</span>
                                        <span className="text-xs font-bold text-indigo-600 tabular-nums">S/ {p.total.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2"><TrendingUp size={16} className="text-indigo-600" />Resumen de Caja — qué se vendió ese día</h4>
                        {loadingResumenTurno && <p className="text-sm text-gray-500">Cargando resumen...</p>}
                        {!loadingResumenTurno && resumenTurnoSeleccionado && <ResumenDetalle resumen={resumenTurnoSeleccionado} />}
                        {!loadingResumenTurno && !resumenTurnoSeleccionado && <p className="text-sm text-gray-500">No se pudo cargar el resumen de este turno.</p>}
                    </div>
                    <div className="flex justify-end mt-4">
                        <Button variant="secondary" onClick={() => setShowDetallesModal(false)} className="w-full sm:w-auto">Cerrar</Button>
                    </div>
                </Card>
            </div>
        );
    };

    const VistaOperativa = () => {
        if (loading) return <Card><div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div><p className="mt-4 text-gray-600">Cargando...</p></div></Card>;
        if (!turnoActivo) {
            return (
                <Card className="max-w-2xl mx-auto text-center !p-6 sm:!p-10 border border-gray-100 shadow-sm">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"><Lock size={40} className="text-white" /></div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Turno Cerrado</h2>
                    <p className="text-gray-600 mb-6">Debes abrir caja para empezar a vender.</p>
                    <Input label="MONTO INICIAL EN EFECTIVO" type="number" step="0.01" min="0" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} placeholder="S/ 0.00" className="max-w-sm mx-auto mb-6 text-lg text-center tabular-nums" />
                    <Button variant="primary" onClick={handleAbrirTurno} className="w-full sm:w-auto px-8 mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"><Unlock size={18} className="mr-2" />Abrir Caja</Button>
                </Card>
            );
        }
        const total = calcularTotalEnCaja();
        const tiempo = new Date() - new Date(turnoActivo.fechaApertura);
        const h = Math.floor(tiempo / 3600000);
        const m = Math.floor((tiempo % 3600000) / 60000);
        return (
            <div className="space-y-6">
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 shadow-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 !p-4 sm:!p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center shadow-sm border border-green-200"><Unlock size={24} className="text-green-600" /></div>
                        <div><h3 className="font-bold text-green-900">Tu Turno está Abierto</h3><p className="text-sm text-green-700 font-medium"><Clock size={14} className="inline mr-1" />{h}h {m}m • {turnoActivo.usuario.fullName}</p></div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200 self-start sm:self-auto"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>ABIERTA</span>
                </Card>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="!p-4 sm:!p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center"><DollarSign size={16} className="text-blue-600" /></div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fondo Inicial</p></div>
                        <p className="text-2xl font-bold text-gray-900 tabular-nums">S/ {parseFloat(turnoActivo.montoInicial).toFixed(2)}</p>
                    </Card>
                    <Card className="!p-4 sm:!p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center"><TrendingUp size={16} className="text-green-600" /></div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ventas</p></div>
                        <p className="text-2xl font-bold text-green-600 tabular-nums">S/ {parseFloat(turnoActivo.montoVentas).toFixed(2)}</p>
                    </Card>
                    <Card className="!p-4 sm:!p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center"><TrendingDown size={16} className="text-red-600" /></div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Egresos</p></div>
                        <p className="text-2xl font-bold text-red-600 tabular-nums">S/ {parseFloat(turnoActivo.montoEgresos).toFixed(2)}</p>
                    </Card>
                    <Card className="!p-4 sm:!p-6 rounded-2xl border border-zinc-800 shadow-sm bg-zinc-900 text-white">
                        <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center"><DollarSign size={16} className="text-emerald-400" /></div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Total en Caja</p></div>
                        <p className="text-3xl font-black tabular-nums">S/ {total.toFixed(2)}</p>
                    </Card>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <Button variant="outline" onClick={() => setShowModalEgreso(true)} className="w-full"><TrendingDown size={20} className="mr-2" />Egreso</Button>
                    <Button variant="danger" onClick={() => setShowChoiceCierre(true)} className="w-full"><Lock size={20} className="mr-2" />Cerrar Caja</Button>
                </div>
                <Card className="!p-4 sm:!p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-indigo-600" />Ventas del Turno ({ventas.length})</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {ventas.length === 0 ? (
                            <p className="text-center text-gray-400 py-6 text-sm">Sin ventas registradas aún en este turno.</p>
                        ) : (
                            ventas.map(v => {
                                const devuelto = v.tieneDevolucion ? parseFloat(v.devolucion?.[0]?.totalDevuelto || 0) : 0;
                                const neto = parseFloat(v.total) - devuelto;
                                const esDevueltaTotal = v.tieneDevolucion && neto <= 0;
                                const esDevueltaParcial = v.tieneDevolucion && neto > 0;
                                return (
                                    <div key={v.id} className={`flex justify-between items-center px-3 py-2 rounded-lg border transition-colors ${esDevueltaTotal ? 'bg-red-50 border-red-100' : esDevueltaParcial ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                {v.serie}-{v.numero}
                                                {esDevueltaTotal && <span className="text-[10px] font-bold bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full">Devuelta</span>}
                                                {esDevueltaParcial && <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded-full">Dev. parcial</span>}
                                            </p>
                                            <p className="text-xs text-gray-500">{new Date(v.fecha_emision).toLocaleTimeString()}</p>
                                        </div>
                                        <div className="text-right">
                                            {v.tieneDevolucion && <p className="text-[10px] text-gray-400 line-through tabular-nums">S/ {parseFloat(v.total).toFixed(2)}</p>}
                                            <p className={`font-bold tabular-nums ${esDevueltaTotal ? 'text-red-500' : esDevueltaParcial ? 'text-yellow-600' : 'text-green-600'}`}>S/ {neto.toFixed(2)}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>
            </div>
        );
    };

    const VistaAdmin = () => {
        return (
            <div className="space-y-6">
                <Card className="!p-4 sm:!p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center"><Eye size={18} className="text-indigo-600" /></div>Monitor de Cajas Activas</h3>
                    {monitorData?.turnosActivos?.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {monitorData.turnosActivos.map(t => (
                                <div key={t.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-9 h-9 rounded-full bg-green-50 border border-green-100 flex items-center justify-center"><User size={16} className="text-green-600" /></div>
                                            <div>
                                                <p className="font-bold text-gray-900">{t.usuario.fullName}</p>
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>TURNO ABIERTO</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-indigo-600 tabular-nums">S/ {(parseFloat(t.montoInicial || 0) + parseFloat(t.montoVentas || 0) - parseFloat(t.montoEgresos || 0)).toFixed(2)}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Total en Caja</p>
                                        </div>
                                    </div>

                                    {t.desglosePagos && t.desglosePagos.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {t.desglosePagos.map((p, i) => (
                                                <div key={i} className="px-2 py-1 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-600 border border-gray-100 tabular-nums">
                                                    {p.metodo}: S/ {p.total.toFixed(2)}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2 border-t border-gray-100 pt-3">
                                        <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setTurnoSeleccionado(t); setShowDetallesModal(true); }}>
                                            <Eye size={14} className="mr-1" /> Ver Detalles
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-center text-gray-500 py-8">No hay cajas abiertas</p>}
                </Card>
                <Card className="!p-4 sm:!p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center"><FileText size={18} className="text-indigo-600" /></div>Historial de Cierres</h3>
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <table className="w-full text-sm min-w-[480px]">
                            <thead>
                                <tr className="bg-gray-50 text-left cursor-default border-b border-gray-100">
                                    <th className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha</th>
                                    <th className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Cajero</th>
                                    <th className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Final</th>
                                    <th className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 text-center">Detalles</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historialTurnos.map(t => (
                                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="p-3 text-gray-700 whitespace-nowrap">{new Date(t.fechaCierre).toLocaleDateString()}</td>
                                        <td className="p-3 text-gray-900 font-medium">{t.usuario.fullName}</td>
                                        <td className="p-3 text-right font-bold text-gray-900 tabular-nums">S/ {parseFloat(t.montoFinal).toFixed(2)}</td>
                                        <td className="p-3 text-center"><Button variant="outline" size="sm" onClick={() => { setTurnoSeleccionado(t); setShowDetallesModal(true); }}><Eye size={14} /></Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center"><DollarSign size={22} className="text-indigo-600" /></div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Caja y Finanzas</h1>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                    <Button variant={vistaActual === 'operativa' ? 'primary' : 'outline'} onClick={() => setVistaActual('operativa')} className="!py-1.5 w-full sm:w-auto"><User size={18} className="mr-2" />Mi Caja Personal</Button>
                    {isAdmin && <Button variant={vistaActual === 'admin' ? 'primary' : 'outline'} onClick={() => setVistaActual('admin')} className="!py-1.5 w-full sm:w-auto"><Shield size={18} className="mr-2" />Monitorear Todas las Cajas</Button>}
                </div>
            </div>
            {vistaActual === 'operativa' ? <VistaOperativa /> : <VistaAdmin />}
            {showModalApertura && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md !p-4 sm:!p-6">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center"><Unlock size={20} className="text-green-600" /></div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Abrir Caja</h3>
                            </div>
                            <button onClick={() => setShowModalApertura(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={22} /></button>
                        </div>
                        <Input label="Monto Inicial" type="number" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} className="tabular-nums" />
                        <div className="flex flex-col sm:flex-row gap-2 mt-6"><Button variant="secondary" onClick={() => setShowModalApertura(false)} className="flex-1 w-full">Cancelar</Button><Button variant="primary" onClick={handleAbrirTurno} className="flex-1 w-full">Abrir</Button></div>
                    </Card>
                </div>
            )}
            {showModalEgreso && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md !p-4 sm:!p-6">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center"><TrendingDown size={20} className="text-red-600" /></div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Registrar Egreso</h3>
                            </div>
                            <button onClick={() => setShowModalEgreso(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={22} /></button>
                        </div>
                        <Input label="Monto" type="number" value={montoEgreso} onChange={(e) => setMontoEgreso(e.target.value)} className="tabular-nums" />
                        <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">Motivo</label>
                        <textarea className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={motivoEgreso} onChange={(e) => setMotivoEgreso(e.target.value)} rows="3" />
                        <div className="flex flex-col sm:flex-row gap-2 mt-6"><Button variant="secondary" onClick={() => setShowModalEgreso(false)} className="flex-1 w-full">Cancelar</Button><Button variant="primary" onClick={handleRegistrarEgreso} className="flex-1 w-full">Registrar</Button></div>
                    </Card>
                </div>
            )}
            {showModalCierre && turnoActivo && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md !p-4 sm:!p-6">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center"><Lock size={20} className="text-red-600" /></div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Cerrar Caja</h3>
                            </div>
                            <button onClick={() => setShowModalCierre(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={22} /></button>
                        </div>
                        <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl mb-4 space-y-1">
                            <p className="flex justify-between text-sm text-gray-600"><span>Ventas:</span><span className="font-semibold text-gray-900 tabular-nums">S/ {parseFloat(turnoActivo.montoVentas).toFixed(2)}</span></p>
                            <p className="flex justify-between text-sm text-gray-600"><span>Egresos:</span><span className="font-semibold text-gray-900 tabular-nums">S/ {parseFloat(turnoActivo.montoEgresos).toFixed(2)}</span></p>
                            <p className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 mt-2 pt-2"><span>Total:</span><span className="tabular-nums">S/ {calcularTotalEnCaja().toFixed(2)}</span></p>
                        </div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones de Cierre</label>
                        <textarea className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4 text-sm" value={observacionesCierre.observaciones} onChange={(e) => setObservacionesCierre({ ...observacionesCierre, observaciones: e.target.value })} placeholder="Escribe cualquier detalle relevante del turno..." />
                        <div className="space-y-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                            <label className="flex items-center gap-1.5 text-sm font-bold text-indigo-900"><Shield size={14} className="text-indigo-600" />Confirmación de Seguridad</label>
                            <Input label="Ingresa TU contraseña para cerrar" type="password" value={observacionesCierre.password} onChange={(e) => setObservacionesCierre({ ...observacionesCierre, password: e.target.value })} placeholder="Tu contraseña" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-6"><Button variant="secondary" onClick={() => setShowModalCierre(false)} className="flex-1 w-full">Cancelar</Button><Button variant="danger" onClick={handleCerrarTurno} className="flex-1 w-full">Confirmar y Cerrar Caja</Button></div>
                    </Card>
                </div>
            )}
            {showDetallesModal && <ModalDetalles />}

            {showChoiceCierre && (
                <Modal isOpen={showChoiceCierre} onClose={() => setShowChoiceCierre(false)} title="Cerrar Caja">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">¿Deseas cerrar la caja directo, o prefieres ver primero el resumen del turno (ventas, medicamentos, servicios y promociones)?</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button variant="outline" className="flex-1 w-full" disabled={loadingPreview} onClick={handleVerResumenPreview}>
                                {loadingPreview ? 'Cargando...' : 'Ver resumen primero'}
                            </Button>
                            <Button variant="danger" className="flex-1 w-full" onClick={() => { setShowChoiceCierre(false); setShowModalCierre(true); }}>
                                Cerrar directo
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {previewResumen && (
                <Modal isOpen={!!previewResumen} onClose={() => setPreviewResumen(null)} title="Resumen del Turno (antes de cerrar)" maxWidth="max-w-4xl">
                    <div className="space-y-4">
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                            <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Total en caja hasta el momento</p>
                            <p className="text-3xl font-bold text-emerald-800 tabular-nums">S/ {parseFloat(previewResumen.montoFinal || 0).toFixed(2)}</p>
                        </div>
                        <ResumenDetalle resumen={previewResumen} />
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button variant="secondary" className="flex-1 w-full" onClick={() => setPreviewResumen(null)}>Seguir vendiendo</Button>
                            <Button variant="danger" className="flex-1 w-full" onClick={() => { setPreviewResumen(null); setShowModalCierre(true); }}>Cerrar Caja</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {cierreResumen && (
                <Modal isOpen={!!cierreResumen} onClose={() => setCierreResumen(null)} title="Turno Cerrado — Resumen del Día" maxWidth="max-w-4xl">
                    <div className="space-y-4">
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                            <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Total en caja</p>
                            <p className="text-3xl font-bold text-emerald-800 tabular-nums">S/ {parseFloat(cierreResumen.montoFinal || 0).toFixed(2)}</p>
                        </div>
                        <ResumenDetalle resumen={cierreResumen} />
                        <Button variant="primary" className="w-full" onClick={() => setCierreResumen(null)}>Entendido</Button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default CajaFinanzas;
