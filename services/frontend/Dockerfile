FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_CATALOG_API_URL
ARG VITE_CART_API_URL
ENV VITE_CATALOG_API_URL=$VITE_CATALOG_API_URL
ENV VITE_CART_API_URL=$VITE_CART_API_URL
COPY package.json package-lock.json ./
COPY services/frontend/package.json ./services/frontend/package.json
RUN npm ci --workspace services/frontend
COPY services/frontend/index.html services/frontend/postcss.config.js services/frontend/tailwind.config.js ./services/frontend/
COPY services/frontend/src ./services/frontend/src
RUN npm --workspace services/frontend run build

FROM nginx:1.27-alpine AS runtime
COPY services/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/services/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
