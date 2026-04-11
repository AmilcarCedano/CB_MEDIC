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
import { Card, Button, Input } from './components/ui';

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
    const [historialTurnos, setHistorialTurnos] = useState([]);
    const [egresos, setEgresos] = useState([]);
    const [showDetallesModal, setShowDetallesModal] = useState(false);
    const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
    const [ventas, setVentas] = useState([]);

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
            const { data } = await api.get('/sales');
            const ventasTurno = data.filter(venta => {
                const fechaVenta = new Date(venta.fecha_emision || venta.fecha);
                const fechaApertura = new Date(turnoActivo.fechaApertura);
                return fechaVenta >= fechaApertura && (!turnoActivo.fechaCierre || fechaVenta <= new Date(turnoActivo.fechaCierre));
            });
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

    const handleCerrarTurno = async () => {
        if (!observacionesCierre.password) {
            alert('Debes ingresar tu contraseña');
            return;
        }
        try {
            await api.post(`/caja/cerrar-turno/${turnoActivo.id}`, {
                observaciones: observacionesCierre.observaciones,
                password: observacionesCierre.password
            }, { headers: { 'x-farmacia-id': farmacia.id } });
            setShowModalCierre(false);
            setObservacionesCierre({ observaciones: '', password: '' });
            fetchTurnoActivo();
        } catch (error) {
            alert(error.response?.data?.error || 'Error al cerrar turno');
        }
    };

    const calcularTotalEnCaja = () => {
        if (!turnoActivo) return 0;
        return parseFloat(turnoActivo.montoInicial) +
            parseFloat(turnoActivo.montoVentas) -
            parseFloat(turnoActivo.montoEgresos);
    };

    const ModalDetalles = () => {
        if (!turnoSeleccionado) return null;
        const total = parseFloat(turnoSeleccionado.montoInicial) +
            parseFloat(turnoSeleccionado.montoVentas) -
            parseFloat(turnoSeleccionado.montoEgresos);

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b">
                        <h3 className="text-xl font-bold text-gray-900">Detalles del Turno</h3>
                        <button onClick={() => setShowDetallesModal(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><p className="text-gray-600">Cajero:</p><p className="font-semibold text-gray-900">{turnoSeleccionado.usuario.fullName}</p></div>
                            <div><p className="text-gray-600">Estado:</p><p className={`font-semibold ${turnoSeleccionado.estado === 'ABIERTO' ? 'text-green-600' : 'text-gray-600'}`}>{turnoSeleccionado.estado}</p></div>
                            <div><p className="text-gray-600">Apertura:</p><p className="font-semibold text-gray-900">{new Date(turnoSeleccionado.fechaApertura).toLocaleString()}</p></div>
                            {turnoSeleccionado.fechaCierre && (
                                <div><p className="text-gray-600">Cierre:</p><p className="font-semibold text-gray-900">{new Date(turnoSeleccionado.fechaCierre).toLocaleString()}</p></div>
                            )}
                        </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Resumen Financiero</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Fondo Inicial:</span><span className="font-semibold">S/ {parseFloat(turnoSeleccionado.montoInicial).toFixed(2)}</span></div>
                            <div className="flex justify-between text-green-600"><span>+ Ventas:</span><span className="font-semibold">S/ {parseFloat(turnoSeleccionado.montoVentas).toFixed(2)}</span></div>
                            <div className="flex justify-between text-red-600"><span>- Egresos:</span><span className="font-semibold">S/ {parseFloat(turnoSeleccionado.montoEgresos).toFixed(2)}</span></div>
                            <div className="border-t pt-2 flex justify-between text-lg font-bold"><span>Total Final:</span><span>S/ {parseFloat(turnoSeleccionado.montoFinal || total).toFixed(2)}</span></div>
                        </div>
                    </div>
                    {turnoSeleccionado.desglosePagos && turnoSeleccionado.desglosePagos.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                            <h4 className="font-semibold text-gray-900 mb-3 text-sm">Desglose por Método de Pago</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {turnoSeleccionado.desglosePagos.map((p, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 bg-white rounded border">
                                        <span className="text-xs font-medium text-gray-600">{p.metodo}:</span>
                                        <span className="text-xs font-bold text-indigo-600">S/ {p.total.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end mt-4">
                        <Button variant="secondary" onClick={() => setShowDetallesModal(false)}>Cerrar</Button>
                    </div>
                </Card>
            </div>
        );
    };

    const VistaOperativa = () => {
        if (loading) return <Card><div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div><p className="mt-4 text-gray-600">Cargando...</p></div></Card>;
        if (!turnoActivo) {
            return (
                <Card className="max-w-2xl mx-auto text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"><Lock size={40} className="text-white" /></div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Turno Cerrado</h2>
                    <p className="text-gray-600 mb-6">Debes abrir caja para empezar a vender.</p>
                    <Input label="MONTO INICIAL EN EFECTIVO" type="number" step="0.01" min="0" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} placeholder="S/ 0.00" className="max-w-sm mx-auto mb-6 text-lg text-center" />
                    <Button variant="primary" onClick={handleAbrirTurno} className="px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"><Unlock size={18} className="mr-2" />Abrir Caja</Button>
                </Card>
            );
        }
        const total = calcularTotalEnCaja();
        const tiempo = new Date() - new Date(turnoActivo.fechaApertura);
        const h = Math.floor(tiempo / 3600000);
        const m = Math.floor((tiempo % 3600000) / 60000);
        return (
            <div className="space-y-6">
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 flex justify-between items-center p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center shadow-sm border border-green-200"><Unlock size={24} className="text-green-600" /></div>
                        <div><h3 className="font-bold text-green-900">Tu Turno está Abierto</h3><p className="text-sm text-green-700 font-medium"><Clock size={14} className="inline mr-1" />{h}h {m}m • {turnoActivo.usuario.fullName}</p></div>
                    </div>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-blue-50"><div><p className="text-xs text-blue-600 font-bold uppercase">Fondo Inicial</p><p className="text-2xl font-bold text-blue-900">S/ {parseFloat(turnoActivo.montoInicial).toFixed(2)}</p></div></Card>
                    <Card className="bg-green-50"><div><p className="text-xs text-green-600 font-bold uppercase">Ventas</p><p className="text-2xl font-bold text-green-900">S/ {parseFloat(turnoActivo.montoVentas).toFixed(2)}</p></div></Card>
                    <Card className="bg-red-50"><div><p className="text-xs text-red-600 font-bold uppercase">Egresos</p><p className="text-2xl font-bold text-red-900">S/ {parseFloat(turnoActivo.montoEgresos).toFixed(2)}</p></div></Card>
                    <Card className="bg-zinc-900 text-white"><div><p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Total en Caja</p><p className="text-3xl font-black">S/ {total.toFixed(2)}</p></div></Card>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" onClick={() => setShowModalEgreso(true)}><TrendingDown size={20} className="mr-2" />Egreso</Button>
                    <Button variant="danger" onClick={() => setShowModalCierre(true)}><Lock size={20} className="mr-2" />Cerrar Caja</Button>
                </div>
                {ventas.length > 0 && (
                    <Card>
                        <h3 className="font-bold mb-4">Ventas del Turno ({ventas.length})</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {ventas.map(v => (
                                <div key={v.id} className="flex justify-between p-2 bg-gray-50 rounded">
                                    <div><p className="text-sm font-bold">{v.serie}-{v.numero}</p><p className="text-xs text-gray-500">{new Date(v.fecha_emision).toLocaleTimeString()}</p></div>
                                    <p className="font-bold text-green-600">S/ {parseFloat(v.total).toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </div>
        );
    };

    const VistaAdmin = () => {
        return (
            <div className="space-y-6">
                <Card>
                    <h3 className="font-bold mb-4 flex items-center gap-2"><Eye size={20} />Monitor de Cajas Activas</h3>
                    {monitorData?.turnosActivos?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {monitorData.turnosActivos.map(t => (
                                <div key={t.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="font-bold text-gray-900">{t.usuario.fullName}</p>
                                            <p className="text-xs text-gray-500 uppercase font-black">Turno Abierto</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-indigo-600">S/ {(parseFloat(t.montoInicial) + parseFloat(t.montoVentas) - parseFloat(t.montoEgresos)).toFixed(2)}</p>
                                            <p className="text-[10px] text-gray-400 font-bold">TOTAL EN CAJA</p>
                                        </div>
                                    </div>
                                    
                                    {t.desglosePagos && t.desglosePagos.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {t.desglosePagos.map((p, i) => (
                                                <div key={i} className="px-2 py-1 bg-gray-50 rounded text-[10px] font-bold text-gray-600 border border-gray-100">
                                                    {p.metodo}: S/ {p.total.toFixed(2)}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2 border-t pt-3">
                                        <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setTurnoSeleccionado(t); setShowDetallesModal(true); }}>
                                            <Eye size={14} className="mr-1" /> Ver Detalles
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-center text-gray-500 py-4">No hay cajas abiertas</p>}
                </Card>
                <Card>
                    <h3 className="font-bold mb-4 flex items-center gap-2"><FileText size={20} />Historial de Cierres</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left cursor-default">
                                <tr><th className="p-2">Fecha</th><th className="p-2">Cajero</th><th className="p-2 text-right">Final</th><th className="p-2 text-center">Detalles</th></tr>
                            </thead>
                            <tbody>
                                {historialTurnos.map(t => (
                                    <tr key={t.id} className="border-t">
                                        <td className="p-2">{new Date(t.fechaCierre).toLocaleDateString()}</td>
                                        <td className="p-2">{t.usuario.fullName}</td>
                                        <td className="p-2 text-right font-bold">S/ {parseFloat(t.montoFinal).toFixed(2)}</td>
                                        <td className="p-2 text-center"><Button variant="outline" size="sm" onClick={() => { setTurnoSeleccionado(t); setShowDetallesModal(true); }}><Eye size={14} /></Button></td>
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
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Caja y Finanzas</h1>
                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border">
                    <Button variant={vistaActual === 'operativa' ? 'primary' : 'outline'} onClick={() => setVistaActual('operativa')} className="!py-1.5"><User size={18} className="mr-2" />Mi Caja Personal</Button>
                    {isAdmin && <Button variant={vistaActual === 'admin' ? 'primary' : 'outline'} onClick={() => setVistaActual('admin')} className="!py-1.5"><Shield size={18} className="mr-2" />Monitorear Todas las Cajas</Button>}
                </div>
            </div>
            {vistaActual === 'operativa' ? <VistaOperativa /> : <VistaAdmin />}
            {showModalApertura && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">Abrir Caja</h3>
                        <Input label="Monto Inicial" type="number" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} />
                        <div className="flex gap-2 mt-6"><Button variant="secondary" onClick={() => setShowModalApertura(false)} className="flex-1">Cancelar</Button><Button variant="primary" onClick={handleAbrirTurno} className="flex-1">Abrir</Button></div>
                    </Card>
                </div>
            )}
            {showModalEgreso && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">Registrar Egreso</h3>
                        <Input label="Monto" type="number" value={montoEgreso} onChange={(e) => setMontoEgreso(e.target.value)} />
                        <label className="block text-sm font-medium mt-4 mb-1">Motivo</label>
                        <textarea className="w-full border rounded p-2" value={motivoEgreso} onChange={(e) => setMotivoEgreso(e.target.value)} rows="3" />
                        <div className="flex gap-2 mt-6"><Button variant="secondary" onClick={() => setShowModalEgreso(false)} className="flex-1">Cancelar</Button><Button variant="primary" onClick={handleRegistrarEgreso} className="flex-1">Registrar</Button></div>
                    </Card>
                </div>
            )}
            {showModalCierre && turnoActivo && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">Cerrar Caja</h3>
                        <div className="p-4 bg-gray-50 rounded mb-4">
                            <p className="flex justify-between text-sm"><span>Ventas:</span><span className="font-bold">S/ {parseFloat(turnoActivo.montoVentas).toFixed(2)}</span></p>
                            <p className="flex justify-between text-sm"><span>Egresos:</span><span className="font-bold">S/ {parseFloat(turnoActivo.montoEgresos).toFixed(2)}</span></p>
                            <p className="flex justify-between text-lg font-bold border-t mt-2 pt-2"><span>Total:</span><span>S/ {calcularTotalEnCaja().toFixed(2)}</span></p>
                        </div>
                        <label className="block text-sm font-medium mb-1">Observaciones de Cierre</label>
                        <textarea className="w-full border rounded p-2 mb-4 text-sm" value={observacionesCierre.observaciones} onChange={(e) => setObservacionesCierre({ ...observacionesCierre, observaciones: e.target.value })} placeholder="Escribe cualquier detalle relevante del turno..." />
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-indigo-900">Confirmación de Seguridad</label>
                            <Input label="Ingresa TU contraseña para cerrar" type="password" value={observacionesCierre.password} onChange={(e) => setObservacionesCierre({ ...observacionesCierre, password: e.target.value })} placeholder="Tu contraseña" />
                        </div>
                        <div className="flex gap-2 mt-6"><Button variant="secondary" onClick={() => setShowModalCierre(false)} className="flex-1">Cancelar</Button><Button variant="danger" onClick={handleCerrarTurno} className="flex-1">Confirmar y Cerrar Caja</Button></div>
                    </Card>
                </div>
            )}
            {showDetallesModal && <ModalDetalles />}
        </div>
    );
};

export default CajaFinanzas;
