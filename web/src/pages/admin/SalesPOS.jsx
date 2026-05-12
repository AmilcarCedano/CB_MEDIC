import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Calculator, ShoppingCart, User, Search, X, DollarSign, CreditCard, Send, Smartphone, Banknote, ClipboardList, FileText, FileSearch, Zap, AlertTriangle, Lightbulb, Plus, Minus, Award, Tag, Clock, Stethoscope, Percent, Star, Edit, Calendar } from 'lucide-react';
import { api } from '../../lib/api';
import { generateComprobantePDF, generateTicketPDF } from '../../lib/pdfGenerator';

// --- PLACEHOLDER UI COMPONENTS ---
const Card = ({ children, className = '', onClick = null }) => <div onClick={onClick} className={`bg-white rounded-xl shadow-lg p-4 md:p-6 ${className}`}>{children}</div>;
const Button = ({ children, variant = 'primary', size = 'md', onClick, disabled = false, className = '' }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors ${variant === 'primary' ? 'bg-indigo-600 text-white hover:bg-indigo-700' :
            variant === 'secondary' ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' :
                variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                    variant === 'success' ? 'bg-green-600 text-white hover:bg-green-700' :
                        variant === 'outline' ? 'border border-gray-300 text-gray-700 hover:bg-gray-50' :
                            'bg-indigo-600 text-white hover:bg-indigo-700'
            } ${size === 'sm' ? 'text-sm' : 'text-base'} ${className}`}
    >
        {children}
    </button>
);
const Input = ({ label, type = 'text', value, onChange, placeholder = '', required = false, className = '', name = '', disabled = false }) => (
    <div>
        {label && <label className="text-sm font-medium text-gray-700 mb-1 block">{label} {required && <span className="text-red-500">*</span>}</label>}
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            name={name}
            disabled={disabled}
            className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
        />
    </div>
);
const Select = ({ label, value, onChange, options, required = false, className = '', name = '' }) => (
    <div>
        {label && <label className="text-sm font-medium text-gray-700 mb-1 block">{label} {required && <span className="text-red-500">*</span>}</label>}
        <select
            value={value}
            onChange={onChange}
            required={required}
            name={name}
            className={`w-full p-3 border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
        >
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);
const Modal = ({ isOpen, title, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-lg space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">X</button>
                </div>
                {children}
            </Card>
        </div>
    );
};
// --- FIN PLACEHOLDER UI COMPONENTS ---

