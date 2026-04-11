export default function Dashboard({ user, source, onLogout }) {
  const farmacia = user?.farmacia;
  const isDemo = source === "demo";

  return (
    <section className="dashboard">
      <div className="dashboard__header">
        <div>
          <div className="dashboard__role">
            <span className="pill pill--outline">{user.role}</span>
            {isDemo && <span className="pill pill--warning">Modo demo</span>}
          </div>
          <h2>Bienvenido, {user.fullName}</h2>
          <p>
            {farmacia
              ? `Farmacia asignada: ${farmacia.nombre}`
              : "Usuario global sin farmacia fija"}
          </p>
        </div>
        <button type="button" className="ghost" onClick={onLogout}>
          Cerrar sesion
        </button>
      </div>

      <div className="dashboard__grid">
        <article className="panel">
          <h3>Tus accesos</h3>
          <ul>
            <li>Usuario: {user.username}</li>
            <li>Rol: {user.role}</li>
            <li>
              Estado: <strong>{user.isActive ? "Activo" : "Inactivo"}</strong>
            </li>
            {isDemo && <li>Token JWT: no requerido (demo)</li>}
          </ul>
          <p className="helper">
            Usa estos datos para abrir caja, vender y consultar RENIEC desde las
            proximas vistas.
          </p>
        </article>

        <article className="panel">
          <h3>Proximos pasos sugeridos</h3>
          <ol>
            <li>Configura la caja inicial con tu monto de apertura.</li>
            <li>Sincroniza productos y clientes cuando esten listos.</li>
            <li>Comparte el usuario "seller" (123) para pruebas.</li>
          </ol>
          {isDemo && (
            <p className="helper">
              Estás viendo datos ficticios. Cuando el backend responda, el login
              se hara automaticamente contra la API.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
