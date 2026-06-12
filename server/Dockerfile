FROM node:20-alpine

WORKDIR /app

# Dependencias de OpenSSL requeridas por Prisma en Alpine
RUN apk add --no-cache openssl openssl-dev libc6-compat

COPY package*.json ./
# npm ci: instalación reproducible desde package-lock.json (incluye devDeps,
# necesarias para que el CLI de prisma genere el client)
RUN npm ci

COPY . .

# Generar el Prisma Client y luego podar devDeps (nodemon, prisma CLI) de la
# imagen final. El client generado vive en node_modules/.prisma y @prisma/client
# es dependencia de producción, así que sobreviven al prune.
RUN npx prisma generate && npm prune --omit=dev

EXPOSE 4000

# node directo (sin npm intermediario): mejor manejo de señales (SIGTERM)
CMD ["node", "src/index.js"]
