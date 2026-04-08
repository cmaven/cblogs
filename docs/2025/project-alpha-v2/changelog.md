---
title: 변경 이력
description: Project Alpha 버전별 변경 이력
---

## v2.0.0 (2025-Q3)

### 추가
- Istio 서비스 메시 도입
- ArgoCD GitOps 파이프라인
- Loki 로그 수집 통합
- **Backstage GUI 대시보드** (신규 섹션: GUI 가이드)
- 배포 동기화 API (`/v2/deployments/sync`)
- 메시 상태 API (`/v2/mesh/status`)

### 변경
- Terraform → OpenTofu 전환
- API 버전 v1 → v2 (하위 호환)
- K8s 클러스터 업그레이드 (1.28 → 1.30)

### 제거
- 레거시 Jenkins 파이프라인

## v1.0.0 (2025-Q1)

- 초기 릴리스
- Terraform + GitHub Actions 기반 인프라 자동화
- Prometheus + Grafana 모니터링
- REST API v1 (clusters CRUD)
