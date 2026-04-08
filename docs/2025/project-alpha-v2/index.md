---
title: Project Alpha 개요
description: 클라우드 인프라 자동화 프로젝트 v2
---

v1의 핵심 인프라 자동화를 기반으로, **서비스 메시**, **GitOps**, **통합 로깅**을 추가한 버전입니다.

## 프로젝트 목표

클라우드 인프라 프로비저닝 자동화에 더해, 운영 자동화와 관측성(Observability)을 강화합니다.

- 배포 시간 50% 단축 (v1 달성) → **배포 롤백 시간 90% 단축** (v2 목표)
- **장애 감지 시간 5분 이내** (v2 신규)
- **서비스 간 mTLS 통신** (v2 신규)

## 기술 스택

| 구성요소 | v1 | v2 |
|----------|----|----|
| IaC | Terraform v1.8 | **OpenTofu v1.9** |
| CI/CD | GitHub Actions | GitHub Actions + **ArgoCD** |
| 컨테이너 | Docker + Kubernetes | Docker + Kubernetes + **Istio** |
| 모니터링 | Prometheus + Grafana | Prometheus + Grafana + **Loki** |
| GUI | - | **Backstage 대시보드** |

## 주요 마일스톤

- **Q1**: OpenTofu 마이그레이션 + ArgoCD 도입
- **Q2**: Istio 서비스 메시 적용
- **Q3**: Loki 로깅 통합 + Backstage GUI
- **Q4**: 전체 운영 안정화 및 문서화
