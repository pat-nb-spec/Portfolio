FROM node:20-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8787/api/health >/dev/null || exit 1
CMD ["node","server.js"]
