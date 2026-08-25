import { useEffect, useState } from "react";
import { ListChecks, Edit3, Trash2, Plus, Download } from "lucide-react";
import { api } from "../../lib/api.js";
import { Card, Button, Input, Modal, Select } from "./components/ui.jsx";

export default function Categorias({ farmacia, user }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingCategory, setEditingCategory] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingError, setEditingError] = useState(null);

  // Importar categorías de otra farmacia (solo Admin)
  const isAdmin = user?.role === "ADMIN";
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [otrasFarmacias, setOtrasFarmacias] = useState([]);
  const [origenFarmaciaId, setOrigenFarmaciaId] = useState("");
  const [categoriasOrigen, setCategoriasOrigen] = useState([]);
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState(new Set());
  const [loadingOrigen, setLoadingOrigen] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const fetchCategories = async () => {
    if (!farmacia?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/categories", { params: { farmaciaId: farmacia.id } });
      setCategories(data);
    } catch {
      setError("No se pudieron cargar las categorias.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [farmacia?.id]);

  const handleAddCategory = async (event) => {
    event.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/categories", {
        farmaciaId: farmacia.id,
        nombre: formName.trim(),
      });
      setFormName("");
      fetchCategories();
    } catch (err) {
      const message = err?.response?.data?.error || "No se pudo agregar la categoria.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (category) => {
    setEditingCategory(category);
    setEditingName(category.nombre);
    setEditingError(null);
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingCategory) return;
    setEditingLoading(true);
    setEditingError(null);
    try {
      await api.put(`/categories/${editingCategory.id}`, { nombre: editingName.trim() });
      setEditingCategory(null);
      fetchCategories();
    } catch (err) {
      const message = err?.response?.data?.error || "No se pudo actualizar la categoria.";
      setEditingError(message);
    } finally {
      setEditingLoading(false);
    }
  };

  const handleDelete = async (category) => {
    try {
      await api.delete(`/categories/${category.id}`);
      fetchCategories();
    } catch (err) {
      const message = err?.response?.data?.error || "No se pudo eliminar la categoria.";
      setError(message);
    }
  };

  const handleOpenImportModal = async () => {
    setImportError(null);
    setImportResult(null);
    setOrigenFarmaciaId("");
    setCategoriasOrigen([]);
    setCategoriasSeleccionadas(new Set());
    setIsImportModalOpen(true);
    try {
      const { data } = await api.get("/farmacias");
      setOtrasFarmacias(data.filter((f) => f.id !== farmacia.id));
    } catch (err) {
      console.error("Error fetching farmacias:", err);
      setImportError("No se pudieron cargar las demás farmacias.");
    }
  };

  const handleSelectOrigen = async (id) => {
    setOrigenFarmaciaId(id);
    setCategoriasOrigen([]);
    setCategoriasSeleccionadas(new Set());
    setImportError(null);
    setImportResult(null);
    if (!id) return;
    setLoadingOrigen(true);
    try {
      const { data } = await api.get("/categories", { params: { farmaciaId: id } });
      setCategoriasOrigen(data);
      setCategoriasSeleccionadas(new Set(data.map((c) => c.id)));
    } catch (err) {
      console.error("Error fetching categorias origen:", err);
      setImportError("No se pudieron cargar las categorías de esa farmacia.");
    } finally {
      setLoadingOrigen(false);
    }
  };

  const toggleCategoriaSeleccionada = (id) => {
    setCategoriasSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmarImportacion = async () => {
    if (categoriasSeleccionadas.size === 0) {
      setImportError("Selecciona al menos una categoría para importar.");
      return;
    }
    setImportando(true);
    setImportError(null);
    try {
      const { data } = await api.post("/categories/importar", {
        farmaciaOrigenId: parseInt(origenFarmaciaId),
        categoriaIds: Array.from(categoriasSeleccionadas),
      });
      setImportResult(data);
      fetchCategories();
    } catch (err) {
      console.error("Error importing categorias:", err);
      setImportError(err.response?.data?.error || "No se pudieron importar las categorías.");
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-gray-500">Farmacia activa</p>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <ListChecks size={30} />
            Administracion de categorias
          </h1>
          <p className="text-gray-500">{farmacia?.nombre}</p>
        </div>
        {isAdmin && (
          <Button variant="secondary" onClick={handleOpenImportModal}>
            <Download size={18} /> Importar de otra farmacia
          </Button>
        )}
      </div>

      {error && (
        <Card className="border border-red-200 bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Lista de categorias</h2>
            <Button variant="secondary" onClick={fetchCategories} disabled={loading}>
              {loading ? "Actualizando..." : "Refrescar"}
            </Button>
          </div>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
            {loading && categories.length === 0 && (
              <div className="p-6 text-center text-gray-500">Cargando categorias...</div>
            )}
            {!loading && categories.length === 0 && (
              <div className="p-6 text-center text-gray-500">Aun no hay categorias registradas.</div>
            )}
            {categories.map((category) => {
              const canDelete = category.productCount === 0 && !category.isMaster;
              return (
                <div
                  key={category.id}
                  className="p-4 flex flex-col md:flex-row md:items-center md:justify-between bg-white hover:bg-gray-50"
                >
                  <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <p className="font-medium text-gray-900">{category.nombre}</p>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium ${
                        category.isMaster ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {category.isMaster ? "Base" : "Personalizada"}
                    </span>
                    <span className="text-xs text-gray-500">({category.productCount} productos)</span>
                  </div>
                  <div className="flex gap-2 mt-2 md:mt-0">
                    <Button variant="secondary" className="w-10 h-10 p-0" onClick={() => startEditing(category)}>
                      <Edit3 size={16} />
                    </Button>
                    <Button
                      variant="danger"
                      className="w-10 h-10 p-0"
                      disabled={!canDelete}
                      onClick={() => handleDelete(category)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-1">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Agregar categoria</h2>
          <form onSubmit={handleAddCategory} className="flex flex-col gap-4">
            <Input
              label="Nombre"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ej: Higiene"
              required
            />
            <Button type="submit" variant="primary" disabled={saving}>
              <Plus size={18} />
              {saving ? "Guardando..." : "Crear categoria"}
            </Button>
          </form>
        </Card>
      </div>

      <Modal
        isOpen={!!editingCategory}
        title={editingCategory ? `Editar categoria: ${editingCategory.nombre}` : ""}
        onClose={() => setEditingCategory(null)}
      >
        <form className="flex flex-col gap-4" onSubmit={handleEditSubmit}>
          <Input
            label="Nombre"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            required
          />
          {editingError && <p className="text-sm text-red-600">{editingError}</p>}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setEditingCategory(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="success" disabled={editingLoading}>
              {editingLoading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isImportModalOpen}
        title="Importar categorías de otra farmacia"
        onClose={() => setIsImportModalOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Copia categorías ya creadas en otra farmacia hacia <strong>{farmacia?.nombre}</strong>. Las que ya existan aquí (mismo nombre) se omiten.
          </p>

          <Select
            label="Farmacia de origen"
            value={origenFarmaciaId}
            onChange={(e) => handleSelectOrigen(e.target.value)}
          >
            <option value="">Selecciona una farmacia...</option>
            {otrasFarmacias.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </Select>

          {importError && <p className="text-sm text-red-600">{importError}</p>}

          {importResult && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              Importadas: {importResult.importadas} · Omitidas (ya existían): {importResult.omitidas}
            </p>
          )}

          {loadingOrigen && <p className="text-sm text-gray-500">Cargando categorías...</p>}

          {!loadingOrigen && origenFarmaciaId && categoriasOrigen.length === 0 && (
            <p className="text-sm text-gray-500">Esa farmacia no tiene categorías registradas.</p>
          )}

          {categoriasOrigen.length > 0 && (
            <div className="border rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
              {categoriasOrigen.map((c) => (
                <label key={c.id} className="flex items-center gap-3 p-3 text-sm hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categoriasSeleccionadas.has(c.id)}
                    onChange={() => toggleCategoriaSeleccionada(c.id)}
                  />
                  <span className="flex-1 font-medium text-gray-800">{c.nombre}</span>
                  <span className="text-xs text-gray-400">{c.productCount} productos</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsImportModalOpen(false)}>Cerrar</Button>
            <Button
              type="button"
              variant="primary"
              disabled={!origenFarmaciaId || categoriasSeleccionadas.size === 0 || importando}
              onClick={handleConfirmarImportacion}
            >
              <Download size={18} /> {importando ? "Importando..." : `Importar (${categoriasSeleccionadas.size})`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