const ExpiryNotification = ({ alert, onClose }) => {
    if (!alert) return null;
    const isExpired = alert.type === 'EXPIRED';
    
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-[100] animate-in fade-in duration-200">
            <div className={`w-full max-w-md mx-4 overflow-hidden rounded-2xl shadow-2xl transform animate-in zoom-in-95 duration-200 ${isExpired ? 'bg-red-50 border-2 border-red-500' : 'bg-amber-50 border-2 border-amber-500'}`}>
                <div className={`p-6 ${isExpired ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'} flex items-center gap-4`}>
                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                        <AlertTriangle size={32} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight">
                            {isExpired ? '¡Producto Vencido!' : '¡Aviso de Vencimiento!'}
                        </h3>
                        <p className="text-sm opacity-90 font-medium">Acción requerida por el operador</p>
                    </div>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Medicamento</span>
                        <p className="text-lg font-bold text-gray-900 leading-tight">{alert.product.nombre}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Lote</span>
                            <div className="flex items-center gap-2 text-indigo-600 font-mono font-bold bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                <Tag size={14} />
                                <span>{alert.product.loteOriginal || 'S/L'}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Expira en</span>
                            <div className={`flex items-center gap-2 font-bold px-2 py-1 rounded-lg border ${isExpired ? 'text-red-600 bg-red-100 border-red-200' : 'text-amber-600 bg-amber-100 border-amber-200'}`}>
                                <Calendar size={14} />
                                <span>{new Date(alert.product.fechaVencimiento).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <p className={`text-sm font-medium italic border-l-4 pl-3 py-1 ${isExpired ? 'text-red-700 border-red-400 bg-red-100/50' : 'text-amber-700 border-amber-400 bg-amber-100/50'}`}>
                        {alert.message}
                    </p>

                    <div className="pt-2">
                        <Button 
                            variant={isExpired ? 'danger' : 'primary'} 
                            onClick={onClose}
                            className="w-full shadow-lg shadow-black/10 transition-transform active:scale-95"
                        >
                            Lo entiendo, continuar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- DATOS Y ESTRUCTURAS BASADAS EN EL ESQUEMA DEL USUARIO ---
const MOCK_CLIENT = { id: 0, nombre_razon: 'Público General', numero_doc: '00000000', type_doc: 'DNI', direccion: '', telefono_whatsapp: '', email: '', puntosAcumulados: 0 };
const DEFAULT_POINT_VALUE = 0.10;
const DEFAULT_LOYALTY_STATE = { valorPorPunto: DEFAULT_POINT_VALUE, solesPorPunto: 10, maxPuntosCanje: 0, activo: true };

const docTypeOptions = [
    { value: 'DNI', label: 'DNI' },
    { value: 'RUC', label: 'RUC' },
];
// --- FIN DATOS Y ESTRUCTURAS ---


export default function SalesPOS({ farmacia, user }) {
    if (!farmacia?.id) {
        return <Card><p>Seleccione una farmacia para empezar a vender.</p></Card>;
    }

    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState([]);
    const [client, setClient] = useState(MOCK_CLIENT);
    const [paymentMethod, setPaymentMethod] = useState('Efectivo');
    const [amountReceived, setAmountReceived] = useState(0);
    const [pointsToRedeem, setPointsToRedeem] = useState('0');
    const [pointsError, setPointsError] = useState(null);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [documentType, setDocumentType] = useState('Boleta');
    const [isSaleCompletedModalOpen, setIsSaleCompletedModalOpen] = useState(false);

    const [suggestions, setSuggestions] = useState({ promotions: [], recommendations: [] });
    const [appliedPoints, setAppliedPoints] = useState(0);
    const [pagoMetodos, setPagoMetodos] = useState([]);
    const [loyaltyConfig, setLoyaltyConfig] = useState(DEFAULT_LOYALTY_STATE);
    const [posConfig, setPosConfig] = useState(null);
    const [habitualItems, setHabitualItems] = useState([]);
    const [editingPriceItem, setEditingPriceItem] = useState(null);
    const [newPriceValue, setNewPriceValue] = useState("");
    const [loadingHabitual, setLoadingHabitual] = useState(false);
    const [expiryAlert, setExpiryAlert] = useState(null); // { product, type, message }

    const [posClientData, setPosClientData] = useState({
        type_doc: 'DNI', numero_doc: '', nombre_razon: '', direccion: '', telefono_whatsapp: '', email: '', distrito: '', provincia: '', departamento: '', ubigeo: '', puntosAcumulados: 0,
    });
    const [documentSuggestions, setDocumentSuggestions] = useState([]);
    const [documentSuggestionsLoading, setDocumentSuggestionsLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);

    // Estados para servicios
    const [servicios, setServicios] = useState([]);
    const [loadingServicios, setLoadingServicios] = useState(true);
    const [activeTab, setActiveTab] = useState('productos'); // 'productos', 'servicios', 'promos'

    // Estados para promociones
    const [promociones, setPromociones] = useState([]);
    const [loadingPromos, setLoadingPromos] = useState(true);

    // Estado para turno de caja
    const [turnoActivo, setTurnoActivo] = useState(null);
    const [loadingTurno, setLoadingTurno] = useState(true);

    const aggregatedProducts = useMemo(() => {
        if (!products || products.length === 0) return [];
        const groups = new Map();
        products.forEach(p => {
            const key = p.codigoBarras || `no-barcode-${p.id}`;
            if (groups.has(key)) {
                const g = groups.get(key);
                g.stockActual += p.stockActual;
                g.batches.push(p);
                // Prefer batch that expires first for the notification/main display
                if (p.fechaVencimiento && (!g.fechaVencimiento || new Date(p.fechaVencimiento) < new Date(g.fechaVencimiento))) {
                    g.fechaVencimiento = p.fechaVencimiento;
                    g.loteOriginal = p.lote; 
                }
            } else {
                groups.set(key, { ...p, batches: [p], loteOriginal: p.lote });
            }
        });
        return Array.from(groups.values());
    }, [products]);

    useEffect(() => {
        const fetchProducts = async () => {
            if (!farmacia?.id) {
                setLoadingProducts(false);
                return;
            }
            setLoadingProducts(true);
            try {
                const { data } = await api.get('/products', { params: { farmaciaId: farmacia.id } });
                if (Array.isArray(data)) {
                    setProducts(data.map(p => ({ ...p, price: parseFloat(p.precioVenta) })));
                } else {
                    console.error("Data received is not an array:", data);
                    setProducts([]);
                }
            } catch (err) {
                console.error("Error fetching products:", err);
            } finally {
                setLoadingProducts(false);
            }
        };
        fetchProducts();
    }, [farmacia?.id]);

    useEffect(() => {
        const fetchServicios = async () => {
            if (!farmacia?.id) return;
            setLoadingServicios(true);
            try {
                const { data } = await api.get('/servicios');
                setServicios(data.map(s => ({
                    ...s,
                    price: parseFloat(s.precioVenta),
                    tipo: 'servicio',
                    nombre: s.nombre,
                    stockActual: 999 
                })));
            } catch (err) {
                console.error("Error fetching servicios:", err);
            } finally {
                setLoadingServicios(false);
            }
        };
        fetchServicios();
    }, [farmacia?.id]);

    // Fetch turno activo
    useEffect(() => {
        const fetchTurnoActivo = async () => {
            if (!farmacia?.id) return;
            setLoadingTurno(true);
            try {
                const { data } = await api.get('/caja/turno-activo', {
                    headers: { 'x-farmacia-id': farmacia.id }
                });
                setTurnoActivo(data);
            } catch (err) {
                console.error("Error fetching turno activo:", err);
            } finally {
                setLoadingTurno(false);
            }
        };
        fetchTurnoActivo();
    }, [farmacia?.id]);

    useEffect(() => {
        const fetchLoyalty = async () => {
            if (!farmacia?.id) {
                setLoyaltyConfig(DEFAULT_LOYALTY_STATE);
                return;
            }
            try {
                const { data } = await api.get('/ofertas/lealtad', { headers: { 'x-farmacia-id': farmacia.id } });
                setLoyaltyConfig({
                    valorPorPunto: data?.valorPorPunto ?? DEFAULT_POINT_VALUE,
                    solesPorPunto: data?.solesPorPunto ?? 10,
                    maxPuntosCanje: data?.maxPuntosCanje ?? 0,
                    activo: data?.activo !== false,
                });
            } catch (err) {
                console.error("Error fetching loyalty config:", err);
                setLoyaltyConfig(DEFAULT_LOYALTY_STATE);
            }
        };
        fetchLoyalty();
    }, [farmacia?.id]);

    useEffect(() => {
        const fetchPagoMetodos = async () => {
            if (!farmacia?.id) return;
            try {
                const { data } = await api.get('/configuracion-pago', { headers: { 'x-farmacia-id': farmacia.id } });
                setPagoMetodos(data);
            } catch (err) {
                console.error("Error fetching pago configs:", err);
            }
        };
        const fetchPOSConfig = async () => {
             if (!farmacia?.id) return;
             try {
                 const { data } = await api.get('/config/pos', { headers: { 'x-farmacia-id': farmacia.id } });
                 setPosConfig(data);
             } catch (err) {
                 console.error("Error fetching pos config:", err);
             }
        };
        fetchPagoMetodos();
        fetchPOSConfig();
    }, [farmacia?.id]);

    // Fetch Promociones activas
    useEffect(() => {
        const fetchPromociones = async () => {
            if (!farmacia?.id) return;
            setLoadingPromos(true);
            try {
                const { data } = await api.get('/promociones', { headers: { 'x-farmacia-id': farmacia.id } });
                setPromociones(data.filter(p => p.activo));
            } catch (err) {
                console.error('Error fetching promociones:', err);
            } finally {
                setLoadingPromos(false);
            }
        };
        fetchPromociones();
    }, [farmacia?.id]);

    // Fetch Habitual Items for selected client
    useEffect(() => {
        const fetchHabitual = async () => {
            if (!farmacia?.id || !client || client.id === 0) {
                setHabitualItems([]);
                return;
            }
            setLoadingHabitual(true);
            try {
                const { data } = await api.get(`/clientes/${client.id}/habituales`, {
                    headers: { 'x-farmacia-id': farmacia.id }
                });
                setHabitualItems(data);
            } catch (err) {
                console.error("Error fetching habitual items in POS:", err);
            } finally {
                setLoadingHabitual(false);
            }
        };
        fetchHabitual();
    }, [farmacia?.id, client?.id]);

    const pointValue = loyaltyConfig?.valorPorPunto ?? DEFAULT_POINT_VALUE;
    const loyaltyEnabled = loyaltyConfig?.activo !== false;

    // Lógica para actualizar sugerencias cada vez que el carrito cambia
    const farmaciaId = farmacia?.id;

    const refreshSuggestions = useCallback(async (cartSnapshot) => {
        if (!farmaciaId || !cartSnapshot || cartSnapshot.length === 0) {
            setSuggestions({ promotions: [], recommendations: [] });
            return;
        }
        try {
            const cartPayload = cartSnapshot
                .filter(item => item.tipo !== 'promo') // Las sugerencias se basan en productos reales
                .map(item => ({
                    productId: Number(item.id),
                    quantity: Number(item.quantity),
                }));
            
            if (cartPayload.length === 0) {
                setSuggestions({ promotions: [], recommendations: [] });
                return;
            }
            
            const { data } = await api.post('/sales/suggestions', { cart: cartPayload }, {
                headers: { 'x-farmacia-id': farmaciaId }
            });
            setSuggestions(data);
        } catch (err) {
            console.error("Error fetching suggestions:", err);
        }
    }, [farmaciaId]);

    const lastCartItem = cart.length > 0 ? cart[cart.length - 1] : null;

    useEffect(() => {
        refreshSuggestions(cart);
    }, [cart, refreshSuggestions]);

    useEffect(() => {
        if (!farmacia?.id) {
            setDocumentSuggestions([]);
            setDocumentSuggestionsLoading(false);
            return;
        }

        const query = posClientData.numero_doc.trim();
        if (!query || query.length < 2) {
            setDocumentSuggestions([]);
            setDocumentSuggestionsLoading(false);
            return;
        }

        const controller = new AbortController();
        const handler = setTimeout(async () => {
            setDocumentSuggestionsLoading(true);
            try {
                const { data } = await api.get('/clientes/search', {
                    params: {
                        numeroDoc: query,
                        typeDoc: posClientData.type_doc,
                    },
                    headers: { 'x-farmacia-id': farmacia.id },
                    signal: controller.signal,
                });
                setDocumentSuggestions(data);
            } catch (err) {
                if (err.name !== 'CanceledError') {
                    console.error('Error fetching cliente suggestions:', err);
                }
            } finally {
                setDocumentSuggestionsLoading(false);
            }
        }, 250);

        return () => {
            clearTimeout(handler);
            controller.abort();
        };
    }, [farmacia?.id, posClientData.numero_doc, posClientData.type_doc]);

    // Búsqueda de productos, servicios y promociones
    const productSuggestions = useMemo(() => {
        let items = [];
        if (activeTab === 'servicios') {
            items = servicios;
        } else if (activeTab === 'promos') {
            items = promociones;
        } else if (activeTab === 'habituales') {
            items = habitualItems;
        } else {
            items = aggregatedProducts;
        }

        if (searchTerm.length < 2) return items;
        const lowerTerm = searchTerm.toLowerCase();
        return items.filter(p =>
            p.nombre.toLowerCase().includes(lowerTerm) ||
            p.codigoBarras?.includes(lowerTerm) ||
            p.codigoSunat?.includes(lowerTerm) ||
            p.descripcion?.toLowerCase().includes(lowerTerm) ||
            p.principioActivo?.toLowerCase().includes(lowerTerm)
        );
    }, [searchTerm, products, servicios, promociones, activeTab]);

    // Auto-select on exact barcode scan
    useEffect(() => {
        if (activeTab !== 'servicios' && searchTerm.trim().length > 3) {
            const term = searchTerm.trim();
            const exactMatch = products.find(p => p.codigoBarras === term);
            if (exactMatch) {
                // To avoid React warning during render phase, we can delay slightly 
                // but since it's an effect, it's fine.
                addToCart(exactMatch, 1);
            }
        }
    }, [searchTerm, products, activeTab]);

    const getUnitsOfProductInCart = (productId) => {
        return cart.reduce((total, item) => {
            if (item.tipo === 'promo') {
                const promoItem = item.promoData?.items?.find(pi => pi.productoId === productId);
                if (promoItem) {
                    return total + (promoItem.cantidad * item.quantity);
                }
            } else if (item.tipo === 'producto' && item.id === productId) {
                return total + item.quantity;
            }
            return total;
        }, 0);
    };

    const addToCart = (product, quantity = 1) => {
        setCart(prev => {
            const isService = product.tipo === 'servicio';
            const currentInCart = prev.filter(i => (i.tipo === 'producto' || i.tipo === 'habitual') && i.id === product.id)
                                    .reduce((acc, curr) => acc + curr.quantity, 0);
            
            if (!isService && currentInCart + quantity > product.stockActual) {
                alert(`⚠️ Stock insuficiente para ${product.nombre}.\nEn carrito (total): ${currentInCart}\nDisponible: ${product.stockActual}`);
                return prev;
            }

            const basePrice = product.price ?? parseFloat(product.precioVenta ?? 0);
            const normalizedProduct = {
                id: product.id,
                tipo: product.tipo || 'producto',
                nombre: product.nombre,
                price: basePrice,
                originalPrice: basePrice,
                stockActual: product.stockActual ?? 999,
                quantity: quantity,
                codigoBarras: product.codigoBarras ?? '',
            };

            const existingIndex = prev.findIndex(item => String(item.id) === String(product.id) && item.tipo === normalizedProduct.tipo);
            if (existingIndex > -1) {
                const updatedCart = [...prev];
                updatedCart[existingIndex] = { 
                    ...updatedCart[existingIndex], 
                    quantity: updatedCart[existingIndex].quantity + quantity 
                };
                return updatedCart;
            } else {
                // NOTIFICATION: Check expiration
                if (product.fechaVencimiento) {
                    const monthsMargin = posConfig?.margenVencimientoMeses || 3;
                    const expirationDate = new Date(product.fechaVencimiento);
                    const today = new Date();
                    const diffTime = expirationDate - today;
                    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);

                    if (diffMonths <= monthsMargin) {
                        const dateStr = expirationDate.toLocaleDateString();
                        const isExpiredLoc = diffMonths < 0;
                        setExpiryAlert({
                            product: product,
                            type: isExpiredLoc ? 'EXPIRED' : 'WARNING',
                            message: isExpiredLoc 
                                ? `Este medicamento está VENCIDO desde el ${dateStr}. Revisa el stock físico inmediatamente.` 
                                : `Este medicamento está cerca de vencer (${dateStr}). Asegúrate de usar primero los lotes más antiguos.`
                        });
                    }
                }

                return [...prev, normalizedProduct];
            }
        });

        // El refresco de sugerencias y otros efectos secundarios deben ir en un useEffect de cart si es posible,
        // o llamarse después si no dependen del estado inmediato.
        setAppliedPoints(0);
        setSearchTerm('');
    };

    const addSuggestedProduct = (product, priceOverride = null) => {
        const basePrice = priceOverride !== null ? priceOverride : (product.price ?? parseFloat(product.precioVenta ?? 0));
        const normalized = {
            ...product,
            price: basePrice,
            originalPrice: basePrice,
            precioVenta: product.precioVenta ?? product.price ?? 0,
            stockActual: product.stockActual ?? 999,
            codigoBarras: product.codigoBarras ?? product.codigo_producto ?? '',
        };
        addToCart(normalized, 1);
    };

    const handleUpdatePrice = async () => {
        if (!editingPriceItem) return;
        const newPrice = parseFloat(newPriceValue);
        
        if (isNaN(newPrice)) {
            alert("Ingrese un precio válido.");
            return;
        }

        if (newPrice < editingPriceItem.originalPrice) {
            alert(`No se puede bajar el precio. El precio base es S/ ${editingPriceItem.originalPrice.toFixed(2)}`);
            return;
        }

        const oldPrice = editingPriceItem.price;
        const itemName = editingPriceItem.nombre;

        setCart(cart.map(item => 
            (item.id === editingPriceItem.id && item.tipo === editingPriceItem.tipo) 
            ? { ...item, price: newPrice } 
            : item
        ));

        // Auditar el cambio
        try {
            await api.post('/auditoria', {
                farmaciaId: farmacia.id,
                modulo: 'VENTAS',
                accion: 'EDITAR',
                descripcion: `Precio aumentado en Carrito: ${itemName}. De S/ ${oldPrice.toFixed(2)} a S/ ${newPrice.toFixed(2)}`,
                usuarioId: user?.id
            });
        } catch (err) {
            console.error("Error auditando cambio de precio:", err);
        }

        setEditingPriceItem(null);
        setNewPriceValue("");
    };

    const updateQuantity = (id, delta) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const newQuantity = item.quantity + delta;
                if (newQuantity <= 0) return { ...item, quantity: 0 };

                // Validar stock global si aumenta
                if (delta > 0) {
                    if (item.tipo === 'promo') {
                        // Validar stock de cada item de la promo
                        for (const pi of item.promoData.items) {
                            const currentTotalInCart = getUnitsOfProductInCart(pi.productoId);
                            const neededForExtraPromo = pi.cantidad;
                            if (currentTotalInCart + neededForExtraPromo > pi.producto.stockActual) {
                                alert(`⚠️ Stock insuficiente para "${pi.producto.nombre}" en la promoción.`);
                                return item;
                            }
                        }
                    } else if (item.tipo === 'producto') {
                        const currentTotalInCart = getUnitsOfProductInCart(id);
                        if (currentTotalInCart + delta > item.stockActual) {
                            alert(`⚠️ Stock insuficiente para ${item.nombre}.`);
                            return item;
                        }
                    }
                }
                return { ...item, quantity: newQuantity };
            }
            return item;
        }).filter(item => item.quantity > 0));
        setAppliedPoints(0);
    };

    const removeItem = (id) => {
        setCart(cart.filter(item => item.id !== id));
        setAppliedPoints(0);
    };

    // Agregar promocion al carrito
    const addPromoToCart = (promo) => {
        // 1. Validar stock de cada producto en la promo
        for (const pi of promo.items) {
            const currentInCart = getUnitsOfProductInCart(pi.productoId);
            const neededForOneMore = pi.cantidad;
            if (currentInCart + neededForOneMore > (pi.producto.stockActual || 0)) {
                alert(`⚠️ Stock insuficiente para "${pi.producto.nombre}" incluido en la promoción "${promo.nombre}".\nEn carrito (total): ${currentInCart}\nNecesario: ${neededForOneMore}\nDisponible: ${pi.producto.stockActual}`);
                return;
            }
        }

        // 2. Validar vencimientos de cada item en la promo
        const posConfigMonths = posConfig?.margenVencimientoMeses || 3;
        for (const pi of promo.items) {
            if (pi.producto?.fechaVencimiento) {
                const expirationDate = new Date(pi.producto.fechaVencimiento);
                const today = new Date();
                const diffTime = expirationDate.getTime() - today.getTime();
                const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);

                if (diffMonths <= posConfigMonths) {
                    const dateStr = expirationDate.toLocaleDateString();
                    const isExpiredLoc = diffMonths < 0;
                    setExpiryAlert({
                        product: { ...pi.producto, loteOriginal: pi.producto.lote },
                        type: isExpiredLoc ? 'EXPIRED' : 'WARNING',
                        message: isExpiredLoc 
                            ? `¡ALERTA! El producto "${pi.producto.nombre}" dentro de esta promoción está VENCIDO (${dateStr}).` 
                            : `Aviso: El producto "${pi.producto.nombre}" en esta promo vence pronto (${dateStr}).`
                    });
                    // No cortamos el flujo (return), solo mostramos alerta, 
                    // a menos que sea una política estricta de no vender vencidos.
                }
            }
        }

        const promoCartItem = {
            id: `promo-${promo.id}`,
            tipo: 'promo',
            promoId: promo.id,
            nombre: `Descuento Promocional (${promo.nombre})`,
            price: promo.precioPromo,
            stockActual: 999,
            quantity: 1,
            promoData: promo,
            precioNormal: promo.items.reduce((s, i) => s + i.producto.precioVenta * i.cantidad, 0),
        };
        setCart(prev => {
            const existing = prev.find(i => i.id === promoCartItem.id);
            if (existing) return prev.map(i => i.id === promoCartItem.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, promoCartItem];
        });
        setAppliedPoints(0);
    };

    // Funciones de Puntos para Canje
    const handleApplyPoints = () => {
        if (!loyaltyEnabled) return;
        if (canjeablePoints <= 0) return;
        setAppliedPoints(canjeablePoints);
        setIsCheckoutModalOpen(false);
        setIsCheckoutModalOpen(true); // Forzar re-renderizado de total en modal
    };

    const handleRemovePoints = () => {
        setAppliedPoints(0);
        setIsCheckoutModalOpen(false);
        setIsCheckoutModalOpen(true); // Forzar re-renderizado de total en modal
    };


    // Cálculos de Totales
    const initialTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

    // Descuento por Promociones (ahorro acumulado)
    const promoSavings = useMemo(() => {
        return cart.reduce((sum, item) => {
            if (item.tipo === 'promo') {
                return sum + (item.precioNormal - item.price) * item.quantity;
            }
            return sum;
        }, 0);
    }, [cart]);

    // Descuento por Puntos
    const discountByPoints = loyaltyEnabled ? appliedPoints * pointValue : 0;
    const total = Math.max(0, initialTotal - discountByPoints);
    
    // Tasa de IGV dinámica de configuración
    const igvRate = posConfig?.igvPercent ? (parseFloat(posConfig.igvPercent) / 100) : 0.18;
    const subtotal = total / (1 + igvRate);
    const igv = total - subtotal;

    const change = amountReceived > total ? amountReceived - total : 0;

    // Lógica de Puntos Canjeables
    const maxPointsByTotal = loyaltyEnabled ? Math.ceil(initialTotal / pointValue) : 0;
    const maxPointsByConfig = (loyaltyConfig?.maxPuntosCanje > 0) ? loyaltyConfig.maxPuntosCanje : Infinity;
    
    // El canje útil es el mínimo entre: puntos del cliente, puntos que cubren el total, y el límite configurado.
    // Esto evita que el usuario desperdicie puntos si tiene un saldo muy alto.
    const canjeablePoints = loyaltyEnabled && client.id !== 0 
        ? Math.min(client.puntosAcumulados, maxPointsByTotal, maxPointsByConfig) 
        : 0;
    
    // Saldo real total para mostrar en la UI
    const totalClientBalance = client.puntosAcumulados;

    // Validación para el checkout
    const isClientValidForDoc =
        documentType === 'Boleta' ||
        documentType === 'Nota de Venta' ||
        (documentType === 'Factura' && client.id !== 0 && client.type_doc === 'RUC' && client.numero_doc.length === 11);

    const canCheckout = cart.length > 0 && amountReceived >= total && isClientValidForDoc;

    useEffect(() => {
        if (paymentMethod !== 'Efectivo') {
            setAmountReceived(total);
        }
    }, [paymentMethod, total]);

    // Restricción reactiva: asegura que los puntos aplicados nunca superen el límite útil de la venta actual
    useEffect(() => {
        if (appliedPoints > canjeablePoints) {
            setAppliedPoints(canjeablePoints);
        }
    }, [canjeablePoints, appliedPoints]);

    const handleDocumentSearch = async () => {
        const docType = posClientData.type_doc;
        const docNumber = posClientData.numero_doc.trim();

        if (!docNumber || (docType === 'DNI' && docNumber.length !== 8) || (docType === 'RUC' && docNumber.length !== 11)) {
            setSearchError(`Ingresa un número de ${docType} válido (${docType === 'DNI' ? '8' : '11'} dígitos).`);
            return;
        }

        setSearchLoading(true);
        setSearchError(null);

        try {
            const { data: result } = await api.get(`/reniec/search?type=${docType}&number=${docNumber}`);

            if (result.success) {
                setPosClientData(prev => ({
                    ...prev,
                    nombre_razon: result.nombreRazon,
                    direccion: result.direccion || '',
                    distrito: result.distrito || '',
                    provincia: result.provincia || '',
                    departamento: result.departamento || '',
                    ubigeo: result.ubigeo || '',
                }));
            } else {
                setSearchError(result.error || `Documento ${docNumber} no encontrado.`);
            }
        } catch (err) {
            console.error("Error searching document:", err);
            setSearchError(err.response?.data?.error || 'El servicio de búsqueda no está disponible.');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSelectDocumentSuggestion = (suggestion) => {
        setDocumentSuggestions([]);
        setSearchError(null);
        setPosClientData({
            type_doc: suggestion.tipoDoc,
            numero_doc: suggestion.numeroDoc,
            nombre_razon: suggestion.nombreRazon,
            direccion: suggestion.direccion || '',
            telefono_whatsapp: suggestion.telefono || '',
            email: suggestion.email || '',
            distrito: suggestion.distrito || '',
            provincia: suggestion.provincia || '',
            departamento: suggestion.departamento || '',
            ubigeo: suggestion.ubigeo || '',
            puntosAcumulados: suggestion.puntosAcumulados || 0,
        });
    };

    const handleOpenClientModal = async (docType) => {
        setDocumentType(docType);
        setSearchError(null);

        // Fetch clients from backend to search
        try {
            const { data } = await api.get('/clientes', { headers: { 'x-farmacia-id': farmacia.id } });
            // For simplicity, we'll just use the first client found if exists, or open a creation modal
            const existingClient = data.find(c => c.numeroDoc === client.numero_doc);
            setPosClientData({
                type_doc: docType === 'Factura' ? 'RUC' : 'DNI',
                numero_doc: existingClient?.numeroDoc || '',
                nombre_razon: existingClient?.nombreRazon || '',
                direccion: existingClient?.direccion || '',
                telefono_whatsapp: existingClient?.telefono || '',
                email: existingClient?.email || '',
                distrito: existingClient?.distrito || '',
                provincia: existingClient?.provincia || '',
                departamento: existingClient?.departamento || '',
                puntosAcumulados: existingClient?.puntosAcumulados || 0,
            });
        } catch (error) {
            console.error("Could not fetch clients for modal", error);
        }

        setIsClientModalOpen(true);
    };

    const handleSaveClient = async (e) => {
        e.preventDefault();
        setSearchError(null);

        if (!posClientData.nombre_razon.trim()) {
            setSearchError("El nombre o razón social es obligatorio.");
            return;
        }

        if (documentType === 'Factura' && posClientData.type_doc !== 'RUC') {
            setSearchError("Para Factura, el tipo de documento debe ser RUC.");
            return;
        }

        try {
            // Check if client exists
            const { data: existingClients } = await api.get('/clientes/search', {
                params: { numeroDoc: posClientData.numero_doc, typeDoc: posClientData.type_doc },
                headers: { 'x-farmacia-id': farmacia.id },
            });
            let savedClient;
            if (existingClients.length > 0) {
                const { data: updatedClient } = await api.put(`/clientes/${existingClients[0].id}`, {
                    tipoDoc: posClientData.type_doc,
                    numeroDoc: posClientData.numero_doc,
                    nombreRazon: posClientData.nombre_razon,
                    direccion: posClientData.direccion,
                    telefono: posClientData.telefono_whatsapp,
                    email: posClientData.email,
                    distrito: posClientData.distrito,
                    provincia: posClientData.provincia,
                    departamento: posClientData.departamento,
                }, { headers: { 'x-farmacia-id': farmacia.id } });
                savedClient = updatedClient;
            } else {
                const { data: newClient } = await api.post('/clientes', {
                    tipoDoc: posClientData.type_doc,
                    numeroDoc: posClientData.numero_doc,
                    nombreRazon: posClientData.nombre_razon,
                    direccion: posClientData.direccion,
                    telefono: posClientData.telefono_whatsapp,
                    email: posClientData.email,
                    distrito: posClientData.distrito,
                    provincia: posClientData.provincia,
                    departamento: posClientData.departamento,
                }, { headers: { 'x-farmacia-id': farmacia.id } });
                savedClient = newClient;
            }
            const normalizedClient = { ...savedClient, type_doc: savedClient.tipoDoc, numero_doc: savedClient.numeroDoc, nombre_razon: savedClient.nombreRazon };
            setClient(normalizedClient);
            if (normalizedClient.type_doc === 'RUC') {
                setDocumentType('Factura');
            }
            setIsClientModalOpen(false);
            setAppliedPoints(0);

            if (isCheckoutModalOpen) {
                setIsCheckoutModalOpen(true);
            }
        } catch (error) {
            console.error("Error saving client", error);
            setSearchError("No se pudo guardar el cliente.");
        }
    };

    const handleStartCheckout = () => {
        if (cart.length === 0) return;

        if (documentType === 'Factura' && (!client || client.type_doc !== 'RUC' || client.numero_doc.length !== 11)) {
            handleOpenClientModal('Factura');
            return;
        }

        // Si es Boleta y no hay cliente, cambiar automáticamente a Nota de Venta
        if (documentType === 'Boleta' && client.id === 0) {
            setDocumentType('Nota de Venta');
        }

        setIsCheckoutModalOpen(true);
        setAmountReceived(0);
    };

    useEffect(() => {
        const fetchPOSConfig = async () => {
            if (!farmacia?.id) return;
            try {
                const { data } = await api.get('/config/pos', { headers: { 'x-farmacia-id': farmacia.id } });
                setPosConfig(data);
            } catch (err) {
                console.error("Error fetching POS config:", err);
            }
        };
        fetchPOSConfig();
    }, [farmacia?.id]);

    const handleCheckout = async () => {
        if (!canCheckout) return;

        // Validar que haya un turno de caja abierto
        if (!turnoActivo) {
            alert('⚠️ No hay caja abierta. Debes abrir caja antes de vender.\n\nSerás redirigido al módulo de Caja y Finanzas.');
            // Aquí podrías redirigir al módulo de caja
            return;
        }

        try {
            // Unificar todos los items y enviarlos a /sales
            // El backend manejará la distinción entre PRODUCTS y SERVICES
            const salePayload = {
                cart: cart.map(item => ({
                    productId: item.tipo === 'promo' ? item.promoId : Number(item.id),
                    quantity: Number(item.quantity),
                    type: item.tipo === 'servicio' ? 'SERVICE' : (item.tipo === 'promo' ? 'PROMO' : 'PRODUCT')
                })),
                clienteId: client.id === 0 ? null : client.id,
                metodoPago: paymentMethod,
                montoRecibido: amountReceived,
                canjePuntos: appliedPoints,
                tipoComprobante: documentType,
            };

            const { data } = await api.post('/sales', salePayload);

            // Auto-descarga de ticket si está configurado
            if (posConfig?.autoDownloadTicket) {
                setTimeout(() => {
                    const fullComprobante = data?.comprobante;
                    if (fullComprobante) {
                        generateTicketPDF(fullComprobante, farmacia);
                    }
                }, 1000);
            }

            // Limpiar carrito y estados
            setCart([]);
            setAmountReceived(0);
            setClient(MOCK_CLIENT);
            setDocumentType('Boleta');
            setAppliedPoints(0);
            setIsCheckoutModalOpen(false);
            setIsSaleCompletedModalOpen(true);
            setIsSaleCompletedModalOpen(true);

            // Refresh products to update stock
            const { data: updatedProducts } = await api.get('/products', { params: { farmaciaId: farmacia.id } });
            setProducts(updatedProducts.map(p => ({ ...p, price: parseFloat(p.precioVenta) })));

            // Actualizar monto de ventas en el turno de caja
            if (turnoActivo) {
                try {
                    await api.put(`/caja/actualizar-ventas/${turnoActivo.id}`,
                        { montoVenta: total }
                    );
                } catch (err) {
                    console.error('Error updating turno ventas:', err);
                }
            }

        } catch (error) {
            console.error("Checkout failed", error);
            alert(`Error en la venta: ${error.response?.data?.details || error.message}`);
        }
    };
    // --- Renderizado de Sugerencias incrustadas en el carrito ---
    const renderSuggestionPanel = () => {
        // NO mostrar sugerencias si hay servicios en el carrito
        const hasServices = cart.some(item => item.tipo === 'servicio');
        if (hasServices) return null;

        const targetedRecommendations = lastCartItem
            ? suggestions.recommendations.filter(rec => rec.triggerProductoId === lastCartItem.id)
            : [];
        const otherRecommendations = suggestions.recommendations.filter(
            rec => !lastCartItem || rec.triggerProductoId !== lastCartItem.id
        );
        const hasSuggestions = suggestions.promotions.length > 0 || targetedRecommendations.length > 0 || otherRecommendations.length > 0;
        if (!hasSuggestions) return null;

        return (
            <div className="my-4 p-3 bg-gray-50 rounded-lg border border-indigo-100 relative">
                {/* Botón X para cerrar */}
                <button
                    onClick={() => {
                        // Limpiar sugerencias
                        setSuggestions({ promotions: [], recommendations: [] });
                    }}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
                >
                    <X size={16} />
                </button>

                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                        <h5 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <Lightbulb size={16} className="text-indigo-600" />
                            Sugerencias inteligentes
                        </h5>
                        <p className="text-xs text-gray-600">
                            {lastCartItem && targetedRecommendations.length > 0
                                ? `Basado en ${lastCartItem.nombre}.`
                                : 'Agrega un producto para ver sugerencias automáticas.'}
                        </p>
                    </div>


                    {lastCartItem && (
                        <span className="text-[11px] text-indigo-700 bg-white px-2 py-1 rounded-full border border-indigo-100">
                            Carrito con {cart.length} item(s)
                        </span>
                    )}
                </div>
                {suggestions.promotions.map((sug, index) => (
                    <div key={`promo-${index}`} className="p-3 mb-2 rounded-lg bg-red-50 border border-red-200">
                        <p className="font-semibold text-red-700 text-sm flex items-center gap-1">
                            <Zap size={14} className="text-red-500" />
                            {sug.message || sug.mensaje}
                        </p>
                    </div>
                ))}
                {targetedRecommendations.map((sug, index) => (
                    <div key={`rec-target-${index}`} className="p-3 mb-2 rounded-lg bg-white border border-indigo-100">
                        <p className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                            <Lightbulb size={14} className="text-indigo-600" />
                            {sug.mensaje || sug.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 pl-1">
                            El cliente que lleva {sug.triggerProductoNombre || lastCartItem?.nombre} también suele comprar:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2 pl-1">
                            {sug.productos.map((p, pIdx) => (
                                <Button
                                    key={`rec-target-prod-${pIdx}-${p.id}`}
                                    variant="secondary"
                                    size="sm"
                                    className="bg-indigo-600/10 text-indigo-800 hover:bg-indigo-600/20 text-xs py-1 px-3"
                                    onClick={() => addSuggestedProduct(p)}
                                >
                                    <Plus size={14} />
                                    {p.nombre} · S/{Number(p.price ?? p.precioVenta ?? 0).toFixed(2)}
                                </Button>
                            ))}
                        </div>
                    </div>
                ))}
                {otherRecommendations.length > 0 && (
                    <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Más sugerencias:</p>
                        {otherRecommendations.map((sug, index) => (
                            <div key={`rec-extra-${index}`} className="p-2 mb-2 last:mb-0 rounded-lg bg-white border border-gray-200">
                                <p className="font-semibold text-sm text-gray-900 flex items-center gap-1">
                                    <Lightbulb size={14} className="text-indigo-600" />
                                    {sug.mensaje || sug.message}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {sug.productos.map((p, pIdx) => (
                                        <Button
                                            key={`rec-extra-prod-${pIdx}-${p.id}`}
                                            variant="secondary"
                                            size="sm"
                                            className="bg-indigo-600/10 text-indigo-800 hover:bg-indigo-600/20 text-xs py-1 px-3"
                                            onClick={() => addSuggestedProduct(p)}
                                        >
                                            <Plus size={14} />
                                            {p.nombre} · S/{Number(p.price ?? p.precioVenta ?? 0).toFixed(2)}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };
    // --- Fin Renderizado de Sugerencias ---

    // --- Renderizado de Columna 1 (Expandida para búsqueda): Búsqueda Visual ---
    const renderSearchCards = () => (
        <div className="flex flex-col h-[85vh] md:h-full">
            {/* Tabs para Productos/Servicios/Promos */}
            <div className="flex gap-2 mb-4">
                <Button
                    variant={activeTab === 'productos' ? 'primary' : 'outline'}
                    onClick={() => {
                        setActiveTab('productos');
                        setSearchTerm('');
                    }}
                    className="flex-1"
                >
                    <ShoppingCart size={18} /> Productos
                </Button>
                <Button
                    variant={activeTab === 'promos' ? 'primary' : 'outline'}
                    onClick={() => {
                        setActiveTab('promos');
                        setSearchTerm('');
                    }}
                    className="flex-1"
                >
                    <Percent size={18} /> Promos
                </Button>
                <Button
                    variant={activeTab === 'servicios' ? 'primary' : 'outline'}
                    onClick={() => {
                        setActiveTab('servicios');
                        setSearchTerm('');
                    }}
                    className="flex-1"
                >
                    <Stethoscope size={18} /> Otros
                </Button>
                {(habitualItems.length > 0 || activeTab === 'habituales') && (
                    <Button
                        variant={activeTab === 'habituales' ? 'primary' : 'outline'}
                        onClick={() => {
                            setActiveTab('habituales');
                            setSearchTerm('');
                        }}
                        className="flex-1 bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100"
                    >
                        <Star size={18} className={activeTab === 'habituales' ? 'fill-white' : 'fill-yellow-500'} /> Recetas
                    </Button>
                )}
            </div>

            {/* Barra de búsqueda fija - Abarcando más espacio */}
            <Card className="mb-4 p-4 shadow-xl sticky top-0 z-10">
                <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Search size={20} className="text-indigo-600" />
                    Buscar {activeTab === 'servicios' ? 'Otros Servicios' : activeTab === 'promos' ? 'Promoción' : 'Producto'}
                </h3>
                <Input
                    placeholder={activeTab === 'servicios' ? 'Buscar otros (servicios) por nombre...' : activeTab === 'promos' ? 'Buscar promociones...' : 'Escanear Código o Nombre del Producto...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 text-lg py-3" // Tamaño más grande
                />
            </Card>

            {/* Contenedor de Tarjetas (Scrollable) */}
            <div className="flex-1 overflow-y-auto space-y-4 p-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Ajuste a 3 columnas en desktop */}
                    {(activeTab === 'productos' ? loadingProducts : activeTab === 'promos' ? loadingPromos : activeTab === 'servicios' ? loadingServicios : loadingHabitual) ? (
                        <div className="sm:col-span-2 lg:col-span-3 text-center p-10"><p className="text-indigo-600 font-bold animate-pulse">Cargando...</p></div>
                    ) : productSuggestions.length === 0 ? (
                        <div className="sm:col-span-2 lg:col-span-3 text-center p-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <ShoppingCart size={48} className="mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium text-lg">
                                {searchTerm.length > 0 
                                    ? `No se encontraron ${activeTab === 'servicios' ? 'servicios' : activeTab === 'promos' ? 'promociones' : 'productos'} para "${searchTerm}"`
                                    : `No hay ${activeTab === 'servicios' ? 'otros servicios' : activeTab === 'promos' ? 'promociones' : 'productos'} registrados en esta farmacia`}
                            </p>
                        </div>
                    ) : (
                        productSuggestions.map((item, idx) => {
                            if (activeTab === 'promos') {
                                // Renderizado Especial para Promociones
                                const precioNormal = item.items.reduce((sum, pi) => sum + parseFloat(pi.producto.precioVenta) * pi.cantidad, 0);
                                const ahorro = Math.max(0, precioNormal - parseFloat(item.precioPromo));
                                const descPct = precioNormal > 0 ? Math.round((ahorro / precioNormal) * 100) : 0;
                                
                                return (
                                    <Card
                                        key={`promo-${item.id}-${idx}`}
                                        onClick={() => addPromoToCart(item)}
                                        className="p-4 transition-all border border-indigo-200 hover:border-indigo-400 cursor-pointer bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 relative group overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-600 rotate-45 translate-x-6 -translate-y-6 flex items-end justify-center pb-1">
                                            <span className="text-[8px] text-white font-black -rotate-45 mb-1">%</span>
                                        </div>
                                        <div className="flex justify-between items-start mb-2 relative z-10 gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-900 leading-tight uppercase min-h-[44px] break-words line-clamp-2" title={item.nombre}>
                                                    {item.nombre}
                                                </h4>
                                            </div>
                                            {descPct > 0 && (
                                                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-full shrink-0 shadow-lg shadow-rose-200">
                                                    -{descPct}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-1 mb-3 h-16 overflow-hidden relative z-10">
                                            {(item.items || []).slice(0, 3).map((pi, pIdx) => (
                                                <p key={`pi-${pIdx}`} className="text-[11px] text-gray-600 flex items-center gap-1 truncate font-medium">
                                                    <span className="w-1 h-1 bg-indigo-400 rounded-full shrink-0" />
                                                    {pi.cantidad}x {pi.producto.nombre}
                                                </p>
                                            ))}
                                            {item.items.length > 3 && <p className="text-[10px] text-indigo-500 font-bold ml-2 italic">+ ver más productos</p>}
                                        </div>
                                        <div className="pt-2 border-t border-indigo-50 flex justify-between items-end relative z-10">
                                            <div>
                                                <p className="text-[10px] text-gray-400 line-through font-medium">S/ {precioNormal.toFixed(2)}</p>
                                                <p className="text-xs text-indigo-600 font-bold tracking-widest uppercase">Combo</p>
                                            </div>
                                            <div className="text-2xl font-black text-indigo-700 text-right">S/ {parseFloat(item.precioPromo).toFixed(2)}</div>
                                        </div>
                                    </Card>
                                );
                            }

                            if (activeTab === 'habituales') {
                                return productSuggestions.map((h, hIdx) => {
                                    const item = h.producto || h.servicio;
                                    const isService = !!h.servicioId;
                                    const itemPrice = parseFloat(item.precioVenta);
                                    const itemStock = isService ? 999 : (item.stockActual || 0);

                                    return (
                                        <Card
                                            key={`habitual-${h.id}-${hIdx}`}
                                            onClick={() => { if (isService || itemStock > 0) addToCart({ ...item, tipo: isService ? 'servicio' : 'producto' }); }}
                                            className="p-4 transition-all border border-yellow-200 hover:border-yellow-400 cursor-pointer bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 relative overflow-hidden group"
                                        >
                                            <div className="absolute top-0 right-0 w-8 h-8 bg-yellow-400 rotate-45 translate-x-4 -translate-y-4 transition-transform group-hover:scale-150" />
                                            <div className="flex justify-between items-start mb-2 relative z-10 gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-gray-900 leading-tight flex items-center gap-2 min-h-[44px] break-words line-clamp-2">
                                                        <Star size={14} className="fill-yellow-400 text-yellow-400 shrink-0" />
                                                        {item.nombre}
                                                    </h4>
                                                </div>
                                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full shrink-0 font-bold border border-yellow-200 self-start mt-0.5">
                                                    FRECUENTE
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-end mt-4 relative z-10">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-tighter font-semibold">Precio</p>
                                                    <p className="text-xl font-black text-yellow-700">S/ {itemPrice.toFixed(2)}</p>
                                                </div>
                                                {!isService && (
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-gray-500 uppercase tracking-tighter font-semibold">Stock</p>
                                                        <p className={`text-xs font-bold ${itemStock < 5 ? 'text-red-500' : 'text-gray-600'}`}>{itemStock} unid.</p>
                                                    </div>
                                                )}
                                            </div>
                                            <Button 
                                                variant="primary" 
                                                size="sm" 
                                                className="w-full mt-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 border-none text-yellow-900 font-bold shadow-md shadow-yellow-100 active:scale-95 transition-transform" 
                                                disabled={!isService && itemStock <= 0}
                                            >
                                                <Plus size={14} /> Repetir Compra
                                            </Button>
                                        </Card>
                                    );
                                });
                            }

                            // Renderizado Normal para Productos/Servicios
                            const itemPrice = parseFloat(item.precioVenta ?? item.price ?? 0);
                            const itemStock = item.stockActual ?? 0;
                            const isService = activeTab === 'servicios';

                            return (
                                <Card
                                    key={`list-${activeTab}-${item.id}-${idx}`}
                                    onClick={() => { if (isService || itemStock > 0) addToCart(item); }}
                                    className={`p-4 transition-all border group ${!isService && itemStock === 0 ? 'bg-gray-100 opacity-60' : 'hover:border-indigo-400 cursor-pointer shadow-sm hover:shadow-xl bg-white hover:-translate-y-1'}`}
                                >
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-900 leading-tight min-h-[44px] break-words line-clamp-2" title={item.nombre}>
                                                {item.nombre}
                                            </h4>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-bold self-start mt-0.5 ${isService ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                            {isService ? 'SERVICIO' : (item.categoria?.nombre || 'General').toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end mt-4">
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-tighter font-semibold">Precio</p>
                                            <p className="text-2xl font-black text-gray-900">S/ {itemPrice.toFixed(2)}</p>
                                        </div>
                                        {!isService && (
                                            <div className="text-right">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-tighter font-semibold">Stock</p>
                                                <p className={`text-sm font-bold ${itemStock < 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {itemStock < 0 ? 0 : itemStock} <span className="text-[10px] font-normal">unid.</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        className={`w-full mt-3 py-2 transition-transform active:scale-95 ${!isService && itemStock === 0 ? 'bg-gray-400 border-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200'}`}
                                        disabled={!isService && itemStock <= 0}
                                    >
                                        <Plus size={14} /> Agregar
                                    </Button>
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
    // --- Fin Renderizado de Columna 1 (Anteriormente Columna 2) ---

    // --- Renderizado de Columna 2 (Anteriormente Columna 3): Cliente, Sugerencias, Resumen y Carrito Fijo ---
    const renderSummaryAndCart = () => {
        const clientLabel = client.type_doc === 'RUC' ? 'Cliente (RUC)' : `Cliente (${documentType})`;
        return (
            <Card className="sticky top-4 h-[85vh] md:h-full flex flex-col justify-between p-4">

                {/* Indicador de Estado de Caja - Mejorado */}
                {!loadingTurno && (
                    <div className={`mb-4 p-3 rounded-xl border-2 ${turnoActivo
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                        : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-300'
                        } shadow-sm`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${turnoActivo ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-red-500'
                                    }`}></div>
                                <div>
                                    <span className={`text-sm font-bold ${turnoActivo ? 'text-green-800' : 'text-red-800'
                                        }`}>
                                        {turnoActivo ? 'Caja Abierta' : 'Caja Cerrada'}
                                    </span>
                                    {turnoActivo && (
                                        <p className="text-xs text-green-600 mt-0.5">
                                            Turno activo - Puedes vender
                                        </p>
                                    )}
                                    {!turnoActivo && (
                                        <p className="text-xs text-red-600 mt-0.5">
                                            Debes abrir caja para vender
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${turnoActivo
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                                }`}>
                                {turnoActivo ? '🟢 Activo' : '🔴 Inactivo'}
                            </div>
                        </div>
                    </div>
                )}

                {/* 1. Cliente y Documento (Compacto) */}
                <div className="border-b pb-4 mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className='flex gap-2 flex-wrap'>
                            <Button
                                variant={documentType === 'Boleta' ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => handleOpenClientModal('Boleta')}
                                disabled={cart.length === 0}
                            >
                                <ClipboardList size={16} /> Boleta
                            </Button>
                            <Button
                                variant={documentType === 'Factura' ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => handleOpenClientModal('Factura')}
                                disabled={cart.length === 0}
                            >
                                <FileText size={16} /> Factura (RUC)
                            </Button>
                            <Button
                                variant={documentType === 'Nota de Venta' ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setDocumentType('Nota de Venta');
                                    setClient(MOCK_CLIENT);
                                    setAppliedPoints(0);
                                }}
                                disabled={cart.length === 0}
                            >
                                <Banknote size={16} /> Nota de Venta
                            </Button>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenClientModal(documentType)}
                        >
                            <Search size={16} /> {client.id === 0 ? 'Asignar' : 'Editar'}
                        </Button>
                    </div>

                    {/* Info de Cliente y Puntos */}
                    <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                        <p className="text-xs text-gray-500">{clientLabel}:</p>
                        <p className="font-semibold text-gray-900 truncate">{client.nombre_razon}</p>
                        <p className="text-sm text-gray-600">{client.numero_doc}</p>

                        <div className={`p-1 rounded-lg mt-2 flex items-center justify-between ${client.id !== 0 ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                            <div className='flex items-center gap-1'>
                                <Award size={14} className='text-yellow-600' />
                                <p className="font-bold text-sm text-yellow-700">
                                    {client.puntosAcumulados} Puntos
                                </p>
                            </div>
                            <p className="text-xs text-gray-600">
                                ~ S/ {(client.puntosAcumulados * pointValue).toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Carrito Compacto Fijo */}
                < div className="flex-1 overflow-y-auto space-y-3 pr-2 -mr-2" >
                    {
                        cart.length === 0 ? (
                            <div className="text-center p-6 text-gray-400">
                                <ShoppingCart size={30} className="mx-auto mb-2" />
                                <p className="text-sm">Carrito vacío.</p>
                            </div>
                        ) : (
                            cart.map((item, idx) => (
                                <div key={`cart-${item.tipo}-${item.id}-${idx}`} className="p-3 rounded-xl border border-gray-100 flex items-center justify-between bg-white shadow-sm transition-all hover:border-indigo-200">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="font-bold text-sm text-gray-900 leading-tight truncate" title={item.nombre}>{item.nombre}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-[10px] text-gray-500 font-medium">S/ {item.price.toFixed(2)} / ud.</p>
                                            <button 
                                                onClick={() => { setEditingPriceItem(item); setNewPriceValue(item.price.toString()); }}
                                                className="px-1.5 py-0.5 flex items-center gap-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-100 transition-colors"
                                                title="Aumentar precio"
                                            >
                                                <Edit size={10} /> EDITAR
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" className="!p-1 !h-7 !w-7 !min-w-0 border-indigo-300 text-indigo-600" onClick={() => updateQuantity(item.id, -1)}>
                                            <Minus size={14} />
                                        </Button>
                                        <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                                        <Button size="sm" variant="outline" className="!p-1 !h-7 !w-7 !min-w-0 border-indigo-300 text-indigo-600" onClick={() => updateQuantity(item.id, 1)} disabled={item.quantity >= item.stockActual}>
                                            <Plus size={14} />
                                        </Button>
                                    </div>

                                    <div className="text-right ml-3">
                                        <p className="font-bold text-base text-red-600">S/ {(item.price * item.quantity).toFixed(2)}</p>
                                        <button className="text-xs text-gray-400 hover:text-red-500" onClick={() => removeItem(item.id)}>
                                            <X size={14} className="inline-block" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    }
                </div >

                {/* Panel de sugerencias inline */}
                {renderSuggestionPanel()}

                {/* 3. Resumen y TOTAL */}
                <div className="pt-4 border-t mt-4">
                    <div className="space-y-1 text-gray-700 mb-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Op. Gravada (Valor Venta):</span>
                            <span className="font-semibold">S/ {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">IGV ({posConfig?.igvPercent ?? 18}%):</span>
                            <span className="font-semibold">S/ {igv.toFixed(2)}</span>
                        </div>
                        {promoSavings > 0 && (
                            <div className="flex justify-between font-bold text-green-600">
                                <span>Descuento Promocional:</span>
                                <span>- S/ {promoSavings.toFixed(2)}</span>
                            </div>
                        )}
                        {discountByPoints > 0 && (
                            <div className="flex justify-between font-semibold text-gray-700">
                                <span>Descuento:</span>
                                <span>- S/ {discountByPoints.toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    {/* TOTAL A PAGAR - Tamaño ajustado */}
                    <div className="bg-green-600 text-white rounded-lg p-3 my-4">
                        <div className="flex justify-between items-center text-white">
                            <span className="font-medium text-lg">TOTAL A PAGAR</span>
                            <span className="font-bold text-3xl">S/ {total.toFixed(2)}</span>
                        </div>
                    </div>

                    <Button
                        variant="primary"
                        className="w-full text-lg py-3 shadow-lg hover:shadow-xl"
                        onClick={handleStartCheckout}
                        disabled={cart.length === 0}
                    >
                        <Send size={24} />
                        Finalizar Venta
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => {
                            setCart([]);
                            setClient(MOCK_CLIENT);
                            setDocumentType('Boleta');
                            setAppliedPoints(0);
                            setAmountReceived(0);
                            setSearchTerm('');
                            setPointsToRedeem('0');
                            setPointsError(null);
                        }}
                    >
                        <Clock size={18} /> Nueva Transacción
                    </Button>
                </div>
            </Card >
        );
        // --- Fin Renderizado de Columna 3 (Ahora Columna 2) ---

    };


    return (
        <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Columna 1 ahora es 2/3 del ancho en desktop */}
                <div className="lg:col-span-2">
                    {renderSearchCards()}
                </div>
                {/* Columna 2 ahora es 1/3 del ancho en desktop */}
                <div className="lg:col-span-1">
                    {renderSummaryAndCart()}
                </div>
            </div>

            {/* Modal de Pago y Finalización de Venta (con Canje de Puntos) */}
            <Modal
                isOpen={isCheckoutModalOpen}
                title="Paso 2: Procesar Pago"
                onClose={() => setIsCheckoutModalOpen(false)}
            >
                <div className="max-h-[75vh] overflow-y-auto pr-2">
                <div className="mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm mb-3">
                        <div className="flex justify-between text-gray-600">
                            <span>Op. Gravada:</span>
                            <span className="font-semibold">S/ {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>IGV (18%):</span>
                            <span className="font-semibold">S/ {igv.toFixed(2)}</span>
                        </div>
                        {discountByPoints > 0 && (
                            <div className="flex justify-between font-semibold text-gray-700">
                                <span>Descuento:</span>
                                <span>- S/ {discountByPoints.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                    <p className="text-2xl font-bold text-gray-800 text-center">Total Neto a Pagar:</p>
                    <p className="text-5xl font-extrabold text-indigo-600 mt-1 text-center">S/ {total.toFixed(2)}</p>
                    <p className="text-sm text-gray-500 mt-2 text-center">Comprobante: <span className='font-semibold'>{documentType}</span></p>
                    {client.id !== 0 && <p className="text-sm text-gray-500 text-center">Cliente: <span className='font-semibold'>{client.nombre_razon} ({client.numero_doc})</span></p>}
                    {!isClientValidForDoc && (
                        <p className="text-sm text-red-600 font-semibold mt-2 text-center">Se requiere RUC válido para Factura. Edita el cliente o cancela la venta.</p>
                    )}
                </div>

                {/* Gestión de Puntos */}
                {loyaltyEnabled && documentType !== 'Nota de Venta' && client.id !== 0 && client.puntosAcumulados > 0 && (
                    <div className="bg-yellow-50 p-4 rounded-lg mb-4 border border-yellow-200">
                        <div className="flex items-center justify-between mb-2">
                            <p className="font-bold text-yellow-800 flex items-center gap-2">
                                <Award size={18} /> Saldo: {totalClientBalance} pts
                            </p>
                            <p className="text-xs text-yellow-700 font-semibold">
                                S/ {(totalClientBalance * pointValue).toFixed(2)} equivalentes
                            </p>
                        </div>
                        
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="text-[10px] uppercase font-bold text-yellow-700 mb-1 block">Canjear (Utilizable: {canjeablePoints})</label>
                                <input
                                    type="number"
                                    min="0"
                                    max={canjeablePoints}
                                    value={appliedPoints || ''}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setAppliedPoints(Math.min(val, canjeablePoints));
                                    }}
                                    className="w-full p-2 border border-yellow-300 rounded bg-white text-lg font-bold text-indigo-600 focus:ring-2 focus:ring-yellow-500 outline-none"
                                    placeholder="0"
                                />
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-100 h-[46px]"
                                onClick={() => setAppliedPoints(canjeablePoints)}
                            >
                                Max.
                            </Button>
                        </div>

                        {appliedPoints > 0 && (
                            <div className='mt-2 p-2 bg-green-100 rounded-lg flex items-center justify-between border border-green-200'>
                                <p className='font-bold text-green-700 text-sm'>
                                    Descuento Aplicado: S/ {discountByPoints.toFixed(2)}
                                </p>
                                <button className="text-red-500 hover:text-red-700" onClick={() => setAppliedPoints(0)}>
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                        
                        <p className='text-[10px] text-gray-500 mt-2 italic'>
                            *1 punto = S/ {pointValue.toFixed(2)}. Canje solo válido para Factura y Boleta.
                        </p>
                    </div>
                )}

                {/* Selección de Método de Pago */}
                <h4 className="text-lg font-bold text-gray-900 mb-2">Método de Pago</h4>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <Button
                        variant={paymentMethod === 'Efectivo' ? 'primary' : 'outline'}
                        onClick={() => setPaymentMethod('Efectivo')}
                    >
                        <Banknote size={16} /> Efectivo 💵
                    </Button>
                    {(() => {
                        return (pagoMetodos || []).filter(conf => conf.activo).map(conf => {
                            const IconCmp = conf.metodo === 'Yape' ? Smartphone : (conf.metodo === 'Transferencia' ? DollarSign : CreditCard);
                            return (
                                <Button
                                    key={conf.metodo}
                                    variant={paymentMethod === conf.metodo ? 'primary' : 'outline'}
                                    onClick={() => setPaymentMethod(conf.metodo)}
                                >
                                    <IconCmp size={16} /> {conf.nombre}
                                </Button>
                            );
                        });
                    })()}
                </div>

                {paymentMethod !== 'Efectivo' && (
                    <div className="bg-amber-50 p-3 rounded-lg text-center mb-4 border border-amber-200">
                        {(() => {
                            const config = (pagoMetodos || []).find(c => c.metodo === paymentMethod);
                            const nombre = config?.nombre || paymentMethod;
                            const serverUrl = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : 'http://localhost:4000';

                            return (
                                <div className="space-y-3">
                                    <p className="font-bold text-amber-800">
                                        {nombre}
                                    </p>

                                    {config?.imagenUrl ? (
                                        <div className="overflow-hidden border rounded-lg bg-white p-2">
                                            <div 
                                                className="transition-transform duration-200"
                                                style={{ transform: `scale(${config.zoom || 1})` }}
                                            >
                                                <img
                                                    src={`${serverUrl}${config.imagenUrl}`}
                                                    alt={`QR para ${paymentMethod}`}
                                                    className="mx-auto max-h-48 object-contain"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        config?.texto ? (
                                            <div className="bg-white p-4 rounded-lg border border-amber-100 text-amber-900 font-medium whitespace-pre-wrap">
                                                {config.texto}
                                            </div>
                                        ) : (
                                            <div className="bg-white p-4 rounded-lg border border-amber-100 text-gray-400 italic">
                                                Sin imagen ni texto configurado
                                            </div>
                                        )
                                    )}
                                </div>
                            );
                        })()}
                        <p className="text-[10px] text-amber-700 mt-2 uppercase font-bold">
                            Confirmar recepción antes de finalizar.
                        </p>
                    </div>
                )}

                {paymentMethod === 'Efectivo' && (
                    <Input
                        label="Monto Recibido (S/)"
                        type="number"
                        step="0.01"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(Number(e.target.value))}
                        required
                        className="mb-4"
                    />
                )}

                <div className={`flex justify-between text-3xl font-extrabold p-3 rounded-lg ${change > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    <span>VUELTO:</span>
                    <span>S/ {change.toFixed(2)}</span>
                </div>

                </div>

                <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                    <Button type="button" variant="secondary" onClick={() => setIsCheckoutModalOpen(false)}>
                        Volver
                    </Button>
                    <Button
                        variant="success"
                        onClick={handleCheckout}
                        disabled={!canCheckout}
                    >
                        <Send size={18} />
                        Completar Venta y Generar {documentType}
                    </Button>
                </div>
            </Modal>

            {/* Modal de Gestión de Cliente (Boleta Opcional / Factura Obligatorio) */}
            <Modal
                isOpen={isClientModalOpen}
                title={`Asignar Cliente para ${documentType}`}
                onClose={() => setIsClientModalOpen(false)}
            >
                <form className="space-y-4" onSubmit={handleSaveClient}>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                            <Select
                                label="Tipo Doc."
                                name="type_doc"
                                value={posClientData.type_doc}
                                onChange={(e) => setPosClientData(p => ({ ...p, type_doc: e.target.value }))}
                                options={docTypeOptions.filter(opt => documentType === 'Factura' ? opt.value === 'RUC' : true)}
                                required
                            />
                        </div>
                        <div className="col-span-2">
                            <Input
                                label="Número de Documento"
                                name="numero_doc"
                                value={posClientData.numero_doc}
                                onChange={(e) => setPosClientData(p => ({ ...p, numero_doc: e.target.value }))}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-4">

                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={handleDocumentSearch}
                            disabled={searchLoading || (posClientData.type_doc === 'DNI' && posClientData.numero_doc.length !== 8) || (posClientData.type_doc === 'RUC' && posClientData.numero_doc.length !== 11)}
                        >
                            <FileSearch size={16} />
                            {searchLoading ? 'Consultando...' : `Consultar ${posClientData.type_doc}`}
                        </Button>
                    </div>

                    {(documentSuggestionsLoading || documentSuggestions.length > 0) && (
                        <div className="space-y-2 rounded-lg border border-dashed border-indigo-200 bg-white px-3 py-2 text-sm text-gray-700">
                            {documentSuggestionsLoading ? (
                                <p className="text-xs text-gray-500">Buscando clientes registrados...</p>
                            ) : (
                                <>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                                        Clientes encontrados en esta farmacia
                                    </p>
                                    <div className="space-y-2">
                                        {documentSuggestions.map(suggestion => (
                                            <button
                                                type="button"
                                                key={suggestion.id}
                                                onClick={() => handleSelectDocumentSuggestion(suggestion)}
                                                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left hover:border-indigo-500 hover:bg-white"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-semibold text-gray-900">{suggestion.nombreRazon}</span>
                                                    <span className="text-xs text-gray-500">{suggestion.tipoDoc}</span>
                                                </div>
                                                <p className="text-xs text-gray-500">{suggestion.numeroDoc}</p>
                                                {suggestion.puntosAcumulados > 0 && (
                                                    <p className="text-[11px] text-amber-600">{suggestion.puntosAcumulados} puntos acumulados</p>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {searchError && <p className="text-sm text-red-600">{searchError}</p>}

                    <Input
                        label={posClientData.type_doc === 'RUC' ? "Razón Social" : "Nombre Completo"}
                        name="nombre_razon"
                        value={posClientData.nombre_razon}
                        onChange={(e) => setPosClientData(p => ({ ...p, nombre_razon: e.target.value }))}
                        required
                        placeholder="Se puede editar manualmente o buscar con el botón"
                    />

                    {posClientData.type_doc === 'RUC' && (
                        <div className='bg-gray-50 p-3 rounded-lg border border-gray-100'>
                            <p className='text-sm font-semibold text-gray-700 mb-2'>Dirección Fiscal (Autocompletado)</p>
                            <Input
                                label="Dirección Completa"
                                name="direccion"
                                value={posClientData.direccion}
                                onChange={(e) => setPosClientData(p => ({ ...p, direccion: e.target.value }))}
                                placeholder="Se autocompleta con SUNAT (Editable)"
                            />
                            <div className='grid grid-cols-3 gap-3 mt-3'>
                                <Input
                                    label="Distrito"
                                    name="distrito"
                                    value={posClientData.distrito}
                                    onChange={(e) => setPosClientData(p => ({ ...p, distrito: e.target.value }))}
                                    placeholder="Distrito"
                                    className="!p-2 text-sm"
                                />
                                <Input
                                    label="Provincia"
                                    name="provincia"
                                    value={posClientData.provincia}
                                    onChange={(e) => setPosClientData(p => ({ ...p, provincia: e.target.value }))}
                                    placeholder="Provincia"
                                    className="!p-2 text-sm"
                                />
                                <Input
                                    label="Dpto"
                                    name="departamento"
                                    value={posClientData.departamento}
                                    onChange={(e) => setPosClientData(p => ({ ...p, departamento: e.target.value }))}
                                    placeholder="Departamento"
                                    className="!p-2 text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Punto clave: Teléfono (Manual) */}
                    <p className='text-sm font-semibold text-indigo-600 flex items-center gap-2 pt-2'>
                        <Smartphone size={16} />
                        Dato Manual Requerido
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Teléfono para WhatsApp (Opcional)"
                            name="telefono_whatsapp"
                            value={posClientData.telefono_whatsapp}
                            onChange={(e) => setPosClientData(p => ({ ...p, telefono_whatsapp: e.target.value }))}
                            placeholder="Ej: 987654321"
                        />
                        <Input
                            label="Email (Opcional)"
                            type="email"
                            name="email"
                            value={posClientData.email}
                            onChange={(e) => setPosClientData(p => ({ ...p, email: e.target.value }))}
                            placeholder="facturas@empresa.com"
                        />
                    </div>
                    {/* Puntos acumulados se muestran/edita en el modal de Clientes, no aquí */}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="secondary" onClick={() => setIsClientModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" disabled={!posClientData.nombre_razon}>
                            Asignar Cliente
                        </Button>
                    </div>
                </form>
            </Modal>


            <Modal
                isOpen={!!editingPriceItem}
                title="Aumentar Precio de Producto"
                onClose={() => setEditingPriceItem(null)}
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Editando: <span className="font-bold">{editingPriceItem?.nombre}</span>
                    </p>
                    <div className="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-700">
                        Precio Base: <span className="font-bold">S/ {editingPriceItem?.originalPrice.toFixed(2)}</span>
                        <p className="text-[10px] mt-1 italic">* Por política, solo se permite aumentar el precio inicial.</p>
                    </div>
                    <Input
                        label="Nuevo Precio"
                        type="number"
                        step="0.01"
                        min={editingPriceItem?.originalPrice}
                        value={newPriceValue}
                        onChange={(e) => setNewPriceValue(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setEditingPriceItem(null)}>Cancelar</Button>
                        <Button variant="primary" className="flex-1" onClick={handleUpdatePrice}>Guardar Cambio</Button>
                    </div>
                </div>
            </Modal>
            
            <ExpiryNotification 
                alert={expiryAlert} 
                onClose={() => setExpiryAlert(null)} 
            />

        </div>
    );
}
