import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Search, ArrowLeft, Save, FileDown, Edit, AlertTriangle, Camera } from "lucide-react";
import { api } from "../../lib/api.js";
import { Card, Button, Input, Select, Modal } from "./components/ui.jsx";
import { formatDateSafe, toDateInputValue, toNoonUTC } from "../../lib/dateUtils.js";
import BarcodeScannerModal from "./components/BarcodeScannerModal.jsx";

const createEmptyForm = () => ({
  codigoBarras: "",
  nombre: "",
  principioActivo: "",
  concentracion: "",
  laboratorio: "",
  presentacion: "",
  descripcion: "",
  precioCosto: "",
  precioVenta: "",
  stockActual: "",
  stockMinimo: "",
  lote: "",
  fechaVencimiento: "",
});

export default function ProductosStock({ farmacia, onBack }) {
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const [shipmentItems, setShipmentItems] = useState([]);
  const [shipmentTitle, setShipmentTitle] = useState("");
  const [savingShipment, setSavingShipment] = useState(false);
  const [formError, setFormError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [localSuggestions, setLocalSuggestions] = useState([]);
  const [localSuggestLoading, setLocalSuggestLoading] = useState(false);

  const [quickAddTarget, setQuickAddTarget] = useState(null);
  const [quickAddForm, setQuickAddForm] = useState({ cantidad: "", fechaVencimiento: "", lote: "" });

  const [editTarget, setEditTarget] = useState(null);

  const [formData, setFormData] = useState(createEmptyForm());
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeWarning, setBarcodeWarning] = useState(null);

  const treatAsMedicamento = useMemo(() => {
    const cat = categories.find((c) => c.id === selectedCategoryId);
    return cat ? cat.nombre.toLowerCase().includes("medic") : false;
  }, [categories, selectedCategoryId]);

  const fetchCategories = async () => {
    if (!farmacia?.id) return;
    setLoadingCategories(true);
    try {
      const { data } = await api.get("/categories", { params: { farmaciaId: farmacia.id } });
      setCategories(data);
      if (data.length > 0) {
        setSelectedCategoryId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Auto-generar lote al montar
  const fetchAutoLote = async () => {
    try {
      const { data } = await api.get("/envios/generate-lote");
      setFormData(prev => ({ ...prev, lote: data.lote }));
    } catch (err) {
      console.error("Error generando lote:", err);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchAutoLote();
  }, [farmacia?.id]);

  // Validar código de barras contra el servidor (debounced)
  useEffect(() => {
    const barcode = formData.codigoBarras?.trim();
    if (!barcode || barcode.length < 3) {
      setBarcodeWarning(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        // Primero verificar en la lista actual
        const inList = shipmentItems.find(item => item.codigoBarras === barcode);
        if (inList) {
          if (!cancelled) setBarcodeWarning(`Este código ya está en la lista actual: "${inList.nombre}"`);
          return;
        }
        // Verificar en el servidor
        const { data } = await api.get("/envios/validate-barcode", { params: { code: barcode } });
        if (!cancelled) {
          if (data.exists) {
            setBarcodeWarning(`Este código ya existe en el inventario: "${data.productName}"`);
          } else {
            setBarcodeWarning(null);
          }
        }
      } catch (err) {
        if (!cancelled) console.error(err);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formData.codigoBarras, shipmentItems]);

  useEffect(() => {
    if (searchTerm.length < 3 || !treatAsMedicamento) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSuggestLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/master/products", { params: { q: searchTerm } });
        if (!cancelled) setSuggestions(data);
      } catch (err) {
        if (!cancelled) console.error(err);
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, treatAsMedicamento]);

  useEffect(() => {
    if (localSearchTerm.length < 3) {
      setLocalSuggestions([]);
      return;
    }
    let cancelled = false;
    setLocalSuggestLoading(true);
    const timer = setTimeout(async () => {
      try {
        const term = localSearchTerm.trim();
        const { data } = await api.get("/products", { 
          params: { farmaciaId: farmacia?.id, search: term } 
        });
        if (!cancelled) {
            setLocalSuggestions(data);
            if (data.length === 1 && data[0].codigoBarras === term) {
                // Auto-select on exact barcode scan
                handleLocalSuggestionSelect(data[0]);
            }
        }
      } catch (err) {
        if (!cancelled) console.error(err);
      } finally {
        if (!cancelled) setLocalSuggestLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [localSearchTerm, farmacia?.id]);

  const handleSuggestionSelect = (producto) => {
    setFormData((prev) => ({
      ...prev,
      nombre: producto.nombre ?? prev.nombre,
      principioActivo: producto.principioActivo || producto.laboratorio || "",
      concentracion: producto.concentracion || "",
      laboratorio: producto.laboratorio || "",
      presentacion: producto.presentacion || "",
      descripcion: producto.formaFarmaceutica || "",
    }));
    setSearchTerm(producto.nombre || "");
    setSuggestions([]);
  };

  const handleLocalSuggestionSelect = (producto) => {
    setQuickAddTarget(producto);
    setQuickAddForm({ cantidad: "", fechaVencimiento: "", lote: "" });
    setLocalSearchTerm("");
    setLocalSuggestions([]);
    // Auto-generar lote para el quick add
    api.get("/envios/generate-lote").then(({ data }) => {
      setQuickAddForm(prev => ({ ...prev, lote: data.lote }));
    }).catch(() => {});
  };

  const handleQuickAddSubmit = (event) => {
    event.preventDefault();
    if (!quickAddForm.cantidad || !quickAddForm.fechaVencimiento || !quickAddForm.lote) {
        setFormError("Todos los campos (Cantidad, Vencimiento y Lote) son obligatorios.");
        return;
    }

    // Validar que el lote no se repita en la lista
    const loteDup = shipmentItems.find(item => item.lote === quickAddForm.lote);
    if (loteDup) {
      setFormError(`El lote "${quickAddForm.lote}" ya existe en la lista actual.`);
      return;
    }

    setShipmentItems((prev) => [
      {
        ...quickAddTarget,
        id: Date.now(), // temporary id
        productoId: quickAddTarget.id,
        stockActual: quickAddForm.cantidad,
        fechaVencimiento: quickAddForm.fechaVencimiento,
        lote: quickAddForm.lote,
        categoriaNombre: categories.find((c) => c.id === quickAddTarget.categoriaId)?.nombre || quickAddTarget.categoria?.nombre || "",
      },
      ...prev,
    ]);
    setFormError(null);
    setQuickAddTarget(null);
  };

  const handleAddItem = async (event) => {
    event.preventDefault();
    if (!selectedCategoryId) {
      setFormError("Selecciona una categoria para el producto.");
      return;
    }
    if (!formData.nombre || !formData.stockActual || !formData.precioVenta) {
      setFormError("Completa los campos obligatorios (nombre, stock, precio de venta).");
      return;
    }

    const barcode = formData.codigoBarras?.trim();

    // Validar código de barras si se proporcionó
    if (barcode) {
      // Verificar en la lista actual
      const inList = shipmentItems.find(item => item.codigoBarras === barcode);
      if (inList) {
        setFormError(`El código de barras "${barcode}" ya está en la lista: "${inList.nombre}".`);
        return;
      }
      // Verificar en el servidor
      try {
        const { data } = await api.get("/envios/validate-barcode", { params: { code: barcode } });
        if (data.exists) {
          setFormError(`El código de barras "${barcode}" ya existe en el inventario: "${data.productName}". Usa "Buscar en inventario local" para reabastecer.`);
          return;
        }
      } catch (err) {
        console.error("Error validando barcode:", err);
      }
    }

    // Validar que el lote no se repita en la lista
    const lote = formData.lote?.trim();
    if (lote) {
      const loteDup = shipmentItems.find(item => item.lote === lote);
      if (loteDup) {
        setFormError(`El lote "${lote}" ya existe en la lista actual.`);
        return;
      }
    }

    setShipmentItems((prev) => [
      {
        ...formData,
        id: Date.now(), // temporary id
        categoriaId: selectedCategoryId,
        categoriaNombre: categories.find((c) => c.id === selectedCategoryId)?.nombre || "",
      },
      ...prev,
    ]);
    setFormError(null);
    setFormData(createEmptyForm());
    setSearchTerm("");
    setSuggestions([]);
    setBarcodeWarning(null);
    // Generar nuevo lote para el siguiente producto
    fetchAutoLote();
  };

  const handleRemoveItem = (id) => {
    setShipmentItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveShipment = async (applyDirect) => {
    if (!shipmentItems.length || !farmacia?.id) return;
    setSavingShipment(true);
    setFormError(null);
    try {
      await api.post("/envios", {
        farmaciaId: farmacia.id,
        titulo: shipmentTitle.trim() || `Envío ${new Date().toLocaleDateString()}`,
        items: shipmentItems.map(({ categoriaNombre, ...item }) => ({
          ...item,
          fechaVencimiento: toNoonUTC(item.fechaVencimiento),
        })),
        applyDirect,
      });
      onBack(); // Go back to the list view
    } catch (err) {
      const message = err?.response?.data?.error || "No se pudo registrar el envio.";
      setFormError(message);
    } finally {
      setSavingShipment(false);
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Nuevo Ingreso</h1>
          <p className="text-gray-500">Añade productos a la lista para crear un nuevo ingreso para {farmacia?.nombre}</p>
        </div>
      </div>

      <Card>
        <form className="space-y-6" onSubmit={handleAddItem}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre de quien registra"
              name="shipmentTitle"
              value={shipmentTitle}
              onChange={(e) => setShipmentTitle(e.target.value)}
              placeholder="Ej: Juan Pérez"
            />
            <Select
              label="Categoría del Producto"
              required
              value={selectedCategoryId || ""}
              onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
              disabled={loadingCategories}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                Buscar en inventario local (Reabastecer)
                {localSuggestLoading && <span className="text-xs text-emerald-500">(buscando...)</span>}
              </label>
              <div className="relative mt-1">
                <input
                  className="w-full p-3 border border-emerald-300 rounded-lg pr-10 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50"
                  placeholder="Buscar por nombre o código de barras local"
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                />
                <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                {localSuggestions.length > 0 && (
                  <Card className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto p-0 border-emerald-200">
                    {localSuggestions.map((item) => (
                      <button
                        key={`local-${item.id}`}
                        type="button"
                        onClick={() => handleLocalSuggestionSelect(item)}
                        className="w-full text-left p-3 border-b border-emerald-100 text-sm hover:bg-emerald-100"
                      >
                        <p className="font-bold text-emerald-900">{item.nombre}</p>
                        <p className="text-xs text-emerald-700">
                          {item.codigoBarras || 'Sin código'} | Stock Actual: {item.stockActual} | Cat: {item.categoria?.nombre}
                        </p>
                      </button>
                    ))}
                  </Card>
                )}
              </div>
            </div>
            {/* Empty div for grid alignment */}
            <div></div>
          </div>

          {treatAsMedicamento ? (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  Buscar en base maestra
                  {suggestLoading && <span className="text-xs text-gray-500">(buscando...)</span>}
                </label>
                <div className="relative mt-1">
                  <input
                    className="w-full p-3 border border-gray-300 rounded-lg pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Ingresa al menos 3 caracteres para buscar medicamentos"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  {suggestions.length > 0 && (
                    <Card className="absolute z-10 w-full mt-2 max-h-60 overflow-y-auto p-0">
                      {suggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSuggestionSelect(item)}
                          className="w-full text-left p-3 border-b text-sm hover:bg-indigo-50"
                        >
                          <p className="font-medium">{item.nombre}</p>
                          <p className="text-xs text-gray-500">
                            {item.presentacion} - {item.laboratorio}
                          </p>
                        </button>
                      ))}
                    </Card>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Código de Barras (Opcional)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      name="codigoBarras"
                      value={formData.codigoBarras}
                      onChange={handleFormChange}
                      placeholder="Dejar vacío si no tiene"
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="button" onClick={() => setScannerOpen(true)}
                      className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0"
                      title="Escanear con cámara">
                      <Camera size={20} />
                    </button>
                  </div>
                  {barcodeWarning && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} /> {barcodeWarning}
                    </p>
                  )}
                </div>
                <Input label="Nombre" name="nombre" required value={formData.nombre} onChange={handleFormChange} />
                <Input label="Principio Activo" name="principioActivo" value={formData.principioActivo} onChange={handleFormChange} />
                <Input label="Laboratorio" name="laboratorio" value={formData.laboratorio} onChange={handleFormChange} />
                <Input label="Concentración" name="concentracion" value={formData.concentracion} onChange={handleFormChange} />
                <Input label="Presentación" name="presentacion" value={formData.presentacion} onChange={handleFormChange} />
                <Input label="Descripción" name="descripcion" value={formData.descripcion} onChange={handleFormChange} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Precio de Costo (S/)" type="number" step="0.01" name="precioCosto" value={formData.precioCosto} onChange={handleFormChange} />
                <Input label="Precio de Venta (S/)" type="number" step="0.01" name="precioVenta" required value={formData.precioVenta} onChange={handleFormChange} />
                <Input label="Stock Inicial" type="number" name="stockActual" required value={formData.stockActual} onChange={handleFormChange} />
                <Input label="Stock Mínimo" type="number" name="stockMinimo" value={formData.stockMinimo} onChange={handleFormChange} />
                <div>
                  <Input label="Lote (Auto-generado)" name="lote" value={formData.lote} onChange={handleFormChange} />
                  <p className="text-xs text-gray-400 mt-1">El lote se genera automáticamente en serie</p>
                </div>
                <Input label="Fecha de Vencimiento" type="date" name="fechaVencimiento" required value={formData.fechaVencimiento} onChange={handleFormChange} />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Código de Barras (Opcional)</label>
                <div className="flex gap-2 items-center">
                  <input
                    name="codigoBarras"
                    value={formData.codigoBarras}
                    onChange={handleFormChange}
                    placeholder="Dejar vacío si no tiene"
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                  <button type="button" onClick={() => setScannerOpen(true)}
                    className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0"
                    title="Escanear con cámara">
                    <Camera size={20} />
                  </button>
                </div>
                {barcodeWarning && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> {barcodeWarning}
                  </p>
                )}
              </div>
              <Input label="Nombre del Producto" name="nombre" required value={formData.nombre} onChange={handleFormChange} />
              <Input label="Descripción" name="descripcion" value={formData.descripcion} onChange={handleFormChange} />
              <Input label="Precio de Costo (S/)" type="number" step="0.01" name="precioCosto" value={formData.precioCosto} onChange={handleFormChange} />
              <Input label="Precio de Venta (S/)" type="number" step="0.01" name="precioVenta" required value={formData.precioVenta} onChange={handleFormChange} />
              <Input label="Stock Inicial" type="number" name="stockActual" required value={formData.stockActual} onChange={handleFormChange} />
              <Input label="Stock Mínimo" type="number" name="stockMinimo" value={formData.stockMinimo} onChange={handleFormChange} />
              <div>
                <Input label="Lote (Auto-generado)" name="lote" value={formData.lote} onChange={handleFormChange} />
                <p className="text-xs text-gray-400 mt-1">El lote se genera automáticamente en serie</p>
              </div>
            </div>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={!!barcodeWarning}>
              <Plus size={18} className="mr-2" />
              Añadir Producto a la Lista
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Productos en este Ingreso</h2>
        <div className="space-y-4">
          {shipmentItems.length === 0 ? (
            <p className="text-gray-500">Aún no has añadido productos a este envío.</p>
          ) : (
            shipmentItems.map((item, index) => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
                <div>
                  <p className="font-semibold">{item.nombre}</p>
                  <p className="text-sm text-gray-500">
                    {item.codigoBarras ? (
                      item.codigoBarras
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                        <AlertTriangle size={12} /> Sin código de barras
                      </span>
                    )}
                    {' | '}Stock: {item.stockActual} |
                    {item.lote && ` Lote: ${item.lote} |`}
                    {item.fechaVencimiento && ` Vencimiento: ${formatDateSafe(item.fechaVencimiento)} |`}
                    Costo: S/{item.precioCosto || '0.00'} | Venta: S/{item.precioVenta}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setEditTarget(item)}>
                    <Edit size={14} /> Editar
                  </Button>
                  <Button variant="danger" size="sm" type="button" onClick={() => handleRemoveItem(item.id)}>
                    Quitar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {shipmentItems.length > 0 && (
          <div className="flex justify-end gap-4 mt-6 pt-6 border-t">
            <Button variant="secondary" onClick={() => handleSaveShipment(false)} disabled={savingShipment}>
              <FileDown size={18} className="mr-2" />
              {savingShipment ? 'Guardando...' : 'Guardar como pendiente'}
            </Button>
            <Button variant="success" onClick={() => handleSaveShipment(true)} disabled={savingShipment}>
              <Save size={18} className="mr-2" />
              {savingShipment ? 'Guardando...' : 'Guardar Directo'}
            </Button>
          </div>
        )}
      </Card>

      {quickAddTarget && (
        <Modal
          isOpen={!!quickAddTarget}
          onClose={() => {
            setQuickAddTarget(null);
            setQuickAddForm({ cantidad: "", fechaVencimiento: "" });
          }}
          title={`Reabastecer: ${quickAddTarget.nombre}`}
        >
          <form onSubmit={handleQuickAddSubmit} className="space-y-4">
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded text-sm mb-4">
              Ingresa la cantidad que acaba de llegar en este lote y su respectiva fecha de vencimiento. El resto de datos se heredarán automáticamente.
            </div>
            <Input
              label="Cantidad a Ingresar"
              type="number"
              value={quickAddForm.cantidad}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, cantidad: e.target.value })}
              required
            />
            <div>
              <Input
                label="Lote (Auto-generado)"
                placeholder="Número de Lote"
                value={quickAddForm.lote}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, lote: e.target.value })}
                required
              />
              <p className="text-xs text-gray-400 mt-1">El lote se genera automáticamente en serie</p>
            </div>
            <Input
              label="Fecha de Vencimiento"
              type="date"
              value={quickAddForm.fechaVencimiento}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, fechaVencimiento: e.target.value })}
              required
            />
            <div className="flex justify-end gap-2 mt-4">
               <Button type="button" variant="secondary" onClick={() => {
                   setQuickAddTarget(null);
                   setFormError(null);
               }}>Cancelar</Button>
               <Button type="submit" variant="primary">Añadir a la lista</Button>
            </div>
          </form>
        </Modal>
      )}

      {editTarget && (
        <Modal
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          title={`Editar Detalle: ${editTarget.nombre}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setShipmentItems(prev => prev.map(item => item.id === editTarget.id ? editTarget : item));
              setEditTarget(null);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Precio de Costo (S/)"
                type="number"
                step="0.01"
                value={editTarget.precioCosto || ""}
                onChange={(e) => setEditTarget({ ...editTarget, precioCosto: e.target.value })}
              />
              <Input
                label="Precio de Venta (S/)"
                type="number"
                step="0.01"
                value={editTarget.precioVenta || ""}
                onChange={(e) => setEditTarget({ ...editTarget, precioVenta: e.target.value })}
                required
              />
              <Input
                label="Cantidad / Stock"
                type="number"
                value={editTarget.stockActual || ""}
                onChange={(e) => setEditTarget({ ...editTarget, stockActual: e.target.value })}
                required
              />
              <Input
                label="Fecha de Vencimiento"
                type="date"
                value={toDateInputValue(editTarget.fechaVencimiento)}
                onChange={(e) => setEditTarget({ ...editTarget, fechaVencimiento: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
               <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>Cancelar</Button>
               <Button type="submit" variant="primary">Guardar Cambios</Button>
            </div>
          </form>
        </Modal>
      )}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={(code) => {
          setFormData(prev => ({ ...prev, codigoBarras: code }));
          setScannerOpen(false);
        }}
      />
    </div>
  );
}
