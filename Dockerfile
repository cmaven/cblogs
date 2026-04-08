# ============================================================
# Dockerfile: VitePress 프로덕션 멀티스테이지 빌드 (nginx 서빙)
# 생성일: 2026-04-08 | 수정일: 2026-04-08
# ============================================================

# ── Stage 1: 빌드 ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run docs:build

# ── Stage 2: 서빙 ──────────────────────────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/docs/.vitepress/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3030
CMD ["nginx", "-g", "daemon off;"]
