import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Store,
  Package,
  ListChecks,
  Users,
  Calculator,
  FileText,
  BarChart3,
  Menu,
  X,
  Plus,
  LogOut,
  Wrench,
  UserPlus,
  Tag,
  Activity,
  Stethoscope,
  FileHeart,
  ChevronDown,
  Truck,
  Heart,
  Shield,
  Settings,
  Percent,
} from "lucide-react";
import GestionOtros from "./GestionOtros.jsx";
// import ComprobantesServicios from "./ComprobantesServicios.jsx"; // Deprecated
import { api } from "../../lib/api.js";
import * as XLSX from "xlsx";
import { Card, Button, Input } from "./components/ui.jsx";
import PanelGlobal from "./PanelGlobal.jsx";
import ProductosStock from "./ProductosStock.jsx";
import Categorias from "./Categorias.jsx";
import Usuarios from "./Usuarios.jsx";
import Inventario from "./Inventario.jsx";
import Envios from "./Envios.jsx";
import Etiquetas from "./Etiquetas.jsx";
// --- NUEVOS COMPONENTES ---
import Clientes from "./Clientes.jsx";
import Ofertas from "./Ofertas.jsx";
import Promociones from "./Promociones.jsx";
import SalesPOS from "./SalesPOS.jsx";
import GestionVentas from "./GestionVentas.jsx";
import CajaFinanzas from "./CajaFinanzas.jsx";
import RegistroAuditoria from "./RegistroAuditoria.jsx";
import ConfiguracionPagos from "./ConfiguracionPagos.jsx";
import DashboardFarmacia from "./DashboardFarmacia.jsx";

// Estructura del menú con grupos
// Estructura dinámica del menú basada en roles
const getMenuStructure = (role) => {
  const commonFarmacy = [
    { key: "FarmacyDashboard", name: "Inicio Farmacia", icon: BarChart3 },
    {
      groupName: "INVENTARIO",
      icon: Package,
      items: [
        { key: "Products", name: "Gestión de Ingresos", icon: Truck },
        { key: "Inventario", name: "Inventario", icon: Package },
        { key: "Etiquetas", name: "Creación de Etiquetas", icon: Tag },
        { key: "Categories", name: "Categorías", icon: ListChecks },
      ],
    },
    {
      groupName: "MARKETING Y SERVICIOS",
      icon: Heart,
      items: [
        { key: "Offers", name: "Fidelización y Sugerencias", icon: Tag },
        { key: "Promociones", name: "Promociones", icon: Percent },
        { key: "GestionOtros", name: "Gestión de Otros (Servicios)", icon: Stethoscope },
      ],
    },
    {
      groupName: "PERSONAS",
      icon: Users,
      items: [
        { key: "Vendors", name: "Usuarios", icon: UserPlus },
        { key: "Clients", name: "Clientes", icon: Users },
      ],
    },
    {
      groupName: "FACTURACIÓN",
      icon: FileText,
      items: [
        { key: "GestionVentas", name: "Gestión de Ventas", icon: Calculator },
      ],
    },
    { key: "Sales", name: "Ventas | Punto de Venta (POS)", icon: Calculator },
    { key: "Cashier", name: "Caja y Finanzas", icon: Store },
    { key: "Reports", name: "Auditoría y Reportes", icon: Shield },
    { key: "ConfigPagos", name: "Config. Método de Pago", icon: Settings },
  ];

  if (role === 'VENDEDOR') {
    return {
      Farmacy: [
        { key: "Cashier", name: "Abrir Caja / Finanzas", icon: Store },
        { key: "Sales", name: "Ventas | POS", icon: Calculator },
        { 
          groupName: "INVENTARIO", 
          icon: Package,
          items: [
             { key: "Products", name: "Registro Medicamentos", icon: Truck },
             { key: "Inventario", name: "Stock Inventario", icon: Package },
             { key: "Etiquetas", name: "Etiquetas", icon: Tag },
          ]
        },
        { key: "GestionVentas", name: "Gestión de Ventas", icon: FileText },
        { key: "Clients", name: "Gestión Clientes", icon: Users },
      ]
    };
  }

  return {
    Global: [
      { key: "GlobalDashboard", name: "Panel global", icon: LayoutDashboard },
      { key: "GlobalSettings", name: "Ajustes", icon: Wrench },
    ],
    Farmacy: commonFarmacy
  };
};

