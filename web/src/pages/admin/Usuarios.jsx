import { useEffect, useState } from "react";
import { UserPlus, Edit3, KeyRound, Trash2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { Card, Button, Input, Modal } from "./components/ui.jsx";



export default function Usuarios({ farmacia }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    username: "",
    fullName: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [editingUser, setEditingUser] = useState(null);
  const [editingData, setEditingData] = useState({
    username: "",
    fullName: "",
    isActive: true,
  });
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingError, setEditingError] = useState(null);

  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [passwordUser, setPasswordUser] = useState(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  const fetchUsers = async () => {
    if (!farmacia?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/users", { params: { farmaciaId: farmacia.id } });
      setUsers(data);
    } catch (err) {
      setError("No se pudieron cargar los vendedores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [farmacia?.id]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.username.trim() || !form.fullName.trim() || form.password.length < 4) {
      setFormError("Completa todos los campos (contrasena minimo 4 caracteres).");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.post("/users", {
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
        farmaciaId: farmacia.id,
      });
      setForm({
        username: "",
        fullName: "",
        password: "",
      });
      fetchUsers();
    } catch (err) {
      const message = err?.response?.data?.error || "No se pudo registrar el vendedor.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (user) => {
    setEditingUser(user);
    setEditingData({
      username: user.username,
      fullName: user.fullName,
      isActive: user.isActive,
    });
    setEditingError(null);
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingUser) return;
    setEditingLoading(true);
    setEditingError(null);
    try {
      await api.put(`/users/${editingUser.id}`, {
        username: editingData.username.trim(),
        fullName: editingData.fullName.trim(),
        farmaciaId: farmacia.id,
        isActive: editingData.isActive,
      });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      const message = err?.response?.data?.error || "No se pudo actualizar el vendedor.";
      setEditingError(message);
    } finally {
      setEditingLoading(false);
    }
  };

  const startDeleting = (user) => {
    setDeletingUser(user);
    setDeleteError(null);
  };

  const handleDeleteSubmit = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api.delete(`/users/${deletingUser.id}`);
      setDeletingUser(null);
      fetchUsers();
    } catch (err) {
      const message = err?.response?.data?.error || "No se pudo eliminar el vendedor.";
      setDeleteError(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const startPasswordChange = (user) => {
    setPasswordUser(user);
    setPasswordValue("");
    setPasswordError(null);
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (!passwordUser || passwordValue.length < 4) {
      setPasswordError("La contrasena debe tener al menos 4 caracteres.");
      return;
    }
    setPasswordLoading(true);
    setPasswordError(null);
    try {
      await api.put(`/users/${passwordUser.id}/password`, { password: passwordValue });
      setPasswordUser(null);
      setPasswordValue("");
    } catch (err) {
      const message = err?.response?.data?.error || "No se pudo actualizar la contrasena.";
      setPasswordError(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-gray-500">Farmacia activa</p>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <UserPlus size={30} />
            Usuarios vendedores
          </h1>
          <p className="text-gray-500">{farmacia?.nombre}</p>
        </div>
        <Button variant="secondary" onClick={fetchUsers} disabled={loading}>
          {loading ? "Actualizando..." : "Refrescar"}
        </Button>
      </div>

      {error && (
        <Card className="border border-red-200 bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Vendedores registrados</h2>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
            {loading && users.length === 0 && (
              <div className="p-6 text-center text-gray-500">Cargando usuarios...</div>
            )}
            {!loading && users.length === 0 && (
              <div className="p-6 text-center text-gray-500">Aun no hay vendedores registrados.</div>
            )}
            {users.filter(u => u.username !== 'admin' && u.role !== 'ADMIN_GLOBAL').map((user) => (
              <div
                key={user.id}
                className="p-4 flex flex-col md:flex-row md:items-center md:justify-between bg-white hover:bg-gray-50"
              >
                <div>
                  <p className="font-semibold text-gray-900">{user.fullName}</p>
                  <p className="text-sm text-gray-500">@{user.username}</p>
                  <p className="text-xs text-gray-400">
                    Estado: <span className="font-semibold">{user.isActive ? "Activo" : "Inactivo"}</span>
                  </p>
                </div>
                <div className="flex gap-2 mt-2 md:mt-0">
                  <Button variant="secondary" className="w-10 h-10 p-0" onClick={() => startEditing(user)}>
                    <Edit3 size={16} />
                  </Button>
                  <Button variant="primary" className="w-10 h-10 p-0" onClick={() => startPasswordChange(user)}>
                    <KeyRound size={16} />
                  </Button>
                  <Button variant="danger" className="w-10 h-10 p-0" onClick={() => startDeleting(user)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Agregar vendedor</h2>
          {formError && <p className="text-sm text-red-600 mb-2">{formError}</p>}
          <form className="flex flex-col gap-4" onSubmit={handleCreate}>
            <Input
              label="Nombre completo"
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              required
            />
            <Input
              label="Usuario"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
            <Input
              label="Contraseña"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
            <Button type="submit" variant="success" disabled={saving}>
              {saving ? "Guardando..." : "Registrar"}
            </Button>
          </form>
        </Card>
      </div>

      <Modal
        isOpen={!!editingUser}
        title={editingUser ? `Editar vendedor: ${editingUser.fullName}` : ""}
        onClose={() => setEditingUser(null)}
      >
        <form className="flex flex-col gap-4" onSubmit={handleEditSubmit}>
          <Input
            label="Nombre completo"
            value={editingData.fullName}
            onChange={(e) => setEditingData((prev) => ({ ...prev, fullName: e.target.value }))}
            required
          />
          <Input
            label="Usuario"
            value={editingData.username}
            onChange={(e) => setEditingData((prev) => ({ ...prev, username: e.target.value }))}
            required
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={editingData.isActive}
              onChange={(e) => setEditingData((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            Usuario activo
          </label>
          {editingError && <p className="text-sm text-red-600">{editingError}</p>}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="success" disabled={editingLoading}>
              {editingLoading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deletingUser}
        title="Confirmar eliminación"
        onClose={() => setDeletingUser(null)}
      >
        <div>
          <p>¿Estás seguro que quieres eliminar a <span className="font-bold">{deletingUser?.fullName}</span>?</p>
          {deleteError && <p className="text-sm text-red-600 mt-2">{deleteError}</p>}
        </div>
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
          <Button type="button" variant="secondary" onClick={() => setDeletingUser(null)}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={handleDeleteSubmit} disabled={deleteLoading}>
            {deleteLoading ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!passwordUser}
        title={passwordUser ? `Actualizar contrasena: ${passwordUser.fullName}` : ""}
        onClose={() => setPasswordUser(null)}
      >
        <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
          <Input
            label="Nueva contrasena"
            type="password"
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
            required
          />
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setPasswordUser(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="success" disabled={passwordLoading}>
              {passwordLoading ? "Guardando..." : "Actualizar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}