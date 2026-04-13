---
title: "Vue 3 Composition API 완벽 가이드"
date: 2026-04-13
category: tech
subcategory: frontend
excerpt: "Vue 3의 Composition API를 실전 예제와 함께 알아봅니다. setup, ref, reactive, computed의 핵심 개념을 정리합니다."
tags: [vue, javascript, frontend]
---

# Vue 3 Composition API 완벽 가이드

## Composition API란?

Vue 3에서 도입된 Composition API는 컴포넌트 로직을 함수 기반으로 구성할 수 있게 해주는 API 세트입니다. 기존 Options API와 달리, 관련 로직을 한곳에 모아 관리할 수 있어 대규모 프로젝트에서 특히 유용합니다.

## 핵심 개념

### ref와 reactive

`ref`는 단일 값을, `reactive`는 객체를 반응형으로 만듭니다.

```javascript
import { ref, reactive } from 'vue'

// ref: 단일 값
const count = ref(0)
console.log(count.value) // 0

// reactive: 객체
const state = reactive({
  name: '홍길동',
  age: 30
})
console.log(state.name) // '홍길동'
```

### computed

계산된 속성을 정의합니다. 의존하는 반응형 데이터가 변경될 때만 다시 계산됩니다.

```javascript
import { ref, computed } from 'vue'

const firstName = ref('길동')
const lastName = ref('홍')

const fullName = computed(() => `${lastName.value}${firstName.value}`)
```

### watch와 watchEffect

```javascript
import { ref, watch, watchEffect } from 'vue'

const count = ref(0)

// 특정 소스 감시
watch(count, (newVal, oldVal) => {
  console.log(`${oldVal} -> ${newVal}`)
})

// 자동 의존성 추적
watchEffect(() => {
  console.log(`현재 카운트: ${count.value}`)
})
```

## 실전 예제: 데이터 페칭 Composable

```javascript
import { ref } from 'vue'

export function useFetch(url) {
  const data = ref(null)
  const error = ref(null)
  const loading = ref(true)

  fetch(url)
    .then(res => res.json())
    .then(json => { data.value = json })
    .catch(err => { error.value = err })
    .finally(() => { loading.value = false })

  return { data, error, loading }
}
```

## 정리

| 기능 | Options API | Composition API |
|------|------------|-----------------|
| 상태 | `data()` | `ref()` / `reactive()` |
| 계산 | `computed: {}` | `computed(() => ...)` |
| 감시 | `watch: {}` | `watch()` / `watchEffect()` |
| 생명주기 | `mounted()` | `onMounted()` |

Composition API는 코드 재사용성과 타입 추론에서 큰 이점을 제공합니다.
