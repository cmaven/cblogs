---
title: "Vue 3 Composition API 실전 패턴 — 재사용 가능한 Composable 7선"
description: "Vue 3 Composition API는 단순한 문법 개선이 아니라 로직 재사용 패러다임을 바꿨다. useDebounce, useLocalStorage, useFetch 등 실전에서 매일 쓰는 Composable 7가지를 완전한 TypeScript 구현과 함께 정리했다."
excerpt: "Options API mixin의 충돌 문제를 해결한 composable 패턴 — 프로덕션에서 검증된 7가지 유틸을 바로 복사해 쓸 수 있게"
date: 2026-04-12
category: tech
subcategory: frontend
tags: [Vue3, CompositionAPI, Composable, TypeScript, Pinia]
---

# Vue 3 Composition API 실전 패턴 — 재사용 가능한 Composable 7선

**📅 작성일**: 2026년 4월 12일

> [!NOTE]
> :bulb: Vue 3의 Composition API는 단순한 문법 업그레이드가 아니라 로직을 **기능 단위**로 묶어 재사용하는 새로운 패러다임이다. 이 글은 useDebounce, useLocalStorage, useFetch, useEventListener 등 실전 프로젝트에서 매일 쓰는 Composable 7가지를 완전한 TypeScript 구현 코드와 함께 정리한다. Options API 시절 mixin으로는 불가능했던 깔끔한 재사용이 가능해진다.

## Options API의 한계

Vue 2의 Options API는 `data`·`methods`·`computed`로 **속성별**로 코드를 분리했다. 같은 기능(예: 디바운스)이 여러 속성에 흩어지고, mixin으로 재사용하면 이름 충돌과 출처 추적 어려움이 발생했다. Composition API는 **기능별**로 코드를 묶는다. 한 기능이 ref·computed·watch로 구성되더라도 모두 한 composable 함수에 담기므로 응집도가 극적으로 올라간다.

## Composable 네이밍 규칙

관례적으로 `use`로 시작한다 (`useFetch`, `useMouse`). React Hook과 동일한 컨벤션이며, linter가 이 규칙을 기반으로 규칙 위반을 잡아낼 수 있다.

## 1. useDebounce — 입력 지연 반영

```ts
import { ref, watch, type Ref } from 'vue'

export function useDebounce<T>(value: Ref<T>, delay = 300): Ref<T> {
  const debounced = ref(value.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout>
  watch(value, (v) => {
    clearTimeout(timer)
    timer = setTimeout(() => (debounced.value = v), delay)
  })
  return debounced
}
```

검색창 입력 값을 바로 API로 날리지 않고 일정 시간 대기시키는 기본 패턴.

## 2. useLocalStorage — 영속 상태

```ts
import { ref, watch } from 'vue'

export function useLocalStorage<T>(key: string, init: T) {
  const stored = localStorage.getItem(key)
  const state = ref<T>(stored ? JSON.parse(stored) : init)
  watch(state, (v) => localStorage.setItem(key, JSON.stringify(v)), { deep: true })
  return state
}
```

사용:

```ts
const theme = useLocalStorage<'light' | 'dark'>('theme', 'light')
// theme.value를 바꾸면 자동으로 localStorage에도 반영됨
```

> [!TIP]
> SSR 환경(Nuxt)에서는 `typeof window === 'undefined'` 가드를 추가해야 한다. `onMounted` 이후에만 localStorage에 접근하도록 감싸는 것도 방법.

## 3. useFetch — 선언적 데이터 페칭

```ts
import { ref } from 'vue'

export function useFetch<T>(url: string) {
  const data = ref<T | null>(null)
  const error = ref<Error | null>(null)
  const loading = ref(true)

  fetch(url)
    .then((r) => r.json())
    .then((json) => (data.value = json))
    .catch((e) => (error.value = e))
    .finally(() => (loading.value = false))

  return { data, error, loading }
}
```

컴포넌트에서:

```vue
<script setup lang="ts">
const { data, error, loading } = useFetch<User[]>('/api/users')
</script>
```

## 4. useEventListener — 생명주기 자동 관리

```ts
import { onMounted, onUnmounted, type Ref } from 'vue'

export function useEventListener(
  target: Ref<HTMLElement | null> | Window,
  event: string,
  handler: EventListener
) {
  onMounted(() => {
    const el = 'value' in target ? target.value : target
    el?.addEventListener(event, handler)
  })
  onUnmounted(() => {
    const el = 'value' in target ? target.value : target
    el?.removeEventListener(event, handler)
  })
}
```

이벤트 리스너 등록과 해제를 한 줄로 처리하고 메모리 누수를 원천 차단한다.

## 5. useMouse — 마우스 좌표 추적

