FROM nginx:1.27-alpine AS runtime
COPY services/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY services/frontend/index.html /usr/share/nginx/html/index.html
COPY services/frontend/config.js /usr/share/nginx/html/config.js
COPY services/frontend/styles.css /usr/share/nginx/html/styles.css
COPY services/frontend/app.js /usr/share/nginx/html/app.js
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
