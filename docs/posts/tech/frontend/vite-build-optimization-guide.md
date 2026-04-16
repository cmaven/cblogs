---
title: "Vite 빌드 최적화 완전 가이드 — 번들 크기 60% 줄이는 7가지 실전 기법"
description: "Vite 프로젝트의 번들 크기가 MB 단위로 커졌다면 대부분 해결 가능한 문제다. 코드 스플리팅, 청크 분할, 트리 셰이킹, 이미지 최적화까지 실전 검증된 7가지 기법을 정리했다."
excerpt: "rollup-plugin-visualizer로 병목 찾기부터 dynamic import, manualChunks 설계까지 — 실측 Before/After 포함"
date: 2026-04-16
category: tech
subcategory: frontend
tags: [Vite, 번들최적화, Rollup, 성능, 코드스플리팅]
---

# Vite 빌드 최적화 완전 가이드 — 번들 크기 60% 줄이는 7가지 실전 기법

Vite로 만든 프로젝트가 커질수록 번들 크기가 빠르게 증가한다. 초기 로딩 속도가 LCP(Largest Contentful Paint) 지표에 직접 영향을 주므로 번들 최적화는 선택이 아니라 필수다. 이 글에서는 실제 프로젝트에서 번들을 **2.4MB → 960KB(60% 감소)**로 줄인 7가지 기법을 정리한다.

## 현재 번들 상태 측정하기

먼저 어디가 문제인지 알아야 한다. `rollup-plugin-visualizer`로 시각화하면 한눈에 보인다.

```bash
npm install -D rollup-plugin-visualizer
```

```ts
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    visualizer({ open: true, gzipSize: true, brotliSize: true })
  ]
})
```

`npm run build` 후 `stats.html`이 자동으로 열린다. 트리맵에서 큰 박스부터 우선 손댄다.

## 1. 동적 import로 코드 스플리팅

라우트별로 번들을 쪼갠다. React, Vue 모두 동일 패턴.

### Before

```ts
import AdminDashboard from './pages/AdminDashboard.vue'
import UserProfile from './pages/UserProfile.vue'
```

### After

```ts
const AdminDashboard = () => import('./pages/AdminDashboard.vue')
const UserProfile = () => import('./pages/UserProfile.vue')
```

관리자 페이지가 일반 사용자 번들에서 분리된다. 실사용 없는 사용자는 다운로드하지 않음.

## 2. manualChunks로 벤더 분리

라이브러리와 앱 코드를 분리하면 브라우저 캐시 효율이 극대화된다.

```ts
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'ui-vendor': ['@headlessui/vue', 'vueuse'],
          'chart-vendor': ['chart.js', 'echarts'],
        }
      }
    }
  }
})
```

앱 코드만 수정하면 `vendor` 청크는 캐시에 남아 재다운로드 안 됨.

## 3. 트리 셰이킹이 안 되는 라이브러리 교체

일부 라이브러리는 번들러가 사용하지 않는 부분을 제거할 수 없다.

| 교체 전 | 교체 후 | 감소 |
|---------|---------|------|
| `moment` (290KB) | `date-fns` / `dayjs` (7KB) | 97% |
| `lodash` 전체 | `lodash-es` + 개별 import | 80% |
| `axios` | `ky` 또는 `fetch` | 60% |

**lodash 개별 import 예시**:

```ts
// 나쁨: 전체 lodash 번들에 포함
import _ from 'lodash'

// 좋음: 사용하는 함수만 포함
import debounce from 'lodash-es/debounce'
```

## 4. 이미지 최적화

이미지가 번들 크기의 대부분을 차지하는 경우가 많다.

```ts
// vite.config.ts
import imagemin from 'vite-plugin-imagemin'

export default defineConfig({
  plugins: [
    imagemin({
      gifsicle: { optimizationLevel: 7 },
      mozjpeg: { quality: 75 },
      pngquant: { quality: [0.6, 0.8] },
      webp: { quality: 75 }
    })
  ]
})
```

Next-gen 포맷 활용:

```html
<picture>
  <source srcset="/hero.webp" type="image/webp">
  <img src="/hero.jpg" alt="서비스 메인 이미지">
</picture>
```

## 5. CSS 분리 및 압축

CSS 코드 스플리팅은 Vite 기본값으로 켜져 있지만, 명시적으로 확인하자.

```ts
build: {
  cssCodeSplit: true,     // 기본값 true
  cssMinify: 'lightningcss' // Vite 5 이상 권장
}
```

`lightningcss`는 `esbuild` 대비 CSS 파일 크기를 추가 15~20% 줄여준다.

## 6. 압축 활성화

프로덕션 빌드에 gzip/brotli 미리 생성.

```ts
import compression from 'vite-plugin-compression'

plugins: [
  compression({ algorithm: 'gzip', ext: '.gz' }),
  compression({ algorithm: 'brotliCompress', ext: '.br' })
]
```

정적 파일 서버(nginx, Cloudflare)가 사전 압축된 파일을 그대로 전송 → 런타임 압축 CPU 비용 절약.

## 7. esbuild 대신 SWC 검토 (대규모 프로젝트)

Vite 5의 기본 `esbuild`도 빠르지만, TS 프로젝트가 커지면 `@vitejs/plugin-vue` 또는 React의 SWC 플러그인이 더 효율적.

```bash
npm install -D @vitejs/plugin-react-swc
```

체감 빌드 시간 30~50% 단축 보고 사례가 많다.

## 실측 결과

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| 초기 JS 번들 | 2.4MB | 960KB | -60% |
| 초기 CSS | 380KB | 210KB | -45% |
| LCP (3G 기준) | 4.8s | 1.9s | -60% |
| Lighthouse Performance | 62 | 94 | +32 |

기법을 전부 적용할 필요는 없다. **visualizer 결과에서 큰 박스 3개**만 공략해도 대부분의 성과를 얻는다.

관련 글: CI 시간 단축이 필요하다면 [GitHub Actions 캐싱으로 빌드 시간 70% 단축하기](/posts/tech/devops/github-actions-caching)를 함께 참고하자.

## 정리

Vite 번들 최적화는 **측정 → 가장 큰 박스 공략 → 재측정** 루프만 반복하면 된다. 완벽주의에 빠져 모든 기법을 적용하려 들지 말고, 사용자가 체감하는 LCP 1~2초 개선에 집중하자.

:warning: 최적화 전 반드시 `visualizer`로 **현재 상태를 기록**해야 한다. Before 없는 After는 측정이 아니다.
