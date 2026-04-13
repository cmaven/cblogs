---
title: "데이터베이스 인덱싱 전략 가이드"
date: 2026-03-20
category: tech
subcategory: backend
excerpt: "데이터베이스 쿼리 성능을 극대화하는 인덱싱 전략과 주의사항을 실전 예제로 설명합니다."
tags: [database, indexing, performance, sql]
---

# 데이터베이스 인덱싱 전략 가이드

## 인덱스가 필요한 이유

인덱스 없이 1000만 건 테이블에서 조회하면 풀 테이블 스캔이 발생합니다. 적절한 인덱스로 O(n) → O(log n)으로 개선할 수 있습니다.

## 인덱스 유형

### B-Tree 인덱스 (기본)

```sql
-- 단일 컬럼 인덱스
CREATE INDEX idx_users_email ON users(email);

-- 복합 인덱스 (순서 중요!)
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);
```

### 커버링 인덱스

쿼리에 필요한 모든 컬럼이 인덱스에 포함되면 테이블 접근 없이 인덱스만으로 응답합니다.

```sql
-- 이 쿼리는 인덱스만으로 응답 가능
CREATE INDEX idx_covering ON orders(user_id, status, total_amount);
SELECT status, total_amount FROM orders WHERE user_id = 123;
```

## 복합 인덱스 설계 원칙

1. **등호 조건 컬럼을 앞에** 배치
2. **범위 조건 컬럼을 뒤에** 배치
3. **카디널리티가 높은 컬럼**을 우선

```sql
-- 좋은 예: 등호(user_id) → 범위(created_at)
CREATE INDEX idx_good ON orders(user_id, created_at);

-- 나쁜 예: 범위(created_at) → 등호(user_id)
CREATE INDEX idx_bad ON orders(created_at, user_id);
```

## 인덱스 안티패턴

| 안티패턴 | 설명 |
|---------|------|
| 과도한 인덱스 | INSERT/UPDATE 성능 저하 |
| 함수 래핑 | `WHERE UPPER(email)` → 인덱스 미사용 |
| 와일드카드 선행 | `LIKE '%검색어'` → 풀 스캔 |
| NULL 비교 | `IS NULL` 인덱스 활용 제한적 |

인덱스는 만능이 아닙니다. `EXPLAIN` 실행 계획을 확인하는 습관을 들이세요.
