---
title: API 가이드
description: Project Alpha v2 API 엔드포인트
---

v1 API를 기반으로, ArgoCD 배포 관련 엔드포인트가 추가되었습니다.

## 인증

v1과 동일하게 Bearer Token 방식을 사용합니다.

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  https://api.internal.example.com/v2/clusters
```

## 엔드포인트 목록

| 메서드 | 경로 | 설명 | 버전 |
|--------|------|------|------|
| GET | /v2/clusters | 클러스터 목록 | v1+ |
| POST | /v2/clusters | 클러스터 생성 | v1+ |
| DELETE | /v2/clusters/:id | 클러스터 삭제 | v1+ |
| GET | /v2/deployments | ArgoCD 배포 목록 | **v2 신규** |
| POST | /v2/deployments/sync | 배포 동기화 | **v2 신규** |
| GET | /v2/mesh/status | Istio 메시 상태 | **v2 신규** |

## 신규 API: 배포 동기화

```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"app": "service-a", "revision": "main"}' \
  https://api.internal.example.com/v2/deployments/sync
```

응답:

```json
{
  "status": "syncing",
  "app": "service-a",
  "targetRevision": "main",
  "syncStartedAt": "2025-07-15T10:30:00Z"
}
```
