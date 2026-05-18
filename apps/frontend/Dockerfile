FROM node:20-alpine AS builder
WORKDIR /workspace

COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
RUN npm ci --ignore-scripts

COPY apps/frontend ./apps/frontend
RUN npm run build -w apps/frontend

FROM node:20-alpine
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=builder /workspace/apps/frontend/public ./apps/frontend/public
COPY --from=builder /workspace/apps/frontend/.next/standalone ./
COPY --from=builder /workspace/apps/frontend/.next/static ./apps/frontend/.next/static

EXPOSE 3000
CMD ["node","apps/frontend/server.js"]
