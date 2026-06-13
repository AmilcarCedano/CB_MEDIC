#!/bin/sh
# Entrypoint de producción: espera a la base de datos, aplica el esquema y
# asegura el usuario admin antes de arrancar el servidor.
set -e

echo "[entrypoint] Aplicando esquema a la base de datos (prisma db push)..."

# La base de datos (MySQL) puede tardar en aceptar conexiones tras 'docker compose up'.
# Reintentar hasta 20 veces (1 minuto aprox). 'db push' es idempotente para cambios
# aditivos; si hubiera un cambio destructivo, fallará en vez de borrar datos (seguro).
n=0
until npx prisma db push --skip-generate; do
  n=$((n + 1))
  if [ "$n" -ge 20 ]; then
    echo "[entrypoint] No se pudo aplicar el esquema tras 20 intentos. Abortando."
    exit 1
  fi
  echo "[entrypoint] Base de datos no lista o esquema no aplicable (intento $n/20). Reintentando en 3s..."
  sleep 3
done

echo "[entrypoint] Esquema aplicado. Asegurando usuario admin..."
node prisma/init-prod.js

echo "[entrypoint] Iniciando servidor..."
exec node src/index.js
