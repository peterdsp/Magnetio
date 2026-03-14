FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies separately for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Non-root user for security
RUN addgroup -S magnetio && adduser -S magnetio -G magnetio
USER magnetio

EXPOSE 7000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:7000/health || exit 1

CMD ["node", "index.js"]
