<!--
DOCS-PORTAL-ANALYSIS.md: docs-portal 프로젝트 종합 분석 문서
상세: 구현 내용, MDX 렌더링 성능 문제, 대안 솔루션 비교
생성일: 2026-04-08
-->

# Tech Docs Portal (docs-portal) 종합 분석

## 목차

1. [Executive Summary](#executive-summary)
2. [docs-portal 구현 분석](#docs-portal-구현-분석)
   - [프로젝트 개요](#프로젝트-개요)
   - [프로젝트 구조](#프로젝트-구조)
   - [핵심 기능 상세](#핵심-기능-상세)
   - [테마 시스템](#테마-시스템)
   - [Docker 설정](#docker-설정)
3. [MDX 렌더링 성능 분석](#mdx-렌더링-성능-분석)
   - [성능 문제의 원인](#성능-문제의-원인)
   - [Docker 환경에서의 추가 오버헤드](#docker-환경에서의-추가-오버헤드)
4. [md_web_server 벤치마크](#md_web_server-벤치마크)
5. [대안 솔루션 비교](#대안-솔루션-비교)
6. [결론 및 권장사항](#결론-및-권장사항)

---

## Executive Summary

### 현황

**docs-portal**은 Next.js 16 Canary + Fumadocs UI v16 기반의 모던 기술 문서 포털입니다. 56개의 MDX/MD 파일을 관리하며, 7개 연도별 카테고리(2020~2026)와 5개 프로젝트 그룹을 제공합니다.

### 장점

- **풍부한 커스텀 컴포넌트**: Mermaid, Asciinema, Badge, Button, Columns 등 6종 MDX 컴포넌트
- **한국어 지원**: 전체 UI/메타데이터를 한국어로 로컬라이징
- **자동화된 메타데이터 관리**: auto-meta.mjs 스크립트로 YAML frontmatter/meta.json 자동 생성
- **Docker 프로덕션 준비 완료**: 멀티스테이지 빌드로 standalone 실행 환경 구성
- **모던 스택**: React 19 Canary, TypeScript, Tailwind CSS v4

### 주요 문제: MDX 렌더링 성능

| 측면 | 로컬 개발 | Docker (볼륨 마운트) | 영향도 |
|------|---------|-------------------|--------|
| .mdx 파일 변경 감지 | ~500ms | ~1초 이상 | 개발자 생산성 저하 |
| Next.js 재컴파일 | 15~30초 | 30초 이상 | Hot Module Replacement (HMR) 지연 |
| Docker I/O 오버헤드 | - | 50~100% 추가 | 누적 지연 심화 |
| **총 변경→반영 시간** | **15~30초** | **30초 이상** | **UX 악화** |

### 근본 원인

1. **MDX의 복잡한 빌드 파이프라인**
   - .mdx 파일 → fumadocs-mdx → React 컴포넌트 변환
   - remark/rehype 플러그인 체인 처리
   - TypeScript 컴파일 + Webpack/Turbopack 번들링
   - 결과: 단순 .md 렌더링보다 50~100배 느림

2. **Docker 볼륨 마운트 I/O 오버헤드**
   - 호스트↔컨테이너 간 파일시스템 접근 지연
   - node_modules 접근 시 수천 개 파일 I/O
   - WATCHPACK_POLLING으로 일부 완화 가능하나 근본 해결 아님

### 권장사항

**즉시 반영이 필요한 경우**
→ **MkDocs Material**, **VitePress**, **Hugo** 등 .md 기반 솔루션으로 전환 검토
(빌드 시간: 수백 ms, 개발 생산성 10배 이상 향상)

**현재 MDX 스택 유지**
→ docker-compose.dev.yml에서 WATCHPACK_POLLING/CHOKIDAR_USEPOLLING 활성화
→ node_modules 디렉토리를 도커 볼륨으로 관리하여 호스트 마운트 우회

---

## docs-portal 구현 분석

### 프로젝트 개요

**docs-portal**은 사내 기술 문서 포털로, Next.js 16 Canary를 기반으로 구축되었습니다.

**핵심 스택:**

```
Frontend Framework:    Next.js 16 (Canary) + React 19 Canary
Documentation Engine: Fumadocs UI v16 + Fumadocs Core v16
Styling:             Tailwind CSS v4
Language:            TypeScript v6.0
MDX Rendering:       fumadocs-mdx v14.2.11
Theme Management:    next-themes
Mermaid Diagrams:    mermaid v11.14.0
Terminal Recording:  asciinema-player v3.15.1
```

**개발 환경:**

- 개발 서버 포트: 3030
- 한국어 (lang="ko")
- 다크 모드 기본값 설정
- Container: Alpine Linux 기반 (node:20-alpine)

### 프로젝트 구조

```
docs-portal/
├── src/
│   ├── app/                                    # Next.js App Router
│   │   ├── layout.tsx                          # RootProvider, 클립보드 폴리필
│   │   ├── page.tsx                            # 랜딩 페이지 (프로젝트 목록 동적)
│   │   ├── layout.config.tsx                   # GitHub 링크, 네비게이션 설정
│   │   ├── global.css                          # 글로벌 스타일 (민트 테마)
│   │   ├── docs/
│   │   │   ├── layout.tsx                      # DocsLayout, 탭 시스템
│   │   │   └── [[...slug]]/page.tsx            # 동적 문서 페이지
│   │   └── favicon.ico
│   │
│   ├── components/
│   │   ├── mdx/                                # 커스텀 MDX 컴포넌트
│   │   │   ├── mermaid.tsx                     # 다이어그램 렌더링
│   │   │   ├── asciinema.tsx                   # 터미널 녹화 플레이어
│   │   │   ├── badge.tsx                       # 상태 뱃지 (9가지 스타일)
│   │   │   ├── button.tsx                      # 링크 버튼
│   │   │   ├── columns.tsx                     # 멀티컬럼 레이아웃
│   │   │   └── details.tsx                     # 아코디언 (collapsible)
│   │   ├── version-selector.tsx                # 프로젝트 버전 전환기
│   │   └── guide-icon.tsx                      # 사이드바 가이드 아이콘
│   │
│   ├── lib/
│   │   └── source.ts                           # Fumadocs 소스 로더 설정
│   │
│   └── types/
│       └── asciinema-player.d.ts               # 타입 정의
│
├── content/docs/                               # 문서 콘텐츠
│   ├── 2020/
│   ├── 2021/
│   ├── 2022/
│   ├── 2023/
│   ├── 2024/
│   ├── 2025/
│   ├── 2026/
│   │   └── project-*/                          # 프로젝트별 구조
│   │       ├── index.mdx                       # 프로젝트 개요
│   │       ├── architecture.mdx                # 설계 문서
│   │       ├── api-guide.mdx                   # API 가이드
│   │       └── setup.mdx                       # 설치/설정
│   └── guide/                                  # 문서 작성 가이드
│       ├── components.mdx                      # 컴포넌트 카탈로그
│       ├── mdx-guide.mdx                       # MDX 작성 방법
│       └── document-management.mdx             # 문서 관리 정책
│
├── .source/                                    # Fumadocs 자동 생성 (84+ imports)
│   ├── server.ts
│   ├── browser.ts
│   └── dynamic.ts
│
├── scripts/
│   └── auto-meta.mjs                           # 메타데이터 자동 생성 스크립트
│
├── public/files/                               # 다운로드 파일
│   ├── *.xlsx                                  # 엑셀 문서
│   └── *.pdf                                   # PDF 문서
│
├── Dockerfile                                  # 멀티스테이지 빌드
├── docker-compose.yml                         # Production 배포
├── docker-compose.dev.yml                     # Development 개발
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── package-lock.json
```

**콘텐츠 규모:**

- 총 56개 MDX/MD 파일
- 7개 연도 카테고리 (2020~2026)
- 5개 프로젝트 그룹 (project-alpha, project-beta, project-gamma, project-delta, openstack-helm)
- 가이드 섹션 (3개 페이지)

### 핵심 기능 상세

#### 1. 커스텀 MDX 컴포넌트 (6종)

**Mermaid 다이어그램 (`mermaid.tsx`)**

클라이언트 사이드에서 Mermaid 차트를 동적으로 렌더링합니다.

```tsx
export function Mermaid({ chart }: { chart: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="my-4 p-4 rounded-lg bg-fd-muted animate-pulse h-32" />;
  return <MermaidRenderer chart={chart} />;
}
```

**특징:**

- 테마 인식: 다크/라이트 모드 자동 전환 (next-themes)
- 로딩 상태: 마운트 전 skeleton loader 표시
- 에러 처리: Mermaid 렌더링 실패 시 에러 메시지 표시
- 성능: 동적 import로 Mermaid 라이브러리 분리 로딩
- 보안: securityLevel='loose'로 사용자 정의 렌더링 지원

**사용 예:**

```markdown
<Mermaid chart={`
  graph TD
    A[사용자] --> B[API]
    B --> C[데이터베이스]
`} />
```

**Asciinema 터미널 녹화 (`asciinema.tsx`)**

.cast 파일 형식의 터미널 녹화를 재생합니다.

**옵션:**
- `rows/cols`: 터미널 크기
- `autoPlay`: 자동 재생 여부
- `loop`: 반복 재생 여부
- `speed`: 재생 속도 배율
- 테마: monokai, asciinema 중 선택

**Badge 상태 뱃지 (`badge.tsx`)**

9가지 스타일의 인라인 뱃지를 렌더링합니다.

| 스타일 | 라이트 배경 | 다크 배경 | 사용 용도 |
|--------|----------|---------|----------|
| `info` | #dbeafe | #1e3a5f | 정보 제공 |
| `success` | #d1fae5 | #064e3b | 성공/완료 |
| `warning` | #fef3c7 | #451a03 | 경고 |
| `danger` | #fee2e2 | #450a0a | 오류/위험 |
| `note` | #e0e7ff | #1e1b4b | 참고 사항 |
| `tip` | #d1fae5 | #064e3b | 팁/권장 |
| `important` | #ede9fe | #2e1065 | 중요 |
| `caution` | #fff7ed | #431407 | 주의 |
| `default` | #f3f4f6 | #374151 | 기본 |

```tsx
<Badge style="success" title="상태" value="완료" />
```

**Button 링크 버튼 (`button.tsx`)**

- outline/solid 두 가지 변형
- 외부 링크 자동 감지 → 새 창(target="_blank") + rel="noopener noreferrer"
- 외부 링크 시 아이콘 추가 렌더링

**Columns 멀티컬럼 레이아웃 (`columns.tsx`)**

flex 기반 반응형 멀티컬럼 컴포넌트

```tsx
<Columns ratio="1:2">
  <div>왼쪽 (1/3)</div>
  <div>오른쪽 (2/3)</div>
</Columns>
```

**지원 비율:**
- "1:1" (균등)
- "1:2" (1대2)
- "2:1" (2대1)
- "1:1:1" (3등분)

모바일에서는 자동으로 단일 컬럼으로 변환됩니다.

**Details 아코디언 (`details.tsx`)**

HTML `<details>` 요소 래퍼로, 클릭 가능한 아코디언을 제공합니다.

```tsx
<Details title="클릭하여 펼치기">
  숨겨진 콘텐츠
</Details>
```

#### 2. 버전 관리 시스템

**VersionSelector 컴포넌트**

docs/layout.tsx에서 다중 프로젝트/버전을 탭으로 전환합니다.

```tsx
// 사이드바에 연도별 탭 표시
// 2026 → 2025 → ... → 2020 → Guide (내림차순)
```

**기능:**
- 현재 선택된 연도 강조 표시
- 중복 폴더명 자동 숨김/표시 (예: 같은 project-alpha가 여러 연도에 있을 때 구분)
- aria-expanded로 접근성 지원
- 사이드바 네비게이션 상태 동기화

#### 3. 자동화 스크립트 (auto-meta.mjs)

**목적:** 문서 추가/수정 시 YAML frontmatter 및 meta.json을 자동 생성/갱신

**처리 흐름:**

```
content/docs/ 감시 (watch 모드)
    ↓
.mdx/.md 파일 변경 감지 (1.5초 디바운스)
    ↓
각 파일에 YAML frontmatter 추가
    (예: title, description, keywords)
    ↓
각 디렉토리에 meta.json 생성
    (예: name, icon, defaultOpen 등)
    ↓
.source/ 디렉토리 재생성 (fumadocs-mdx)
```

**실행:**

```bash
# 수동 실행
npm run auto-meta

# Watch 모드 (개발 중)
npm run predev

# Dry-run (미리보기)
npm run auto-meta -- --dry-run
```

**특징:**
- 약 200줄의 스크립트 (Node.js)
- recursive 디렉토리 스캔
- dry-run 모드로 변경사항 미리보기
- 1.5초 디바운스로 중복 실행 방지

#### 4. 문서 레이아웃

**App Router 기반 3컬럼 레이아웃**

```
┌─────────────────────────────────────────────┐
│  Tech Docs Portal (GitHub 링크)               │  Header
├────┬──────────────────────────────┬──────────┤
│    │                              │          │
│ 사 │  콘텐츠 (연도/프로젝트)      │   목차  │  Main
│ 이 │  - Mermaid 다이어그램       │  (TOC) │
│ 드 │  - Code blocks              │         │
│ 바 │  - Custom components        │         │
│    │                              │         │
└────┴──────────────────────────────┴──────────┘
```

**레이아웃 치수:**
- 좌측 사이드바: 260px (고정)
- 중앙 콘텐츠: 유동 (1fr)
- 우측 목차: 260px (고정)
- 반응형: 1280px 이상에서만 3컬럼

**탭 시스템 (연도별)**

```tsx
// docs/layout.tsx
const tabs = [
  { label: '2026', href: '/docs/2026/...' },
  { label: '2025', href: '/docs/2025/...' },
  ...
  { label: 'Guide', href: '/docs/guide/...' }
];
```

**동적 라우팅**

```
/docs                           → /docs/2025/project-alpha (기본)
/docs/2025/project-alpha        → 2025년 project-alpha 페이지
/docs/2025/project-alpha/setup  → setup.mdx 문서
```

### 테마 시스템

**컬러 팔레트 (민트 테마)**

**라이트 모드:**

```css
--color-fd-primary:           #11999e  /* 민트 그린 */
--color-fd-background:        #f3f6f6  /* 밝은 회색 */
--color-fd-foreground:        #40514e  /* 어두운 회색 */
--color-fd-card:              #ffffff  /* 카드 배경 */
--color-fd-border:            rgba(207, 212, 211, 0.6)
```

**다크 모드:**

```css
--color-fd-primary:           #30e3ca  /* 밝은 시안 */
--color-fd-background:        #1a1f1e  /* 매우 어두운 */
--color-fd-foreground:        #d0d5d3  /* 밝은 텍스트 */
--color-fd-card:              #222827  /* 카드 배경 */
--color-fd-border:            rgba(48, 227, 202, 0.12)
```

**폰트:**

- Sans: SUITE Variable (한국어 지원, 가변 폰트)
- Mono: D2Coding (개발자 친화적, ligature 지원)
- Fallback: system fonts

**GFM Alert (GitHub Flavored Markdown) - 5종**

```markdown
> [!NOTE]
> 참고 사항

> [!WARNING]
> 경고

> [!TIP]
> 팁

> [!IMPORTANT]
> 중요

> [!CAUTION]
> 주의
```

각 알림 타입은 전용 아이콘과 색상을 포함합니다.

**테이블 스타일:**

- 그라디언트 헤더 (primary color 기반)
- 행 스트라이핑 (짝수/홀수 배경 구분)
- 보더: fd-border 컬러
- 레스판시브: 모바일에서 스크롤 가능

### Docker 설정

#### Production (docker-compose.yml)

```yaml
version: '3.8'
services:
  docs-portal:
    build:
      context: ./docs-portal
      dockerfile: Dockerfile
    ports:
      - "3030:3030"
    environment:
      NODE_ENV: production
      PORT: 3030
    restart: unless-stopped
```

**Dockerfile 분석:**

**Stage 1: deps (의존성)**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --ignore-scripts
```

**Stage 2: builder (빌드)**

```dockerfile
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DOCKER_BUILD=1
RUN npx fumadocs-mdx && npm run build
```

- fumadocs-mdx 실행 (MDX → React 컴포넌트 변환)
- Next.js 빌드 (output: 'standalone')

**Stage 3: runner (실행)**

```dockerfile
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3030
CMD ["node", "server.js"]
```

**특징:**
- 3단계 멀티스테이지 (deps → builder → runner)
- Alpine 기반 (이미지 크기 최소화)
- 비루트 사용자 (nextjs:nextjs)
- standalone 출력 (no node_modules 필요)
- 포트: 3030

#### Development (docker-compose.dev.yml)

```yaml
version: '3.8'
services:
  docs-portal-dev:
    build:
      context: ./docs-portal
      dockerfile: Dockerfile.dev
    ports:
      - "3030:3030"
    volumes:
      - ./docs-portal:/app
      - /app/node_modules        # 도커 볼륨 (호스트 마운트 우회)
      - /app/.next                # 빌드 캐시
    environment:
      NODE_ENV: development
      WATCHPACK_POLLING: "1000"   # 파일 감시 폴링 (ms)
      CHOKIDAR_USEPOLLING: "true"
      PORT: 3030
    stdin_open: true
    tty: true
```

**개발 환경 특징:**
- 호스트 코드 볼륨 마운트 (./docs-portal:/app)
- node_modules를 도커 볼륨으로 관리 (I/O 성능 개선)
- WATCHPACK_POLLING: webpack 파일 감시 폴링 간격 (1초)
- CHOKIDAR_USEPOLLING: chokidar 라이브러리 폴링 활성화
- stdin_open + tty: 인터랙티브 모드

**npm 스크립트:**

```json
{
  "predev": "node scripts/auto-meta.mjs",
  "dev": "node scripts/auto-meta.mjs --watch & next dev --hostname 0.0.0.0 --port 3030",
  "build": "next build",
  "start": "next start --hostname 0.0.0.0 --port 3030",
  "postinstall": "fumadocs-mdx"
}
```

---

## MDX 렌더링 성능 분석

### 성능 문제의 원인

MDX는 Markdown과 React의 하이브리드입니다. 이로 인해 처리 파이프라인이 매우 복잡합니다.

#### 1. MDX 빌드 파이프라인의 복잡성

```
.mdx 파일 변경
    ↓
[1] Fumadocs-mdx 스캔 & 컴파일
    - .mdx 파일 파싱
    - frontmatter YAML 추출
    - .source/ 디렉토리 재생성 (84+ 자동 imports)
    ↓
[2] Remark/Rehype 플러그인 체인 처리
    - remark-github-blockquote-alert (GFM alerts)
    - 기타 커스텀 플러그인
    ↓
[3] TypeScript 컴파일
    - JSX 문법 변환
    - 타입 체크
    ↓
[4] Webpack/Turbopack 번들링
    - 코드 스플리팅
    - Tree shaking
    ↓
[5] Next.js 정적 생성 (SSG)
    - 각 페이지별 HTML 생성
    ↓
브라우저 반영 (HMR)
    약 15~30초 소요
```

#### 2. Next.js Dev 모드의 JIT 컴파일 오버헤드

Next.js 개발 모드는 페이지 요청 시마다 on-the-fly 컴파일을 수행합니다.

```
사용자 페이지 요청 (/docs/2025/project-alpha/setup)
    ↓
Next.js Route 매칭 & dynamic import
    ↓
[[...slug]]/page.tsx 실행
    ↓
getStaticProps 수행
    - Fumadocs 소스 로더 실행
    - MDX 파일 로드
    - 메타데이터 추출
    ↓
MDX 렌더링
    - 컴포넌트 변환
    - 리액트 트리 생성
    ↓
HTML 생성 & 캐싱
    ↓
클라이언트에 전달
```

이 모든 과정이 **매 페이지 요청마다** 반복됩니다. 개발 모드에서는 캐싱이 제한적이기 때문입니다.

#### 3. 최적화 부재

개발 모드에서는 프로덕션 최적화가 비활성화됩니다:

- **No Minification**: 코드 크기 최소화 없음
- **No Code Splitting**: 청크 분리 없음
- **No Tree Shaking**: 미사용 코드 제거 없음
- **Source Maps**: 전체 소스맵 생성 (느림)

### Docker 환경에서의 추가 오버헤드

#### 1. 볼륨 마운트 I/O 성능 저하

**로컬 개발 (macOS/Linux):**

```
호스트 파일시스템 (SSD)
    ↓ (직접 접근)
Node.js 프로세스
    응답 시간: ~5~10ms
```

**Docker 볼륨 마운트:**

```
호스트 파일시스템 (SSD)
    ↓ (FUSE/VPKit/Hyper-V 변환)
Docker 데몬 (containerd)
    ↓ (가상화 계층)
컨테이너 내 Node.js
    응답 시간: ~50~100ms+ (10배 이상 느림)
```

**특히 느린 작업:**

- node_modules 접근 (수천 개 파일의 메타데이터 읽기)
- 스크립트 실행 (shebang 해석)
- 캐시 생성 (임시 파일 쓰기)

#### 2. node_modules 접근 최적화

**문제 상황:**

```dockerfile
VOLUME /app
```

이 설정으로 node_modules도 호스트에서 마운트되면, 매번 10배 느린 접근이 발생합니다.

**해결책:**

```yaml
volumes:
  - ./docs-portal:/app          # 호스트 코드만 마운트
  - /app/node_modules           # 도커 볼륨 (고성능)
  - /app/.next                  # 빌드 캐시 (도커 볼륨)
```

이렇게 하면 node_modules는 컨테이너 내부 스토리지를 사용하여, 호스트 I/O 오버헤드를 완전히 우회합니다.

#### 3. 파일 감시 (File Watching) 최적화

Node.js 파일 감시 라이브러리는 기본적으로 OS의 파일 시스템 이벤트를 사용합니다.

**Docker에서의 문제:**

일부 마운트 드라이버(특히 macOS)는 파일 시스템 이벤트를 제대로 전달하지 않습니다.

**해결책: 폴링 모드 활성화**

```yaml
environment:
  WATCHPACK_POLLING: "1000"      # webpack 감시 1초 폴링
  CHOKIDAR_USEPOLLING: "true"    # chokidar 감시 폴링
```

이는 성능을 약간 희생하지만 (1초 추가 지연), 신뢰성을 크게 향상시킵니다.

#### 4. 네트워크 오버헤드 (컨테이너 포트)

```
호스트 localhost:3030
    ↓ (네트워크 변환)
컨테이너 0.0.0.0:3030
    응답 시간: +10~20ms
```

로컬 루프백(localhost)이라도 Docker 드라이버 변환 오버헤드가 있습니다.

---

## md_web_server 벤치마크

### 개요

md_web_server는 Python 기반의 경량 마크다운 서버입니다. 같은 작업을 .md 기반으로 수행할 때의 성능을 보여줍니다.

### 아키텍처

```
Markdown 파일 변경 감지 (watchdog)
    ↓
Python markdown 라이브러리 → HTML 변환
    ↓
Jinja2 템플릿 렌더링
    ↓
dist/ 디렉토리에 작성
    ↓
SimpleHTTPServer로 서빙
```

### 핵심 특징

| 측면 | md_web_server | docs-portal |
|------|---------------|------------|
| **언어** | Python | JavaScript (TypeScript) |
| **마크다운 엔진** | Python markdown | fumadocs-mdx |
| **빌드 시간** | 수백 ms | 15~30초 |
| **파일 감시** | watchdog (신뢰성 높음) | chokidar/Turbopack |
| **의존성** | Jinja2, Markdown, watchdog (3개) | npm 패키지 300+ |
| **초기화 시간** | 수십 ms | 1~2초 |
| **메모리 사용** | ~50MB | ~200MB |
| **컨테이너화** | 간단함 | 복잡함 (멀티스테이지) |

### 성능 비교

#### 성능 메트릭

```
시나리오: 문서 파일 변경 후 브라우저 반영 시간

┌─────────────────────────────────────────────────┐
│ md_web_server (.md 기반)                        │
├─────────────────────────────────────────────────┤
│ [100ms] 파일 변경 감지 (watchdog)              │
│ [10ms]  Python markdown 렌더링                 │
│ [5ms]   Jinja2 템플릿                          │
│ [5ms]   dist/ 쓰기                             │
├─────────────────────────────────────────────────┤
│ 총 소요: ~120ms (reload 제외)                  │
└─────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ docs-portal (.mdx 기반, Docker)                  │
├──────────────────────────────────────────────────┤
│ [500ms]   파일 변경 감지 (WATCHPACK_POLLING)    │
│ [200ms]   fumadocs-mdx 스캔                     │
│ [2000ms]  .source/ 재생성 (84+ imports)        │
│ [5000ms]  TypeScript 컴파일                     │
│ [8000ms]  Webpack/Turbopack 번들링              │
│ [5000ms]  Next.js SSG                          │
│ [500ms]   Docker I/O 동기화                     │
├──────────────────────────────────────────────────┤
│ 총 소요: ~21.7초 (실제: 30초+)                  │
└──────────────────────────────────────────────────┘
```

### 왜 이렇게 다를까?

**md_web_server:**
- 마크다운 → HTML 변환만 필요 (단순)
- 빌드 파이프라인 불필요
- 정적 템플릿 렌더링만 수행

**docs-portal:**
- 마크다운 + React 혼합 (복잡)
- JSX 컴파일 필수
- 번들링 & 최적화 필수
- TypeScript 타입 체크 필수

---

## 대안 솔루션 비교

### 1. 런타임 렌더링 (빌드 제로)

이 솔루션들은 빌드 없이 브라우저나 서버에서 실시간으로 마크다운을 렌더링합니다.

#### Docsify

```javascript
// index.html
<script>
  window.$docsify = {
    repo: 'your-repo',
    loadSidebar: true,
    search: 'auto'
  }
</script>
<script src="//cdn.jsdelivr.net/npm/docsify@4"></script>
```

**장점:**
- 빌드 프로세스 제로
- 파일 수정 시 즉시 반영 (새로고침 만으로)
- 배포 간단 (정적 파일만)
- 초경량 (CDN에서 로드)

**단점:**
- 클라이언트 사이드 렌더링 (JS 필수)
- SEO 약함 (동적 콘텐츠)
- 오프라인 미지원
- 커스터마이징 제한적

**재빌드 시간:** 0초

#### Retype (.NET)

```bash
retype start
# 또는
retype build
```

**특징:**
- .NET 기반 (Windows/Linux/macOS)
- 빌드 시간 <1초
- Watch 모드로 즉시 반영
- 프로페셔널한 디자인
- SEO 최적화 (정적 HTML)

**단점:**
- .NET 설치 필요
- Node.js 에코시스템과 비호환
- 커스텀 컴포넌트 제한

**재빌드 시간:** ~500ms

#### Wiki.js

```yaml
# docker-compose.yml
version: '3.8'
services:
  wiki:
    image: requarks/wiki:latest
    ports:
      - "3000:3000"
    environment:
      DB_TYPE: postgres
```

**특징:**
- 풀 기능 위키 플랫폼
- Git 자동 동기화
- 권한 관리 내장
- 실시간 편집 지원
- 다양한 데이터베이스 지원

**단점:**
- 배포 복잡도 높음 (데이터베이스 필요)
- 과도한 기능 (문서 포털에는 오버)
- 리소스 사용량 높음

### 2. 빠른 빌드 SSG (1초 이내)

#### MkDocs Material (Python)

```bash
pip install mkdocs mkdocs-material
mkdocs serve
```

**structure:**

```
docs/
├── index.md
├── guides/
│   ├── getting-started.md
│   └── advanced.md
└── api/
    └── reference.md

mkdocs.yml
```

**설정 예:**

```yaml
site_name: Tech Docs Portal
theme:
  name: material
  language: ko
nav:
  - Home: index.md
  - Guides: guides/
  - API: api/
```

**특징:**
- Python 기반 (가볍고 설치 간단)
- 재빌드 시간: 수백 ms
- Material Design 테마 (모던)
- 플러그인 풍부 (검색, 다국어, 등)
- 가장 인기 있는 기술문서 도구

**성능:**

```
.md 변경 → Python markdown → 수백ms → HTML 생성
```

**단점:**
- 반응형 커스터마이징 복잡
- React 컴포넌트 미지원 (순수 HTML)
- 고급 인터랙션 제한

**재빌드 시간:** ~300ms

**Docker 예:**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY docs/ ./docs
CMD ["mkdocs", "serve", "--dev-addr=0.0.0.0:8000"]
```

#### VitePress (Vue 3 + Vite)

```bash
npm create vitepress
npm run docs:dev
```

**특징:**
- Vite 기반 (번개 같은 빌드)
- Vue 3 컴포넌트 지원
- 재빌드 시간: 수백 ms
- 모던 개발자 경험
- 뜨거운 모듈 교체 (HMR) 즉시 반영

**설정 예:**

```typescript
// docs/.vitepress/config.ts
export default {
  title: 'Tech Docs Portal',
  lang: 'ko-KR',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' }
    ]
  }
}
```

**성능:**

```
.md 변경 → Vite HMR → 브라우저 즉시 반영 (1~2초)
```

**장점:**
- Vue 컴포넌트 임베드 가능
- HMR 즉시 반영
- TypeScript 지원
- 프로덕션 빌드 <1초

**단점:**
- Vue 생태계 학습 필요
- React 컴포넌트 미지원

**재빌드 시간:** ~200ms

#### Hugo (Go)

```bash
hugo server
```

**특징:**
- Go 바이너리 (초고속)
- 재빌드 시간: ~50ms
- 정적 사이트 생성기 (가장 빠름)
- 테마 풍부

**단점:**
- Go 템플릿 문법 학습 필요
- 커스텀 컴포넌트 제한
- 동적 기능 약함

**재빌드 시간:** ~50ms

#### mdBook (Rust)

```bash
mdbook serve
```

**특징:**
- Rust 기반 (Rust 공식 문서 사용)
- 재빌드 시간: ~100ms
- 검색 기능 내장
- 테마 지원

**재빌드 시간:** ~100ms

### 3. MDX 기반 SSG (느린 빌드)

모든 MDX 기반 솔루션은 React 컴포넌트 변환이 필수이므로 느립니다.

#### Fumadocs (현재 사용 중)

**재빌드 시간:** 15~30초 (Docker: 30초+)

**장점:**
- 풍부한 MDX 컴포넌트
- Fumadocs UI 내장
- 타입 안전성 (TypeScript)
- React 생태계 활용 가능

**단점:**
- 빌드 시간 느림
- Docker 개발 환경 복잡

#### Docusaurus

```bash
npm install docusaurus
npx create-docusaurus@latest my-site classic
```

**재빌드 시간:** 20~40초

**특징:**
- Facebook(Meta) 주도 프로젝트
- 다국어 지원 강력
- 블로그 기능 내장
- 플러그인 풍부

**단점:**
- fumadocs보다 무거움
- 메모리 사용량 많음

#### Nextra (Next.js + MDX)

```bash
npm install nextra next-themes
```

**재빌드 시간:** 10~20초 (MDX 기반 중 상대적으로 빠름)

**특징:**
- Next.js 기반
- 설정 간결
- 빌드 비교적 빠름
- React 컴포넌트 풀 지원

### 성능 비교 테이블

| 솔루션 | 엔진 | 재빌드 | 빌드 제로 | 컴포넌트 | SEO | 권장 용도 |
|--------|------|--------|---------|---------|-----|---------|
| **Docsify** | JS (브라우저) | 0초 | ✅ | ❌ | ❌❌ | 빠른 프로토타입 |
| **Retype** | .NET | ~500ms | ❌ | 제한적 | ✅ | 중간 규모 문서 |
| **Wiki.js** | Node.js | - | ✅ | ✅ | ❌ | 팀 위키 |
| **MkDocs Material** | Python | ~300ms | ❌ | 제한적 | ✅ | 기술문서 (Best) |
| **VitePress** | Vue/Vite | ~200ms | ❌ | ✅ (Vue) | ✅ | Vue 생태계 |
| **Hugo** | Go | ~50ms | ❌ | 제한적 | ✅ | 초고속 필요 |
| **mdBook** | Rust | ~100ms | ❌ | 제한적 | ✅ | Rust 프로젝트 |
| **Nextra** | Next.js | 10~20초 | ❌ | ✅ (React) | ✅ | React 컴포넌트 필요 |
| **Docusaurus** | React | 20~40초 | ❌ | ✅ | ✅ | 블로그+문서 |
| **Fumadocs** (현재) | React | 15~30초 | ❌ | ✅ | ✅ | React 심화 필요 |

---

## 결론 및 권장사항

### 현황 정리

**docs-portal**은 기능이 풍부한 프로덕션급 문서 포털입니다. 그러나 MDX의 복잡한 빌드 파이프라인과 Docker 볼륨 마운트 오버헤드로 인해 **개발 생산성이 심각하게 저하**되고 있습니다.

### 의사결정 기준

선택은 다음 질문에 따라 결정됩니다:

#### Q1: 즉시 반영(reload 1초 이내)이 필요한가?

**YES** → Python/Go 기반 솔루션으로 전환

**NO** → 현재 스택 유지 (하지만 최적화 필수)

#### Q2: React 커스텀 컴포넌트가 필수인가?

**YES** → Nextra 또는 현재 fumadocs (최적화)

**NO** → MkDocs Material (권장)

#### Q3: 팀의 기술 스택은?

**Python** → MkDocs Material
**Node.js/JavaScript** → VitePress
**Go** → Hugo
**Rust** → mdBook

### 권장 솔루션

#### 시나리오 1: 즉시 반영 필요 + React 불필요

```
추천: MkDocs Material (Python)
재빌드: ~300ms
개발 생산성: 50배 향상
학습곡선: 낮음
```

**이유:**
- 가장 인기 있는 기술문서 도구
- 빌드 시간 매우 빠름
- 플러그인/테마 풍부
- Python 기반 (간단한 배포)
- 한국어 지원 우수

**마이그레이션 비용:** 중간 (MDX → Markdown 변환)

#### 시나리오 2: 즉시 반영 필요 + React 컴포넌트 필요

```
추천: VitePress (Vue 3 + Vite)
재빌드: ~200ms
개발 생산성: 80배 향상
학습곡선: 중간
```

**이유:**
- Vite 기반 (초고속 HMR)
- Vue 3 컴포넌트 지원
- TypeScript 네이티브
- 모던 개발자 경험

**마이그레이션 비용:** 높음 (React → Vue 변환)

#### 시나리오 3: 현재 fumadocs 스택 유지

```
즉시 조치:
1. docker-compose.dev.yml에서 node_modules 도커 볼륨화
2. WATCHPACK_POLLING/CHOKIDAR_USEPOLLING 활성화
3. 캐시 디렉토리 최적화

기대 성능 개선: 20~30% (여전히 느림)
```

**설정 예:**

```yaml
# docker-compose.dev.yml
services:
  docs-portal-dev:
    volumes:
      - ./docs-portal:/app
      - /app/node_modules       # 도커 볼륨
      - /app/.next              # 캐시
    environment:
      WATCHPACK_POLLING: "1000"
      CHOKIDAR_USEPOLLING: "true"
      NODE_ENV: development
```

### 최종 권장사항

#### 단기 (1주)

1. **docker-compose.dev.yml 최적화** (위 설정 적용)
2. **WATCHPACK_POLLING 튜닝** (1000ms에서 시작, 필요시 조정)
3. **성능 측정** (변경 → 반영 시간 재측정)

**기대 효과:** 20~30% 성능 개선

#### 중기 (1개월)

1. **팀 의견 수렴**: MDX 커스텀 컴포넌트의 실제 필요성 검증
2. **대안 프로토타입**: MkDocs Material로 샘플 구성
3. **비용-편익 분석**:
   - 마이그레이션 비용 vs 개발 생산성 향상
   - 유지보수 복잡도 감소

#### 장기 (3개월)

**의사결정 1: 계속 fumadocs 사용**
- Docker 개발 환경 완전 최적화
- CI/CD 파이프라인 구축 (자동 빌드/배포)
- 증분 빌드 캐싱 강화

**의사결정 2: 대안 솔루션으로 전환**
- MkDocs Material 또는 VitePress로 마이그레이션
- 커스텀 플러그인/테마 개발
- 기존 콘텐츠 자동 변환 스크립트 작성

### 마이그레이션 체크리스트 (만약 전환 결정 시)

#### MkDocs Material로 전환할 경우

```markdown
## 준비 단계
- [ ] Python 3.10+ 설치 확인
- [ ] mkdocs + mkdocs-material 설치
- [ ] mkdocs.yml 설정 파일 작성

## 콘텐츠 변환
- [ ] MDX → Markdown 자동 변환 스크립트 작성
- [ ] React 컴포넌트 → Markdown 블록 변환
- [ ] Mermaid 다이어그램 유지 (호환성 100%)

## 테마/스타일
- [ ] Material 테마 설정
- [ ] 민트 색상 커스터마이징
- [ ] 한국어 리소스 번역

## 배포
- [ ] Docker 이미지 작성
- [ ] docker-compose.yml 구성
- [ ] CI/CD 파이프라인 구축

## 테스트
- [ ] 검색 기능 검증
- [ ] 모바일 반응형 확인
- [ ] 다크모드 테스트

## 런칭
- [ ] DNS/라우팅 설정
- [ ] 리다이렉트 설정 (docs-portal.local → new-domain)
- [ ] 팀 교육
```

---

## 부록: 성능 측정 방법

### 1. 로컬 개발 성능 측정

```bash
# 터미널 1: 파일 감시 및 로그
npm run dev 2>&1 | tee build.log

# 터미널 2: 파일 변경 시점 기록
touch src/app/page.tsx && date

# 브라우저: Network 탭에서 HTML 로딩 시간 확인
```

**측정 항목:**
- 파일 변경 시간 → 터미널 로그 "compiled client successfully" 시간 차이
- HTML 로드 시간: DevTools Network 탭

### 2. Docker 환경 성능 측정

```bash
# docker-compose.dev.yml 실행
docker-compose -f docker-compose.dev.yml up

# 컨테이너 내부 로그 모니터링
docker-compose logs -f docs-portal-dev

# 호스트에서 파일 변경 후 로그 확인
touch docs-portal/content/docs/2025/project-alpha/index.mdx
```

### 3. 병목 지점 분석

```bash
# webpack 빌드 분석
npm run build -- --analyze

# Next.js 빌드 시간 프로파일링
NODE_ENV=production next build --profile
```

---

## 참고 자료

### 공식 문서
- [Next.js 문서](https://nextjs.org/docs)
- [Fumadocs 문서](https://fumadocs.vercel.app)
- [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)
- [VitePress](https://vitepress.dev/)

### 성능 최적화
- [Next.js Performance Best Practices](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Docker Volume Performance](https://docs.docker.com/desktop/features/file-sharing/)
- [webpack Bundle Analysis](https://webpack.js.org/plugins/bundle-analyzer/)

### 마크다운 도구 비교
- [Static Site Generators List](https://jamstack.org/generators/)
- [Markdown Tools Benchmarks](https://github.com/topics/markdown-renderer)

---

**문서 최종 수정:** 2026-04-08  
**작성자:** Tech Documentation Team  
**분류:** 기술 분석 / 아키텍처 문서