```ts
import { ref } from 'vue'
import { useEventListener } from './useEventListener'

export function useMouse() {
  const x = ref(0)
  const y = ref(0)
  useEventListener(window, 'mousemove', (e) => {
    x.value = (e as MouseEvent).clientX
    y.value = (e as MouseEvent).clientY
  })
  return { x, y }
}
```

Composable끼리 조합할 수 있는 것이 Composition API의 진짜 강점이다.

## 6. useClipboard — 복사/붙여넣기

```ts
import { ref } from 'vue'

export function useClipboard() {
  const copied = ref(false)
  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  }
  return { copy, copied }
}
```

> [!IMPORTANT]
> `navigator.clipboard`는 **HTTPS 또는 localhost에서만** 동작한다. HTTP로 서빙되는 개발 환경에서 테스트가 실패할 수 있으니 `https://localhost`나 Vite 내장 HTTPS 옵션을 활용하자.

## 7. useIntersectionObserver — 무한 스크롤

```ts
import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export function useIntersectionObserver(target: Ref<HTMLElement | null>) {
  const isVisible = ref(false)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (!target.value) return
    observer = new IntersectionObserver(([entry]) => {
      isVisible.value = entry.isIntersecting
    })
    observer.observe(target.value)
  })

  onUnmounted(() => observer?.disconnect())

  return { isVisible }
}
```

리스트 끝에 마커 엘리먼트를 두고 `isVisible`가 true가 되면 다음 페이지를 로드하는 패턴.

## Options API vs Composition API 비교

| 구분 | Options API | Composition API |
|------|-------------|-----------------|
| 로직 재사용 | mixin (네이밍 충돌 위험) | composable (명시적 함수 호출) |
| 타입 추론 | 약함, this 기반 | 강함, 함수 반환 타입 |
| 코드 응집도 | 속성별 분산 | 기능별 집약 |
| 테스트 | 컴포넌트 마운트 필요 | 순수 함수 단위 테스트 |
| 학습 곡선 | 초기에 낮음 | 초기에 중간, 이후 낮음 |

## 안티패턴

| 안티패턴 | 왜 나쁜가 | 대안 |
|---------|-----------|------|
| composable 안에서 `ref.value` 노출 | 반응성이 깨짐 | ref를 그대로 반환 |
| 여러 composable의 반응성 상태를 setup 밖에서 공유 | Vue 추적 실패 | Pinia 사용 |
| composable에서 DOM 직접 조작 | SSR 깨짐 | `onMounted`로 감싸기 |

> [!WARNING]
> composable은 **반드시 `setup()` 또는 다른 composable 안에서만 호출**해야 한다. 일반 함수처럼 아무 데서나 호출하면 현재 컴포넌트 인스턴스 추적이 실패해 반응성이 동작하지 않는다.

## 테스트 전략

Composable은 순수 함수이므로 Vitest로 바로 테스트할 수 있다.

```ts
import { test, expect } from 'vitest'
import { ref } from 'vue'
import { useDebounce } from '@/composables/useDebounce'

test('useDebounce delays update', async () => {
  vi.useFakeTimers()
  const src = ref('hello')
  const d = useDebounce(src, 100)
  src.value = 'world'
  expect(d.value).toBe('hello')
  vi.advanceTimersByTime(150)
  expect(d.value).toBe('world')
})
```

컴포넌트 마운트 없이 로직만 검증할 수 있어 테스트 속도가 빠르다.

관련 글: 빌드 최적화와 함께 고민이 많다면 [Vite 빌드 최적화 완전 가이드](/posts/tech/frontend/vite-build-optimization-guide)도 참고하자.

## 체크리스트

- [ ] 이름이 `use`로 시작하는가
- [ ] 반환값은 ref/computed 형태로 노출되는가
- [ ] 생명주기 훅(`onMounted`/`onUnmounted`)으로 리소스를 정리하는가
- [ ] SSR 환경에서 `typeof window`를 가드했는가
- [ ] 단위 테스트가 가능한 구조인가

> [!CAUTION]
> VueUse 같은 오픈소스 composable 라이브러리가 이미 많다. 직접 구현 전에 [vueuse.org](https://vueuse.org/)에 동일 기능이 있는지 먼저 확인하자. 바퀴를 두 번 만들 이유는 없다.

## 정리

Composition API의 진짜 가치는 **문법**이 아니라 **코드 구성 방식의 변화**에 있다. 기능별로 잘 나눠진 composable은 다른 컴포넌트에도, 다른 프로젝트에도 그대로 복사해 쓸 수 있다. 오늘 소개한 7가지를 `src/composables/` 폴더에 그대로 복사해 두자. 다음 주부터 코드 중복이 눈에 띄게 줄어들 것이다.
