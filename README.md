<!-- README.md: cdocs 프로젝트 개요 및 사용 가이드 | 생성일: 2026-04-09 -->

# cdocs

VitePress 기반 기술 문서 포털. Docker Compose로 개발/프로덕션 환경을 제공합니다.

## 프로젝트 구조

```
cdocs/
├── docs/                    # 문서 소스
│   ├── .vitepress/          # VitePress 설정 및 테마
│   ├── public/              # 정적 파일 (이미지, PDF 등)
│   │   └── files/
│   ├── guide/               # 사용 가이드
│   ├── 2025/                # 연도별 프로젝트 문서
│   └── 2026/
├── sample/                  # 샘플 문서 템플릿
├── Dockerfile               # 프로덕션 멀티스테이지 빌드
├── docker-compose.yml       # 프로덕션 환경
├── docker-compose.dev.yml   # 개발 환경 (HMR + 볼륨 마운트)
└── nginx.conf               # nginx 서빙 설정
```

## 빠른 시작

### 개발 환경 (Docker Compose)

```bash
# 시작 — 파일 변경 자동 감지 + 브라우저 자동 새로고침
docker compose -f docker-compose.dev.yml up -d

# 로그 확인
docker compose -f docker-compose.dev.yml logs -f

# 중지
docker compose -f docker-compose.dev.yml down
```

### 프로덕션 환경 (Docker Compose)

```bash
# 빌드 및 시작
docker compose up -d --build

# 로그 확인
docker compose logs -f

# 중지
docker compose down

# 완전 삭제 (이미지 포함)
docker compose down --rmi all --volumes
```

### 로컬 실행 (Node.js)

```bash
npm install

# 개발 모드 (파일 변경 감지 + 자동 재시작)
npm run docs:watch

# 단순 개발 서버
npm run docs:dev

# 프로덕션 빌드
npm run docs:build
```

접속: http://localhost:3030

## 문서 추가

모든 문서는 `docs/` 하위에 **연도/프로젝트/파일.md** 형태로 저장합니다.
파일을 추가하면 사이드바와 홈페이지 카드가 **자동으로 반영**됩니다 — `config.ts` 수정이 필요 없습니다.

### 새 프로젝트 추가

```bash
mkdir -p docs/2026/my-project

cat > docs/2026/my-project/index.md << 'EOF'
---
title: My Project 개요
description: 프로젝트 설명
---

프로젝트 소개 내용을 작성합니다.
EOF
```

### 기존 프로젝트에 페이지 추가

```bash
cat > docs/2026/my-project/setup.md << 'EOF'
---
title: 설치 가이드
description: 설치 방법 안내
---

설치 관련 내용을 작성합니다.
EOF
```

## 문서 삭제

해당 `.md` 파일 또는 프로젝트 디렉토리를 삭제하면 사이드바와 홈페이지에서 자동으로 제거됩니다.

```bash
# 단일 페이지 삭제
rm docs/2026/my-project/setup.md

# 프로젝트 전체 삭제
rm -rf docs/2026/my-project
```

## 정적 파일

이미지, PDF 등은 `docs/public/` 에 저장합니다.

```md
![다이어그램](/images/diagram.png)
[보고서 다운로드](/files/report.pdf)
```

## 기술 스택

- [VitePress](https://vitepress.dev/) — 정적 사이트 생성
- [Vue 3](https://vuejs.org/) — 커스텀 컴포넌트
- [Mermaid](https://mermaid.js.org/) — 다이어그램
- [nginx](https://nginx.org/) — 프로덕션 서빙
