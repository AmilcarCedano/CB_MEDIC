FROM node:20-alpine

WORKDIR /app

# Dependencias de OpenSSL requeridas por Prisma en Alpine
RUN apk add --no-cache openssl openssl-dev libc6-compat

COPY package*.json ./
# npm ci: instalación reproducible desde package-lock.json (incluye devDeps,
# necesarias para que el CLI de prisma genere el client)
RUN npm ci

COPY . .

# Generar el Prisma Client y podar devDeps (nodemon) de la imagen final.
# El client generado vive en node_modules/.prisma y tanto @prisma/client como
# el CLI 'prisma' son dependencias de producción, así que sobreviven al prune
# (el CLI se necesita en runtime para 'prisma db push' en el entrypoint).
RUN npx prisma generate && npm prune --omit=dev

# Normalizar el entrypoint: quitar posibles CR (CRLF de Windows) y dar permiso
# de ejecución, para que el script corra correctamente en Alpine.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 4000

# El entrypoint espera la BD, aplica el esquema (prisma db push), asegura el
# usuario admin y luego arranca el servidor con 'exec node' (señales SIGTERM ok).
ENTRYPOINT ["./docker-entrypoint.sh"]
