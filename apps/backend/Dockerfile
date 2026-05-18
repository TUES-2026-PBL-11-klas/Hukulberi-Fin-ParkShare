FROM node:22-alpine AS builder
WORKDIR /workspace
ENV DATABASE_URL=postgresql://parkshare:parkshare@localhost:5432/parkshare_build
RUN apk add --no-cache openssl

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/contracts/package*.json ./packages/contracts/
RUN npm ci

COPY prisma ./prisma
COPY packages/contracts ./packages/contracts
COPY apps/backend ./apps/backend
RUN npm run build --workspace=@parkshare/contracts
RUN npx prisma generate
RUN npm run build --workspace=backend

FROM node:22-alpine
WORKDIR /workspace
ENV NODE_ENV=production
ENV PORT=3001
RUN apk add --no-cache openssl

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/package*.json ./
COPY --from=builder /workspace/prisma ./prisma
COPY --from=builder /workspace/packages/contracts/package*.json ./packages/contracts/
COPY --from=builder /workspace/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /workspace/apps/backend/dist ./apps/backend/dist
COPY --from=builder /workspace/apps/backend/package*.json ./apps/backend/

EXPOSE 3001
CMD ["node", "apps/backend/dist/main.js"]
