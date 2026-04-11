import { useEffect, useState } from "react";
import { ListChecks, Edit3, Trash2, Plus } from "lucide-react";
import { api } from "../../lib/api.js";
import { Card, Button, Input, Modal } from "./components/ui.jsx";

export default function Categorias({ farmacia }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingCategory, setEditingCategory] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingError, setEditingError] = useState(null);

  const fetchCategories = async () => {
    if (!farmacia?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/categories", { params: { farmaciaId: farmacia.id } });
      setCategories(data);
    } catch (err) {
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
    </div>
  );
}
