FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY services/catalog-service/package.json ./services/catalog-service/package.json
RUN npm ci --omit=dev --workspace services/catalog-service

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp
COPY --from=deps /app/node_modules ./node_modules
COPY services/catalog-service/package.json ./services/catalog-service/package.json
COPY services/catalog-service/src ./services/catalog-service/src
USER nodeapp
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "services/catalog-service/src/server.js"]
