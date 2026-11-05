# Single-user contacts manager. Builds the Next.js app and keeps the TypeScript
# sources and tsx so the import and cleanup scripts work inside the container.
FROM node:24-alpine

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    CONTACTS_LISTEN=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build \
 && mkdir -p /app/data /app/imports \
 && chown -R node:node /app

USER node
VOLUME ["/app/data", "/app/imports"]
EXPOSE 3000

CMD ["npm", "start"]
