---
title: "PostgreSQL 인덱스 튜닝 — EXPLAIN ANALYZE로 쿼리 2.3초를 12ms로 줄이는 법"
description: "PostgreSQL에서 느린 쿼리의 실행 계획을 분석하고 복합 인덱스를 설계해 응답 시간을 195배 개선한 실전 사례. Seq Scan, external merge, Index Scan 등 핵심 지표를 읽는 법을 단계별로 정리했다."
excerpt: "1,200만 행 orders 테이블에서 복합 인덱스 하나로 2.3초 풀스캔을 12ms Index Scan으로 전환한 EXPLAIN ANALYZE 해독 가이드"
date: 2026-04-11
category: tech
subcategory: backend
tags: [PostgreSQL, 인덱스, 쿼리튜닝, EXPLAIN, 성능]
---

# PostgreSQL 인덱스 튜닝 — EXPLAIN ANALYZE로 쿼리 2.3초를 12ms로 줄이는 법

**📅 작성일**: 2026년 4월 11일

> [!NOTE]
> :bulb: PostgreSQL의 느린 쿼리는 대부분 인덱스 부재 또는 잘못된 인덱스 설계가 원인이다. 이 글은 1,200만 행짜리 `orders` 테이블에서 평균 2.3초가 걸리던 쿼리를 복합 인덱스 하나로 12ms로 줄인 실전 사례를 다룬다. EXPLAIN ANALYZE의 핵심 지표를 읽는 법부터 컬럼 순서가 인덱스 효율에 미치는 영향까지 단계별로 정리했다.

## 문제의 쿼리

```sql
SELECT *
FROM orders
WHERE user_id = 42
  AND status = 'paid'
ORDER BY created_at DESC
LIMIT 20;
```

단순한 사용자별 주문 조회. 처음에는 빨랐지만 `orders`가 1,200만 행으로 커지면서 응답이 **2.3초**까지 치솟았다. 프로덕션 알림이 울리기 시작했고, 원인 분석이 시급해졌다.

## 1단계: EXPLAIN ANALYZE 실행

`EXPLAIN`은 추정 계획을, `EXPLAIN ANALYZE`는 **실제 실행 후 측정된 시간**을 보여준다.

```sql
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 42 AND status = 'paid'
ORDER BY created_at DESC LIMIT 20;
```

출력:

```
Limit  (cost=0.00..8432.10 rows=20 width=128)
       (actual time=2340.123..2340.125 rows=20 loops=1)
  -> Sort  (cost=0.00..84321.00 rows=2000 width=128)
       Sort Method: external merge  Disk: 48000kB
       ->  Seq Scan on orders  (cost=0.00..234561.00 rows=2000 width=128)
             Filter: (user_id = 42 AND status = 'paid')
             Rows Removed by Filter: 11,998,120
Planning Time: 0.521 ms
Execution Time: 2340.892 ms
```

## 2단계: 핵심 지표 읽기

이 출력에서 세 가지 문제 신호가 동시에 보인다.

### Seq Scan = 풀스캔

```
Seq Scan on orders
  Rows Removed by Filter: 11,998,120
```

인덱스가 없어서 **전체 행을 읽은 뒤 필터**했다. 1,200만 행 중 99.99%를 버리고 나머지만 사용. 완전한 낭비.

### external merge = 메모리 부족 디스크 정렬

```
Sort Method: external merge  Disk: 48000kB
```

`work_mem`(기본 4MB)을 초과해 디스크에서 정렬. 디스크 I/O가 추가로 발생한다.

### Rows Removed by Filter = 필터링 비용

11,998,120 행을 필터링하느라 스캔 시간의 대부분이 소모됐다.

> [!TIP]
> `actual time=X..Y`에서 X는 첫 행 반환 시점, Y는 마지막 행 반환 시점이다. 둘 차이가 크면 "데이터는 있는데 끝까지 스캔"이라는 신호. LIMIT 절과 궁합이 안 맞는 계획을 의심하자.

## 3단계: 인덱스 후보 결정

### 단일 컬럼 인덱스는 충분한가?

```sql
CREATE INDEX idx_orders_user_id ON orders (user_id);
```

이 인덱스는 `user_id = 42`만 가속한다. 하지만 필터 후에도 `status = 'paid'`, ORDER BY, LIMIT 처리가 남는다. 사용자 한 명의 주문이 10만 건이라면 여전히 느리다.

### 복합 인덱스가 정답

WHERE 절의 모든 조건과 ORDER BY까지 한 번에 해결하는 복합 인덱스:

```sql
CREATE INDEX idx_orders_user_status_created
ON orders (user_id, status, created_at DESC);
```

## 4단계: 컬럼 순서 설계

복합 인덱스는 **컬럼 순서가 성능을 결정**한다. 원칙:

