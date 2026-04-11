FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl openssl-dev libc6-compat

COPY server/package*.json ./
RUN npm install

COPY server/ .

RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "start"]
