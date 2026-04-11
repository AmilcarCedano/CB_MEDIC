FROM node:20-alpine

WORKDIR /app

# Fix: OpenSSL requerido por Prisma en Alpine
RUN apk add --no-cache openssl openssl-dev libc6-compat

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and prisma schema
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "start"]
