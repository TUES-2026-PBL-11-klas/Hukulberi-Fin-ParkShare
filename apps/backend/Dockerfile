FROM node:20-alpine AS builder
WORKDIR /workspace

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
RUN npm ci --ignore-scripts

COPY apps/backend ./apps/backend
RUN npm run build -w apps/backend

FROM node:20-alpine
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=builder /workspace/apps/backend/dist ./apps/backend/dist
COPY --from=builder /workspace/apps/backend/package*.json ./apps/backend/

EXPOSE 3001
CMD ["node","apps/backend/dist/main"]