1. **등호 비교 컬럼 먼저** (`user_id = 42`, `status = 'paid'`)
2. **범위/정렬 컬럼 나중에** (`ORDER BY created_at DESC`)
3. **카디널리티 높은 컬럼이 앞** (단, 등호 조건이 아니라면)

순서:

```
user_id      (등호, 매우 선택적)
 → status    (등호, 적당히 선택적)
  → created_at DESC (정렬)
```

> [!IMPORTANT]
> `ORDER BY` 컬럼의 정렬 방향(`DESC`)도 인덱스에 명시해야 한다. 안 그러면 정렬이 인덱스로 해결되지 못하고 별도 Sort 노드가 생긴다. PostgreSQL은 **역방향 인덱스 스캔**을 지원하므로 ASC로 만들어도 되지만, 명시가 더 안전하다.

## 5단계: 재측정

```sql
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 42 AND status = 'paid'
ORDER BY created_at DESC LIMIT 20;
```

결과:

```
Limit  (cost=0.56..18.24 rows=20 width=128)
       (actual time=0.034..0.089 rows=20 loops=1)
  ->  Index Scan using idx_orders_user_status_created on orders
        (cost=0.56..1765.40 rows=2000 width=128)
        Index Cond: (user_id = 42 AND status = 'paid')
Planning Time: 0.412 ms
Execution Time: 12.103 ms
```

- **Seq Scan → Index Scan**
- **external merge 제거** (인덱스가 이미 정렬되어 있음)
- **Rows Removed by Filter 제거**

## 실측 Before / After

| 지표 | Before | After | 개선 |
|------|--------|-------|------|
| Execution Time | 2,340ms | 12ms | **195× 빠름** |
| Scan 방식 | Seq Scan | Index Scan | ✓ |
| 정렬 | external merge | 인덱스 순서 활용 | ✓ |
| CPU 사용 | 40% | 2% | 20× 감소 |

## 6단계: 커버링 인덱스 (선택 사항)

`SELECT *` 대신 자주 쓰는 컬럼만 뽑는다면, `INCLUDE`로 커버링 인덱스를 만들면 **테이블 접근 없이** 모든 응답이 인덱스에서 끝난다.

```sql
CREATE INDEX idx_orders_covering
ON orders (user_id, status, created_at DESC)
INCLUDE (total_amount, currency);
```

실행 계획에서 `Index Only Scan`이 뜨면 성공.

## 인덱스가 역효과를 내는 경우

> [!WARNING]
> 인덱스는 **쓰기를 느리게 만든다.** INSERT/UPDATE/DELETE마다 인덱스 갱신 비용이 추가된다. 읽기 비중이 낮고 쓰기가 폭발적인 테이블(로그, 이벤트 큐)에는 최소한의 인덱스만 유지하자. 불필요한 인덱스는 `pg_stat_user_indexes`로 사용 빈도를 모니터링하고 주기적으로 정리한다.

## 주기적 감사

### 느린 쿼리 추적

```sql
CREATE EXTENSION pg_stat_statements;

SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 사용되지 않는 인덱스

```sql
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

`idx_scan = 0`인 인덱스는 삭제 후보. 단, PK와 UNIQUE 제약은 유지.

## 체크리스트

- [ ] EXPLAIN ANALYZE로 실제 실행 계획 확인
- [ ] Seq Scan/external merge/Rows Removed 신호 점검
- [ ] WHERE + ORDER BY를 함께 처리할 복합 인덱스 설계
- [ ] 등호 조건을 앞, 정렬을 뒤로
- [ ] 정렬 방향(DESC) 명시
- [ ] 커버링 인덱스 필요성 검토
- [ ] 쓰기 부하 증가 영향 평가

> [!CAUTION]
> 인덱스 추가 전 반드시 **스테이징 환경에서 테스트**하자. 프로덕션 대용량 테이블에 인덱스를 만들면 수 분 이상 락이 걸릴 수 있다. `CREATE INDEX CONCURRENTLY`를 사용하면 락 없이 생성 가능하지만 **실패 시 invalid 상태가 남는다**. 모니터링 스크립트를 함께 준비하자.

관련 글: 메모리 사용 최적화가 필요하다면 [Node.js 메모리 누수 디버깅 가이드](/posts/tech/backend/nodejs-memory-leak-debugging)를 참고하자.

## 정리

인덱스 튜닝은 직관이 아니라 **측정과 분석의 반복**이다. EXPLAIN ANALYZE 출력의 핵심 지표 세 개(Seq Scan, Rows Removed, Sort Method)만 자신 있게 읽을 수 있어도 대부분의 느린 쿼리를 스스로 해결할 수 있다. 오늘 소개한 복합 인덱스 설계 원칙을 다음 슬로우 쿼리에 바로 적용해 보자. 응답 시간이 두 자릿수 배로 줄어드는 경험을 하게 될 것이다.
