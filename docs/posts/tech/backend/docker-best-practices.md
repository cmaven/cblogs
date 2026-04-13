---
title: "Docker 컨테이너 베스트 프랙티스"
date: 2026-04-05
category: tech
subcategory: backend
excerpt: "프로덕션 환경에서 Docker를 효율적으로 사용하기 위한 베스트 프랙티스를 정리합니다."
tags: [docker, devops, container]
---

# Docker 컨테이너 베스트 프랙티스

## 이미지 최적화

### 멀티스테이지 빌드

```dockerfile
# 빌드 스테이지
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# 실행 스테이지
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

### .dockerignore 활용

```
node_modules
.git
*.md
.env
coverage
.vscode
```

## 보안

### 루트가 아닌 사용자 실행

```dockerfile
FROM node:20-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
WORKDIR /app
COPY --chown=appuser:appgroup . .
CMD ["node", "server.js"]
```

### 이미지 스캔

```bash
docker scout quickview myapp:latest
```

## 로깅과 헬스체크

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

## 핵심 원칙 요약

| 원칙 | 설명 |
|------|------|
| 작은 베이스 이미지 | `alpine` 기반 이미지 사용 |
| 멀티스테이지 빌드 | 빌드 도구를 최종 이미지에서 제거 |
| 레이어 캐시 활용 | 자주 변경되는 파일을 나중에 COPY |
| 비루트 실행 | 보안을 위해 전용 사용자 생성 |
| 헬스체크 | 컨테이너 상태 자동 모니터링 |

이 원칙들을 적용하면 더 가볍고, 안전하고, 효율적인 컨테이너를 운영할 수 있습니다.
