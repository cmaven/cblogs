---
title: "Node.js 메모리 누수 디버깅 — heap snapshot으로 원인 찾는 실전 가이드"
description: "Node.js 서버가 서서히 느려지고 OOM으로 재시작된다면 메모리 누수가 원인이다. heap snapshot과 Chrome DevTools로 범인을 5분 만에 특정하는 방법을 단계별로 정리했다."
excerpt: "heap snapshot 3회 비교로 유출 객체를 정확히 찾고, 흔한 5가지 누수 패턴을 실제 코드로 진단한다"
date: 2026-04-16
category: tech
subcategory: backend
tags: [Node.js, 메모리누수, heap-snapshot, ChromeDevTools, 성능]
---

# Node.js 메모리 누수 디버깅 — heap snapshot으로 원인 찾는 실전 가이드

Node.js 서버의 메모리 누수는 응답 시간 지연과 OOM(Out of Memory) 재시작의 가장 흔한 원인이다. 이 글에서는 heap snapshot 캡처, Chrome DevTools로 비교 분석, 실제 누수 패턴 5가지를 실전 코드 기반으로 정리한다. 프로덕션 환경에서 바로 적용 가능한 절차다.

## 메모리 누수 증상 체크리스트

| 증상 | 설명 | 긴급도 |
|------|------|--------|
| RSS(Resident Set Size) 지속 상승 | 재시작 없이 며칠간 증가 | 높음 |
| GC 실행 주기가 점점 짧아짐 | heap이 꽉 차서 GC가 자주 돎 | 높음 |
| 응답 시간이 시간에 따라 증가 | GC stop-the-world 누적 | 중간 |
| `FATAL ERROR: Ineffective mark-compacts` | heap 한계 도달, 곧 OOM | 긴급 |

`process.memoryUsage().rss`를 1분 간격으로 로깅하면 추세를 쉽게 볼 수 있다.

## heap snapshot 캡처 방법

### 실행 중인 프로세스에 붙기

Node.js 12 이상은 `--inspect` 없이도 시그널로 heap snapshot을 생성할 수 있다.

```bash
# PID 찾기
ps aux | grep node

# heap snapshot 생성 (SIGUSR2 필요 시)
kill -USR2 <PID>
```

프로그램적으로는 `v8` 모듈로 호출할 수 있다:

```js
const v8 = require('v8')
const fs = require('fs')

function takeSnapshot() {
  const snapshot = v8.getHeapSnapshot()
  const fileName = `heap-${Date.now()}.heapsnapshot`
  const stream = fs.createWriteStream(fileName)
  snapshot.pipe(stream)
  return fileName
}
```

### 3회 비교 원칙

snapshot 1회만 보면 "원래부터 있던 객체"와 "누수 객체"를 구분할 수 없다. 반드시 **3회 캡처 후 비교**한다.

```
1회차: 서버 시작 직후 (baseline)
2회차: 트래픽 부하 후 10분
3회차: 동일 부하 후 20분
```

Chrome DevTools → Memory → "Comparison" 모드에서 1회차 대비 2·3회차의 **delta(#Delta)** 컬럼이 큰 생성자(constructor)가 누수의 범인이다.

## Chrome DevTools로 분석하기

### snapshot 로드

1. Chrome에서 `chrome://inspect` 접속
2. "Open dedicated DevTools for Node" 클릭
3. Memory 탭 → "Load" 버튼으로 `.heapsnapshot` 파일 로드
4. 여러 파일을 로드한 후 Comparison 뷰 전환

### 핵심 컬럼 해석

| 컬럼 | 의미 |
|------|------|
| `Constructor` | 객체 타입 (배열, 문자열, 사용자 클래스 등) |
| `#New` | 새로 생성된 객체 수 |
| `#Deleted` | 삭제된 객체 수 |
| `#Delta` | 순증가 (#New - #Deleted) |
| `Alloc. Size` | 할당된 바이트 |
| `Retained Size` | 해제 시 회수될 총 메모리 |

`#Delta`가 계속 양수로 커지는 생성자를 주목한다. 특히 `(closure)`, `(array)`, `Map`, `Set`이 자주 범인.

## 흔한 누수 패턴 5가지

### 1. 이벤트 리스너 미해제

```js
// 잘못된 예
class Cache {
  constructor(emitter) {
    emitter.on('update', (data) => this.store(data))
  }
}
// Cache가 destroy돼도 emitter가 참조를 붙잡고 놓아주지 않음
```

**해결**: `emitter.removeListener()` 또는 `AbortController` 사용.

```js
const controller = new AbortController()
emitter.on('update', handler, { signal: controller.signal })
// 정리 시
controller.abort()
```

### 2. 전역 캐시 무한 증가

```js
const cache = {}
function memoize(key, value) {
  cache[key] = value   // 삭제 로직 없음 → 영원히 누적
}
```

**해결**: LRU 캐시(`lru-cache` 패키지) 또는 TTL 적용.

### 3. Timer 참조 잔존

```js
setInterval(() => {
  fetchData().then(d => pushToQueue(d))
}, 1000)
// 프로세스 종료 전까지 해제 안 됨
```

**해결**: `clearInterval(id)` 명시적 호출, 또는 `timer.unref()`.

### 4. 클로저가 큰 객체 캡처

```js
function createHandler(largeData) {
  return (req, res) => {
    res.json({ size: largeData.length })  // largeData 전체를 붙잡고 있음
  }
}
```

**해결**: 필요한 값만 뽑아 클로저 바깥으로 전달.

### 5. Promise 체인에 누적

```js
const results = []
async function handler() {
  const r = await heavyWork()
  results.push(r)   // 모듈 레벨 배열에 무한 추가
}
```

**해결**: 결과를 DB·큐로 옮기고 메모리 배열은 비운다.

## 프로덕션 모니터링 팁

- **Prometheus + Grafana**: `nodejs_heap_size_used_bytes` 메트릭을 시각화
- **clinic.js**: `npx clinic doctor -- node app.js` 한 줄로 진단
- **APM 도구**: Datadog, New Relic이 누수 추세를 자동 감지

관련 글: PostgreSQL 성능 튜닝도 관심 있다면 [PostgreSQL 인덱스 튜닝 가이드](/posts/tech/backend/postgres-index-tuning)를 참고하자.

## 정리

메모리 누수 디버깅의 핵심은 **3회 snapshot 비교** 한 줄로 요약된다. 한 번에 찾으려 하지 말고, 시간 차이를 두고 비교해야 범인이 드러난다. 흔한 5가지 패턴만 숙지해도 실무에서 만나는 누수의 90%는 해결 가능하다.

:bulb: **한 줄 요약**: `#Delta`가 계속 양수로 증가하는 생성자를 찾으면, 그게 바로 메모리 누수의 출발점이다.
