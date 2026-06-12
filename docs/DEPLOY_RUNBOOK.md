# 🚀 Runbook de Despliegue — CBMedic

**Producción:** VPS con Docker Compose + Traefik → https://cbmedic.duckdns.org
**Fuente de verdad:** `/opt/cbmedic/app/docker-compose.yml` en el VPS (el `docker-compose.yml` local y `deploy_tools/docker-compose.vps.yml` son copias de referencia).

> ⚠️ El proyecto usa `prisma db push` (no hay carpeta `prisma/migrations/`). La imagen de producción ya no incluye el CLI de prisma (se poda con `npm prune`), por eso se invoca con versión pineada: `npx prisma@5.22.0`.

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

## 3. Sincronizar el schema de la BD

Solo si hubo cambios en `server/prisma/schema.prisma`:

```bash
docker compose run --rm backend npx prisma@5.22.0 db push --skip-generate
```

> `db push` aplica el schema directamente. Revisar el resumen que imprime antes de confirmar: si advierte pérdida de datos, **detenerse** y evaluar.

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
