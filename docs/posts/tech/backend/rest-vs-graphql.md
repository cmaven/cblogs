---
title: "REST vs GraphQL: 언제 무엇을 써야 할까"
date: 2026-04-03
category: tech
subcategory: backend
excerpt: "REST와 GraphQL의 장단점을 비교하고, 프로젝트 특성에 맞는 API 설계 방식을 안내합니다."
tags: [api, rest, graphql, backend]
---

# REST vs GraphQL: 언제 무엇을 써야 할까

## REST API

REST는 리소스 중심의 API 설계 방식입니다.

```
GET    /api/users          사용자 목록
GET    /api/users/1        사용자 상세
POST   /api/users          사용자 생성
PUT    /api/users/1        사용자 수정
DELETE /api/users/1        사용자 삭제
```

### 장점
- 단순하고 직관적
- HTTP 캐싱 활용 용이
- 브라우저에서 직접 테스트 가능

### 단점
- Over-fetching / Under-fetching
- 복잡한 관계 데이터 조회 시 다중 요청 필요

## GraphQL

단일 엔드포인트에서 필요한 데이터만 요청합니다.

```graphql
query {
  user(id: 1) {
    name
    email
    posts {
      title
      createdAt
    }
  }
}
```

### 장점
- 필요한 데이터만 정확히 요청
- 단일 요청으로 관계 데이터 조회
- 강타입 스키마

### 단점
- 캐싱 복잡도 증가
- 파일 업로드 처리가 번거로움
- 학습 곡선

## 선택 가이드

| 상황 | 추천 |
|------|------|
| CRUD 중심 서비스 | REST |
| 복잡한 관계 데이터 | GraphQL |
| 모바일 + 웹 동시 지원 | GraphQL |
| 공개 API | REST |
| 마이크로서비스 간 통신 | REST / gRPC |
