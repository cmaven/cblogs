---
title: 아키텍처
description: Project Alpha v2 시스템 아키텍처
---

v1 아키텍처에 서비스 메시와 GitOps 레이어를 추가한 구조입니다.

## 시스템 구성도

```mermaid
graph TB
    Dev[개발자] --> Git[GitHub]
    Git --> ArgoCD[ArgoCD]
    ArgoCD --> K8s[Kubernetes Cluster]
    K8s --> Istio[Istio Service Mesh]
    Istio --> SvcA[Service A]
    Istio --> SvcB[Service B]
    SvcA --> Prom[Prometheus]
    SvcB --> Prom
    SvcA --> Loki[Loki]
    SvcB --> Loki
    Prom --> Grafana[Grafana]
    Loki --> Grafana
    Grafana --> Backstage[Backstage GUI]
```

## v1 대비 변경 사항

| 레이어 | v1 | v2 추가 |
|--------|-----|---------|
| 배포 | GitHub Actions 직접 배포 | ArgoCD GitOps 선언적 배포 |
| 네트워크 | K8s 기본 네트워크 | Istio mTLS + 트래픽 관리 |
| 로깅 | 없음 | Loki 중앙 집중 로깅 |
| GUI | 없음 | Backstage 개발자 포탈 |
