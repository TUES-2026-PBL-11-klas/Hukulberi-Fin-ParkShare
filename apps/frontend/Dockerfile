FROM node:22-alpine AS builder
WORKDIR /workspace
ENV HUSKY=0

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/contracts/package*.json ./packages/contracts/
RUN npm ci --ignore-scripts

COPY apps/frontend ./apps/frontend
RUN npm run build --workspace=frontend

FROM node:22-alpine
WORKDIR /workspace
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /workspace/apps/frontend/public ./apps/frontend/public
COPY --from=builder /workspace/apps/frontend/.next/standalone ./
COPY --from=builder /workspace/apps/frontend/.next/static ./apps/frontend/.next/static

EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