const MASTER_FALLBACK_PRODUCTS = [
  {
    productoDigemidId: "FALLBACK-01",
    nombre: "Dolo-Neurobion Forte",
    concentracion: "50mg/50mg/1mg/50mg",
    formaFarmaceutica: "Tableta",
    presentacion: "Caja x 30",
    laboratorio: "Merck",
    registroSanitario: "NSK-345",
  },
  {
    productoDigemidId: "FALLBACK-02",
    nombre: "Amoxicilina 500mg",
    concentracion: "500mg",
    formaFarmaceutica: "Capsula",
    presentacion: "Caja x 100",
    laboratorio: "ACME Labs",
    registroSanitario: "ABC-123",
  },
];

const FarmacyDashboard = ({ farmacy, user }) => <DashboardFarmacia farmacia={farmacy} user={user} />;

const PlaceholderModule = ({ title }) => (
  <Card>
    <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
    <p className="text-gray-500">
      Este modulo se conectara con los endpoints correspondientes cuando esten disponibles en el backend.
    </p>
  </Card>
);

const Sidebar = ({ currentScreen, setCurrentScreen, context, onExit, isOpen, toggleSidebar, hasFarmacia, isCollapsed, setIsCollapsed, userRole, onLogout }) => {
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const menuItems = getMenuStructure(userRole)[context] || [];

  const renderMenuItem = (item, index) => {
    // Si es un grupo
    if (item.groupName) {
      const isExpanded = expandedGroups[item.groupName];
      return (
        <div key={`group-${index}`} className="mb-1">
          <button
            onClick={() => toggleGroup(item.groupName)}
            className="w-full flex items-center justify-between p-3 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon size={18} />
              {!isCollapsed && <span className="text-xs font-bold uppercase tracking-wider">{item.groupName}</span>}
            </div>
            {!isCollapsed && (
              <ChevronDown
                size={16}
                className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            )}
          </button>
          {isExpanded && !isCollapsed && (
            <div className="ml-4 mt-1 space-y-1">
              {item.items.map((subItem) => (
                <button
                  key={subItem.key}
                  onClick={() => {
                    setCurrentScreen(subItem.key);
                    if (isOpen) toggleSidebar();
                  }}
                  className={`w-full flex items-center gap-3 p-2 pl-4 rounded-lg text-left transition-colors ${currentScreen === subItem.key
                    ? "bg-indigo-600 text-white"
                    : "text-gray-300 hover:bg-gray-700"
                    }`}
                >
                  <subItem.icon size={18} />
                  <span className="text-sm">{subItem.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Si es un item normal
    return (
      <button
        key={item.key}
        onClick={() => {
          setCurrentScreen(item.key);
          if (isOpen) toggleSidebar();
        }}
        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${currentScreen === item.key
          ? "bg-indigo-600 text-white"
          : "text-gray-300 hover:bg-gray-700"
          } ${isCollapsed ? 'justify-center' : ''}`}
        title={isCollapsed ? item.name : ''}
      >
        <item.icon size={20} />
        {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
      </button>
    );
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black/50 z-20 lg:hidden ${isOpen ? "block" : "hidden"}`} onClick={toggleSidebar} />
      <aside
        className={`fixed inset-y-0 left-0 z-30 bg-gray-900 text-white flex flex-col transform transition-all duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"
          } lg:relative lg:translate-x-0 ${isCollapsed ? "w-20" : "w-64"}`}
      >
        <div className={`p-4 flex items-center justify-between border-b border-gray-800 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && <h1 className="text-2xl font-extrabold text-indigo-400">CBMedic</h1>}
          <button onClick={toggleSidebar} className="text-gray-400 hover:text-white lg:hidden">
            <X size={24} />
          </button>
        </div>
        {context === "Farmacy" && hasFarmacia && userRole === 'ADMIN' && (
          <div className="p-4 border-b border-gray-800">
            <Button variant="secondary" className={`w-full text-xs ${isCollapsed ? 'px-2' : ''}`} onClick={onExit}>
              {!isCollapsed && 'Volver al panel'}
            </Button>
          </div>
        )}
        <nav className="flex-grow overflow-y-auto p-2">
          {menuItems.map((item, index) => renderMenuItem(item, index))}
        </nav>
        <div className="p-2 border-t border-gray-800 space-y-1">
          <button 
            onClick={onLogout} 
            className="w-full flex items-center gap-3 p-3 rounded-lg text-red-400 hover:bg-red-900/20 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={20} />
            {!isCollapsed && <span className="text-sm font-bold">Cerrar Sesión</span>}
          </button>
          
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="w-full flex items-center gap-3 p-3 rounded-lg text-gray-300 hover:bg-gray-700">
            <Menu size={20} />
            {!isCollapsed && <span className="text-sm font-medium">Contraer Menú</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default function AdminShell({ session, onLogout }) {
  const isVendedor = session.user.role === 'VENDEDOR';
  const sessionFarmaciaId = session.user.farmacia?.id;
  const [currentScreen, setCurrentScreen] = useState(isVendedor ? "Cashier" : "GlobalDashboard");
  const [context, setContext] = useState(isVendedor ? "Farmacy" : "Global");
  const [farmacias, setFarmacias] = useState([]);
  const [selectedFarmacia, setSelectedFarmacia] = useState(null);
  const [loadingFarmacias, setLoadingFarmacias] = useState(false);
  const [errorFarmacias, setErrorFarmacias] = useState(null);
  const [savingFarmacia, setSavingFarmacia] = useState(false);
  const [formError, setFormError] = useState(null);
  const [editingFarmacia, setEditingFarmacia] = useState(null);
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingError, setEditingError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [masterSummary, setMasterSummary] = useState(null);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState(null);
  const [masterUploading, setMasterUploading] = useState(false);

  const fetchFarmacias = async () => {
    setLoadingFarmacias(true);
    setErrorFarmacias(null);
    try {
      const { data } = await api.get("/farmacias");
      const filtered = isVendedor 
        ? data.filter(f => Number(f.id) === Number(sessionFarmaciaId))
        : data;
      setFarmacias(filtered);
      setSelectedFarmacia(filtered[0] || null);
    } catch (err) {
      setErrorFarmacias("No se pudieron cargar las farmacias.");
    } finally {
      setLoadingFarmacias(false);
    }
  };

  useEffect(() => {
    fetchFarmacias();
  }, []);

  const fetchMasterSummary = async () => {
    setMasterLoading(true);
    setMasterError(null);
    try {
      const { data } = await api.get("/master/summary");
      setMasterSummary(data);
    } catch (err) {
      setMasterError("No se pudo obtener el resumen de la base maestra.");
    } finally {
      setMasterLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterSummary();
  }, []);

  const handleChangeOwnPassword = async (password) => {
    await api.put(`/users/${session.user.id}/password`, { password });
  };

  const handleUpdateProfile = async (fullName, username) => {
    const { data } = await api.put('/users/profile', { fullName, username });
    if (session.user) {
      session.user.fullName = data.fullName;
      session.user.username = data.username;
    }
  };

  const normalizeHeader = (value = "") =>
    value
      .toString()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase();

  const fieldMap = {
    cod_prod: "productoDigemidId",
    nom_prod: "nombre",
    concent: "concentracion",
    nom_form_farm: "formaFarmaceutica",
    presentac: "presentacion",
    fraccion: "fraccion",
    num_regsan: "registroSanitario",
    nom_titular: "laboratorio",
    nom_fabricante: "fabricante",
    nom_ifa: "principioActivo",
    nom_rubro: "rubro",
    situacion: "situacion",
  };

  const detectHeaderRow = (rows) => {
    if (!rows?.length) return null;
    const required = ["cod_prod", "nom_prod"];
    const maxScan = Math.min(rows.length, 25);
    for (let i = 0; i < maxScan; i += 1) {
      const normalized = rows[i].map((cell) => normalizeHeader(cell));
      const headerIndex = normalized.reduce((acc, header, idx) => {
        if (header) acc[header] = idx;
        return acc;
      }, {});
      const hasRequired = required.every((key) => headerIndex[key] !== undefined);
      if (hasRequired) {
        return { index: i, headers: normalized, headerIndex };
      }
    }
    return null;
  };

  const transformRowsToProducts = (rows) => {
    if (!rows || rows.length < 2) return MASTER_FALLBACK_PRODUCTS;
    const headerInfo = detectHeaderRow(rows);
    if (!headerInfo) return MASTER_FALLBACK_PRODUCTS;
    const { index: headerRowIndex, headerIndex } = headerInfo;

    const products = rows.slice(headerRowIndex + 1).map((cells, index) => {
      const record = {
        productoDigemidId: `FILE-${index + 1}`,
        nombre: "",
        concentracion: null,
        formaFarmaceutica: null,
        presentacion: null,
        registroSanitario: null,
        laboratorio: null,
        fabricante: null,
        rubro: null,
        principioActivo: null,
        fraccion: null,
        situacion: null,
      };
      Object.entries(fieldMap).forEach(([column, target]) => {
        const colIndex = headerIndex[column];
        if (colIndex !== undefined && cells[colIndex]) {
          record[target] = cells[colIndex].toString().trim() || record[target];
        }
      });
      if (!record.nombre) {
        record.nombre = `Producto ${index + 1}`;
      }
      return record;
    });

    return products.filter((p) => p.nombre?.length).length ? products : MASTER_FALLBACK_PRODUCTS;
  };

  const parseDelimitedText = (text) => {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const detectDelimiter = (sample) => {
      if (sample.includes("\t")) return "\t";
      if (sample.includes(";")) return ";";
      return ",";
    };
    const delimiter = detectDelimiter(lines[0]);
    return lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
  };

  const parseMasterFile = async (file) => {
    if (!file) return MASTER_FALLBACK_PRODUCTS;
    const name = file.name?.toLowerCase() || "";
    const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");
    try {
      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        return transformRowsToProducts(rows);
      }
      const text = await file.text();
      const rows = parseDelimitedText(text);
      return transformRowsToProducts(rows);
    } catch (err) {
      console.error("No se pudo interpretar el archivo maestro:", err);
      return MASTER_FALLBACK_PRODUCTS;
    }
  };

  const handleMasterUpload = async (file, done) => {
    try {
      setMasterUploading(true);
      setMasterError(null);
      const parsedProducts = await parseMasterFile(file);
      await api.post("/master/import", {
        filename: file.name,
        importedBy: session.user?.username || "admin",
        productos: parsedProducts,
      });
      await fetchMasterSummary();
      if (done) done(null);
    } catch (err) {
      const message = err?.response?.data?.error || "No se pudo cargar la base maestra.";
      setMasterError(message);
      if (done) done(message);
    } finally {
      setMasterUploading(false);
    }
  };

  const handleCreateFarmacia = async (payload, resetCallback) => {
    setSavingFarmacia(true);
    setFormError(null);
    try {
      const body = {
        nombre: payload.nombre.trim(),
        direccion: payload.direccion.trim(),
        ruc: payload.ruc.trim(),
        telefono: payload.telefono?.trim() || null,
        email: payload.email?.trim() || null,
      };
      const { data } = await api.post("/farmacias", body);
      setFarmacias((prev) => [data, ...prev]);
      resetCallback();
      if (!selectedFarmacia) {
        setSelectedFarmacia(data);
      }
    } catch (err) {
      const status = err?.response?.status;
      let message = "No se pudo crear la farmacia.";
      if (status === 409) message = "Ya existe una farmacia con ese RUC.";
      else if (err?.response?.data?.error) message = err.response.data.error;
      setFormError(message);
    } finally {
      setSavingFarmacia(false);
    }
  };

  const handleUpdateFarmacia = async (payload, resetCallback) => {
    if (!editingFarmacia) return;
    setEditingLoading(true);
    setEditingError(null);
    try {
      const body = {
        nombre: payload.nombre.trim(),
        direccion: payload.direccion.trim(),
        ruc: payload.ruc.trim(),
        telefono: payload.telefono?.trim() || null,
        email: payload.email?.trim() || null,
      };
      const { data } = await api.put(`/farmacias/${editingFarmacia.id}`, body);
      setFarmacias((prev) => prev.map((f) => (f.id === data.id ? data : f)));
      if (selectedFarmacia?.id === data.id) {
        setSelectedFarmacia(data);
      }
      resetCallback(data);
      setEditingFarmacia(null);
    } catch (err) {
      const status = err?.response?.status;
      let message = "No se pudo actualizar la farmacia.";
      if (status === 409) message = "Ya existe una farmacia con ese RUC.";
      else if (err?.response?.data?.error) message = err.response.data.error;
      setEditingError(message);
    } finally {
      setEditingLoading(false);
    }
  };

  const promptDeleteFarmacia = (farmacia) => {
    setDeleteTarget(farmacia);
    setDeletePassword("");
    setDeleteError(null);
    setDeleteLoading(false);
  };

  const confirmDeleteFarmacia = async () => {
    if (!deleteTarget) return;
    if (!deletePassword.trim()) {
      setDeleteError("Ingresa la contrasena del administrador.");
      return;
    }
    const adminUsername = session.user?.username;
    if (!adminUsername) {
      setDeleteError("No se reconoce el usuario administrador.");
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      // Reforzamos el token directamente en la petición por si el interceptor falla
      const token = localStorage.getItem('cb_token');
      
      await api.delete(`/farmacias/${deleteTarget.id}`, {
        data: {
          adminUsername,
          adminPassword: deletePassword,
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const updated = farmacias.filter((f) => f.id !== deleteTarget.id);
      setFarmacias(updated);
      if (selectedFarmacia?.id === deleteTarget.id) {
        setSelectedFarmacia(null);
      }
      closeDeleteModal();
    } catch (err) {
      console.error("Error al eliminar farmacia:", err);
      const status = err?.response?.status;
      let message = "No se pudo eliminar la farmacia.";
      
      if (status === 401) {
        message = "Contraseña de administrador incorrecta o sesión expirada.";
      } else if (status === 403) {
        message = "No tienes permisos para realizar esta acción.";
      } else if (err?.response?.data) {
        const data = err.response.data;
        message = data.error || message;
        // Agregamos detalles técnicos si existen
        if (data.step || data.details) {
          message += `\n\n[Error Técnico]: ${data.step || ''} - ${data.details || ''}`;
        }
      }
      
      setDeleteError(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeletePassword("");
    setDeleteError(null);
    setDeleteLoading(false);
  };

  const startEditingFarmacia = (farmacia) => {
    setEditingFarmacia(farmacia);
    setEditingError(null);
  };

  const cancelEditingFarmacia = () => {
    setEditingFarmacia(null);
    setEditingError(null);
  };

  const enterFarmacia = (farmacia) => {
    setSelectedFarmacia(farmacia);
    setContext("Farmacy");
    localStorage.setItem('cb_target_farmacia_id', farmacia.id);
    
    // Default screen for VENDEDOR: Cashier (Open Cash)
    if (session.user.role === 'VENDEDOR') {
      setCurrentScreen("Cashier");
    } else {
      setCurrentScreen("FarmacyDashboard");
    }
  };

  const exitFarmacia = () => {
    setContext("Global");
    setCurrentScreen("GlobalDashboard");
    localStorage.removeItem('cb_target_farmacia_id');
  };

  const renderFarmacyModules = () => {
    if (!selectedFarmacia) {
      return (
        <Card>
          <p className="text-gray-600">Selecciona una farmacia desde el panel global.</p>
        </Card>
      );
    }

    switch (currentScreen) {
      case "FarmacyDashboard":
        return <FarmacyDashboard farmacy={selectedFarmacia} user={session.user} />;
      case "Products":
        return <Envios farmacia={selectedFarmacia} user={session.user} />; 
      case "Inventario":
        return <Inventario farmacia={selectedFarmacia} user={session.user} />;
      case "Etiquetas":
        return <Etiquetas farmacia={selectedFarmacia} user={session.user} />;
      case "Categories":
        return <Categorias farmacia={selectedFarmacia} user={session.user} />;
      case "Vendors":
        return <Usuarios farmacia={selectedFarmacia} user={session.user} />;
      // --- RENDERIZADO DE NUEVOS COMPONENTES ---
      case "Clients":
        return <Clientes farmacia={selectedFarmacia} user={session.user} />;
      case "Offers":
        return <Ofertas farmacia={selectedFarmacia} user={session.user} />;
      case "Promociones":
        return <Promociones farmacia={selectedFarmacia} user={session.user} />;
      case "Sales":
        return <SalesPOS farmacia={selectedFarmacia} user={session.user} />;
      case "GestionOtros":
        return <GestionOtros farmacia={selectedFarmacia} user={session.user} />;
      case "GestionVentas":
        return <GestionVentas farmacia={selectedFarmacia} user={session.user} />;
      // ------------------------------------
      case "Cashier":
        return <CajaFinanzas farmacia={selectedFarmacia} user={session.user} />;
      case "Reports":
        return <RegistroAuditoria farmacia={selectedFarmacia} user={session.user} />;
      case "ConfigPagos":
        return <ConfiguracionPagos farmacia={selectedFarmacia} user={session.user} />;
      case "ComprobantesServicios":
        return <ComprobantesServicios farmacia={selectedFarmacia} user={session.user} />;
      default:
        return <FarmacyDashboard farmacy={selectedFarmacia} />;
    }
  };

  const editContext = {
    record: editingFarmacia,
    onSubmit: handleUpdateFarmacia,
    onCancel: cancelEditingFarmacia,
    loading: editingLoading,
    error: editingError,
  };

  const activeGlobalTab = currentScreen === "GlobalSettings" ? "settings" : "dashboard";

  const mainContent =
    context === "Global" ? (
      <PanelGlobal
        adminName={session.user.fullName}
        adminUsername={session.user.username}
        activeTab={activeGlobalTab}
        onTabChange={(tab) => setCurrentScreen(tab === "settings" ? "GlobalSettings" : "GlobalDashboard")}
        farmacias={farmacias}
        loadingFarmacias={loadingFarmacias}
        errorFarmacias={errorFarmacias}
        onRefreshFarmacias={fetchFarmacias}
        onEnterFarmacia={enterFarmacia}
        onEditFarmacia={startEditingFarmacia}
        onDeleteFarmacia={promptDeleteFarmacia}
        onCreateFarmacia={handleCreateFarmacia}
        createLoading={savingFarmacia}
        createError={formError}
        editContext={editContext}
        masterSummary={masterSummary}
        masterLoading={masterLoading}
        masterError={masterError}
        onUploadMaster={handleMasterUpload}
        masterUploading={masterUploading}
        onChangePassword={handleChangeOwnPassword}
        onUpdateProfile={handleUpdateProfile}
      />
    ) : (
      renderFarmacyModules()
    );

  const getTitle = () => {
    if (context === "Global") {
      return currentScreen === "GlobalSettings" ? "Ajustes del Sistema" : "Panel global";
    }

    // Buscar en la estructura del menú
    const menuItems = getMenuStructure(session.user.role)[context] || [];
    for (const item of menuItems) {
      if (item.key === currentScreen) {
        return item.name;
      }
      if (item.items) {
        const subItem = item.items.find(sub => sub.key === currentScreen);
        if (subItem) return subItem.name;
      }
    }
    return "Farmacia";
  };

  return (
    <div className="min-h-screen bg-gray-100 font-inter flex">
      <Sidebar
        currentScreen={currentScreen}
        setCurrentScreen={setCurrentScreen}
        context={context}
        onExit={exitFarmacia}
        isOpen={sidebarOpen}
        toggleSidebar={() => setSidebarOpen((prev) => !prev)}
        hasFarmacia={!!selectedFarmacia}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        userRole={session.user.role}
        onLogout={onLogout}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-md p-4 flex items-center justify-between md:hidden sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen((prev) => !prev)} className="text-gray-600 hover:text-indigo-600">
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold text-gray-800">{getTitle()}</h2>
          </div>
          {(currentScreen === "GlobalDashboard" || currentScreen === "FarmacyDashboard" || session.user.role === 'VENDEDOR') && (
            <Button variant="danger" onClick={onLogout} className="flex items-center gap-2">
              <LogOut size={18} />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          <div className="hidden md:flex items-center justify-between">
            {currentScreen !== "Sales" && (
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900">{getTitle()}</h1>
                <p className="text-gray-500">Bienvenido, {session.user.fullName}</p>
              </div>
            )}
            {currentScreen === "Sales" && <div />}
            {(currentScreen === "GlobalDashboard" || currentScreen === "FarmacyDashboard") && (
              <Button variant="danger" onClick={onLogout}>
                <LogOut size={18} />
                Cerrar sesion
              </Button>
            )}
          </div>
          {errorFarmacias && context === "Global" && (
            <Card className="border border-red-200 bg-red-50">
              <p className="text-sm text-red-600">{errorFarmacias}</p>
            </Card>
          )}
          {mainContent}
        </main>
      </div>
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg space-y-4">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">Eliminar farmacia</h3>
              <p className="text-sm text-gray-600">
                Estas a punto de eliminar <span className="font-semibold">{deleteTarget.nombre}</span>. Cada farmacia
                mantiene tablas y datos independientes (productos, ventas, caja, clientes). Esta accion eliminara
                permanentemente toda la informacion asociada a esta farmacia.
              </p>
              <p className="text-sm text-red-600 font-semibold">Esta operacion no se puede deshacer.</p>
            </div>
            <Input
              label="Confirma con la contrasena del administrador"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Contrasena"
              required
            />
            {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={closeDeleteModal} disabled={deleteLoading}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDeleteFarmacia} disabled={deleteLoading}>
                {deleteLoading ? "Eliminando..." : "Eliminar definitivamente"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
