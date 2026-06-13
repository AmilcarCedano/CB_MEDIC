# 🚀 Runbook de Despliegue — CBMedic

**Producción:** VPS con Docker Compose + Traefik → https://cbmedic.duckdns.org
**Fuente de verdad:** `/opt/cbmedic/app/docker-compose.yml` en el VPS (el `docker-compose.yml` local y `deploy_tools/docker-compose.vps.yml` son copias de referencia).

> ⚠️ El proyecto usa `prisma db push` (no hay carpeta `prisma/migrations/`).
>
> ✅ **Inicialización automática:** el contenedor backend usa un entrypoint (`server/docker-entrypoint.sh`) que, en cada arranque, espera a la base de datos, aplica el esquema con `prisma db push` y asegura el usuario admin (`prisma/init-prod.js`). En una base de datos nueva, el primer `docker compose up -d --build` deja el sistema listo con **usuario `admin` / contraseña `adminPass`** — sin pasos manuales. El paso 3 de abajo queda como opcional/diagnóstico.
>
> 🔐 El init **no sobrescribe** el admin si ya existe: tu cambio de contraseña se conserva entre despliegues.

---

## 📋 Orden de despliegue

1. [Backup de MySQL](#1-backup-de-mysql)
2. [Actualizar el código](#2-actualizar-el-código)
3. [Sincronizar el schema de la BD](#3-sincronizar-el-schema-de-la-bd)
4. [Reconstruir y levantar](#4-reconstruir-y-levantar)
5. [Smoke test](#5-smoke-test)
6. [Rollback](#6-rollback)

---

## 1. Backup de MySQL

**Siempre antes de desplegar.** Desde el VPS:

```bash
cd /opt/cbmedic/app
docker exec cbmedic-mysql sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup-$(date +%F).sql
ls -lh backup-*.sql   # verificar que el dump no esté vacío
```

## 2. Actualizar el código

```bash
cd /opt/cbmedic/app
git pull
```

## 3. Sincronizar el schema de la BD (automático)

**Normalmente no hace falta hacer nada:** el entrypoint del backend ejecuta `prisma db push` en cada arranque (paso 4). Si `db push` detectara un cambio **destructivo**, el contenedor falla en vez de borrar datos y queda visible en los logs — ahí sí hay que intervenir manualmente:

```bash
docker compose run --rm backend npx prisma db push --skip-generate
```

> Revisar el resumen que imprime: si advierte pérdida de datos, **detenerse**, hacer backup y evaluar.

## 4. Reconstruir y levantar

```bash
docker compose up -d --build
docker compose ps   # backend debe quedar "healthy" (healthcheck a /health)
```

## 5. Smoke test

```bash
curl -fsS https://cbmedic.duckdns.org/health
# Esperado: {"ok":true,"time":"..."}

docker compose logs --tail 50 backend   # sin errores de arranque ni de Prisma
```

Probar además el login en https://cbmedic.duckdns.org desde el navegador.

## 6. Rollback

Si el despliegue falla:

```bash
cd /opt/cbmedic/app

# 1) Volver el código al commit anterior
git log --oneline -5          # identificar el commit bueno
git checkout <commit-bueno> -- .   # o: git reset --hard <commit-bueno>
docker compose up -d --build

# 2) Solo si el schema/datos quedaron mal: restaurar el dump
docker exec -i cbmedic-mysql sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < backup-YYYY-MM-DD.sql

# 3) Verificar
curl -fsS https://cbmedic.duckdns.org/health
```

---

## 🔗 Relacionado

- `docs/DOCKER_VPS_GUIDE.md` — guía general de Docker en VPS
- `docs/DOKPLOY_GUIDE.md` — panel Dokploy / Traefik
