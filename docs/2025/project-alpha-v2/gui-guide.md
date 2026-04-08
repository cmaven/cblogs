---
title: GUI 가이드
description: Backstage 기반 인프라 대시보드 사용법
---

v2에서 새로 추가된 **Backstage 기반 인프라 대시보드** 사용 가이드입니다.

## 접속 방법

```
https://backstage.internal.example.com
```

사내 SSO(Google Workspace)로 자동 로그인됩니다.

## 주요 화면

### 서비스 카탈로그

| 메뉴 | 설명 |
|------|------|
| Services | 전체 마이크로서비스 목록 및 상태 |
| Infrastructure | K8s 클러스터, 노드, 파드 현황 |
| Deployments | ArgoCD 배포 이력 및 동기화 상태 |
| Logs | Loki 기반 실시간 로그 검색 |

### 배포 관리

Backstage에서 직접 ArgoCD 배포를 트리거할 수 있습니다.

1. **Deployments** 메뉴 접속
2. 대상 서비스 선택
3. **Sync** 버튼 클릭
4. 배포 진행 상태 실시간 확인

### 모니터링 대시보드

Grafana 대시보드가 Backstage에 임베드되어 있습니다.

- **Overview**: 전체 시스템 헬스 체크
- **Service Detail**: 개별 서비스 메트릭 (RPS, Latency, Error Rate)
- **Logs**: Loki 로그 검색 및 필터링

## 접근 권한

| 역할 | 권한 |
|------|------|
| Viewer | 서비스 목록, 로그 조회 |
| Editor | 배포 트리거, 설정 변경 |
| Admin | 클러스터 관리, 사용자 관리 |
