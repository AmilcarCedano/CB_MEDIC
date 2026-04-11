import { useState } from "react";
import { LayoutDashboard, Wrench, Upload } from "lucide-react";
import { Card, Button, Input } from "./components/ui.jsx";
import { api } from "../../lib/api";

export default function PanelGlobal({
  adminName,
  adminUsername,
  activeTab = "dashboard",
  onTabChange = () => { },
  farmacias,
  loadingFarmacias,
  errorFarmacias,
  onRefreshFarmacias,
  onEnterFarmacia,
  onEditFarmacia,
  onDeleteFarmacia,
  onCreateFarmacia,
  createLoading,
  createError,
  editContext,
  masterSummary,
  masterLoading,
  masterError,
  onUploadMaster,
  masterUploading,
  onChangePassword = async () => { },
  onUpdateProfile = async () => { },
}) {
  const [createFormKey, setCreateFormKey] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [passwordState, setPasswordState] = useState({ loading: false, error: null, success: null });
  const [profileForm, setProfileForm] = useState({ 
    fullName: adminName || "",
    username: adminUsername || ""
  });
  const [profileState, setProfileState] = useState({ loading: false, error: null, success: null });

  // Logo Upload State
  const [logoFile, setLogoFile] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [logoSuccess, setLogoSuccess] = useState(null);

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setLogoUploading(true);
    setLogoError(null);
    setLogoSuccess(null);

    try {
      const formData = new FormData();
      formData.append('logo', logoFile);

      const { data } = await api.post('/config/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setLogoSuccess("Logo actualizado correctamente. Recarga la página para ver cambios.");
      setLogoFile(null);
      // Optional: Refresh preview by forcing a re-render or updating a timestamp state
      setTimeout(() => {
        // Force reload or just let the user see the success message
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error(err);
      setLogoError("Error al subir el logo. Asegúrate de que sea una imagen.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      nombre: formData.get("nombre"),
      direccion: formData.get("direccion"),
      ruc: formData.get("ruc"),
      telefono: formData.get("telefono"),
      email: formData.get("email"),
    };
    await onCreateFarmacia(payload, () => {
      event.currentTarget.reset();
      setCreateFormKey((prev) => prev + 1);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Selecciona un archivo para cargar.");
      return;
    }
    setUploadError(null);
    await onUploadMaster(selectedFile, (err) => {
      if (err) {
        setUploadError(err);
      } else {
        setSelectedFile(null);
      }
    });
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (passwordForm.password.length < 4) {
      setPasswordState({ loading: false, error: "La contraseña debe tener al menos 4 caracteres.", success: null });
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setPasswordState({ loading: false, error: "Las contraseñas no coinciden.", success: null });
      return;
    }
    try {
      setPasswordState({ loading: true, error: null, success: null });
      await onChangePassword(passwordForm.password);
      setPasswordState({ loading: false, error: null, success: "Contraseña actualizada correctamente." });
      setPasswordForm({ password: "", confirm: "" });
    } catch (err) {
      setPasswordState({
        loading: false,
        error: err?.response?.data?.error || "No se pudo actualizar la contraseña.",
        success: null,
      });
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (profileForm.fullName.trim().length === 0 || profileForm.username.trim().length === 0) {
      setProfileState({ loading: false, error: "Tanto el nombre como el usuario son obligatorios.", success: null });
      return;
    }
    try {
      setProfileState({ loading: true, error: null, success: null });
      await onUpdateProfile(profileForm.fullName.trim(), profileForm.username.trim());
      setProfileState({ loading: false, error: null, success: "Perfil actualizado correctamente. Recuerda usar tu nuevo usuario al iniciar sesión." });
    } catch (err) {
      setProfileState({
        loading: false,
        error: err?.response?.data?.error || "No se pudo actualizar el perfil.",
        success: null,
      });
    }
  };

  const lastImport = masterSummary?.lastImport;

  // ... rest of component

  const renderDashboard = () => (
    <div className="grid gap-6">
      {errorFarmacias && (
        <Card className="border border-red-200 bg-red-50">
          <p className="text-sm text-red-600">{errorFarmacias}</p>
        </Card>
      )}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Tus farmacias</h2>
            <p className="text-gray-600">Gestiona cada centro medico desde aqui.</p>
          </div>
          <Button variant="secondary" onClick={onRefreshFarmacias} disabled={loadingFarmacias}>
            {loadingFarmacias ? "Actualizando..." : "Refrescar"}
          </Button>
        </div>
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
          {loadingFarmacias && !farmacias.length && (
            <div className="p-6 text-center text-gray-500">Cargando farmacias...</div>
          )}
          {!loadingFarmacias && farmacias.length === 0 && (
            <div className="p-6 text-center text-gray-500">Aun no hay farmacias registradas.</div>
          )}
          {farmacias.map((farmacia) => (
            <div
              key={farmacia.id}
              className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-white hover:bg-gray-50 transition"
            >
              <div>
                <p className="font-semibold text-gray-900">{farmacia.nombre}</p>
                <p className="text-sm text-gray-500">{farmacia.direccion}</p>
                <p className="text-xs text-gray-400">RUC: {farmacia.ruc}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => onEnterFarmacia(farmacia)}>
                  Ingresar
                </Button>
                <Button variant="secondary" onClick={() => onEditFarmacia(farmacia)}>
                  Editar
                </Button>
                <Button variant="danger" onClick={() => onDeleteFarmacia(farmacia)}>
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Crear nueva farmacia</h2>
          <p className="text-sm text-gray-500 mb-4">Completa los datos y se provisionara su entorno.</p>
          {createError && <p className="text-sm text-red-600 mb-2">{createError}</p>}
          <form key={createFormKey} onSubmit={handleCreate} className="flex flex-col gap-4">
            <Input label="Nombre" name="nombre" required placeholder="Farmacia San Jose" />
            <Input label="Direccion" name="direccion" required placeholder="Av. Principal 123" />
            <Input label="RUC" name="ruc" required placeholder="20123456789" />
            <Input label="Telefono" name="telefono" placeholder="987654321" />
            <Input label="Correo" name="email" type="email" placeholder="contacto@farmacia.com" />
            <Button type="submit" variant="success" disabled={createLoading}>
              {createLoading ? "Guardando..." : "Registrar farmacia"}
            </Button>
          </form>
        </Card>

        {editContext?.record && (
          <Card>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Editar farmacia</h2>
            <p className="text-sm text-gray-500 mb-4">Actualiza los datos y se reflejara de inmediato.</p>
            {editContext.error && <p className="text-sm text-red-600 mb-2">{editContext.error}</p>}
            <form
              key={editContext.record.id}
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const payload = {
                  nombre: formData.get("nombre"),
                  direccion: formData.get("direccion"),
                  ruc: formData.get("ruc"),
                  telefono: formData.get("telefono"),
                  email: formData.get("email"),
                };
                editContext.onSubmit(payload, () => { });
              }}
              className="flex flex-col gap-4"
            >
              <Input label="Nombre" name="nombre" required defaultValue={editContext.record.nombre} />
              <Input label="Direccion" name="direccion" required defaultValue={editContext.record.direccion ?? ""} />
              <Input label="RUC" name="ruc" required defaultValue={editContext.record.ruc ?? ""} />
              <Input label="Telefono" name="telefono" defaultValue={editContext.record.telefono ?? ""} />
              <Input label="Correo" type="email" name="email" defaultValue={editContext.record.email ?? ""} />
              <div className="flex gap-3">
                <Button type="submit" variant="success" disabled={editContext.loading}>
                  {editContext.loading ? "Guardando..." : "Guardar cambios"}
                </Button>
                <Button type="button" variant="secondary" onClick={editContext.onCancel}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Base maestra de medicamentos</h2>
        <p className="text-gray-600 mb-4">
          Carga el archivo Excel/CSV descargado de DIGEMID. Esto alimenta las sugerencias al registrar medicamentos.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <p className="text-sm text-gray-500">Ultima actualizacion</p>
            {masterLoading ? (
              <p className="text-lg font-semibold text-gray-700">Consultando...</p>
            ) : lastImport ? (
              <>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {new Date(lastImport.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500">Archivo: {lastImport.filename}</p>
                <p className="text-sm text-gray-500">Registros: {lastImport.totalProductos}</p>
              </>
            ) : (
              <p className="text-lg font-semibold text-gray-700">Sin registros</p>
            )}
          </div>
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
            <p className="text-sm text-gray-500">Productos disponibles para sugerencias</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{masterSummary?.totalProductos ?? 0}</p>
          </div>
        </div>
        {masterError && <p className="text-sm text-red-600 mt-4">{masterError}</p>}
        {uploadError && <p className="text-sm text-red-600 mt-2">{uploadError}</p>}
        <div className="mt-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Archivo (Excel/CSV)</label>
            <input
              type="file"
              className="w-full"
              accept=".csv,.xlsx,.txt"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </div>
          <Button
            variant="primary"
            onClick={handleUpload}
            disabled={masterUploading}
            className="w-full md:w-auto"
          >
            <Upload size={18} />
            {masterUploading ? "Procesando..." : "Cargar y reemplazar base"}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Personalización del Sistema</h2>
        <p className="text-gray-600 mb-4">
          Personaliza la apariencia del sistema cargando el logo de tu empresa.
        </p>
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-medium text-gray-700">Logo actual</p>
            <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 overflow-hidden">
              <img
                src={`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/uploads/system-logo.png?t=${Date.now()}`}
                alt="System Logo"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<span class="text-gray-400 text-xs text-center px-2">Sin logo personalizado</span>';
                }}
              />
            </div>
          </div>
          <div className="flex-1 w-full space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Cargar nuevo logo (PNG/JPG)</label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-indigo-50 file:text-indigo-700
                    hover:file:bg-indigo-100"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
                <Button
                  variant="primary"
                  disabled={!logoFile || logoUploading}
                  onClick={handleLogoUpload}
                >
                  <Upload size={18} />
                  {logoUploading ? "Subiendo..." : "Subir"}
                </Button>
              </div>
              {logoError && <p className="text-sm text-red-600 mt-2">{logoError}</p>}
              {logoSuccess && <p className="text-sm text-green-600 mt-2">{logoSuccess}</p>}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ajustes de Cuenta</h2>
        <p className="text-sm text-gray-500 mb-4">
          Actualiza tus credenciales de acceso y tu nombre público.
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleProfileSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre de Usuario (Login)"
              value={profileForm.username}
              onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
              required
              placeholder="Ej: almi_gamer_2024"
            />
            <Input
              label="Nombre completo (Display)"
              value={profileForm.fullName}
              onChange={(e) => setProfileForm(prev => ({ ...prev, fullName: e.target.value }))}
              required
              placeholder="Ej: Administrador Principal"
            />
          </div>
          {profileState.error && <p className="text-sm text-red-600">{profileState.error}</p>}
          {profileState.success && <p className="text-sm text-green-600">{profileState.success}</p>}
          <div className="flex justify-end gap-3">
            <Button type="submit" variant="success" disabled={profileState.loading}>
              {profileState.loading ? "Actualizando..." : "Guardar Cambios de Cuenta"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Actualizar contraseña</h2>
        <p className="text-sm text-gray-500 mb-4">
          Cambia la contraseña de tu cuenta administrativa. Recuerda usar una combinación segura.
        </p>
        <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
          <Input
            label="Nueva contraseña"
            type="password"
            value={passwordForm.password}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, password: e.target.value }))}
            required
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            value={passwordForm.confirm}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
            required
          />
          {passwordState.error && <p className="text-sm text-red-600">{passwordState.error}</p>}
          {passwordState.success && <p className="text-sm text-green-600">{passwordState.success}</p>}
          <div className="flex justify-end gap-3">
            <Button type="submit" variant="success" disabled={passwordState.loading}>
              {passwordState.loading ? "Actualizando..." : "Guardar contraseña"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {activeTab === "dashboard" ? renderDashboard() : renderSettings()}
    </div>
  );
}
