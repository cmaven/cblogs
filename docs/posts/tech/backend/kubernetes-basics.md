---
title: "Kubernetes 핵심 개념 입문"
date: 2026-03-10
category: tech
subcategory: backend
excerpt: "Kubernetes의 핵심 개념인 Pod, Service, Deployment를 실전 예제로 이해합니다."
tags: [kubernetes, devops, container, k8s]
---

# Kubernetes 핵심 개념 입문

## 왜 Kubernetes인가?

Docker만으로는 여러 컨테이너의 배포, 스케일링, 장애 복구를 수동으로 관리해야 합니다. Kubernetes는 이를 자동화합니다.

## 핵심 리소스

### Pod

컨테이너의 최소 실행 단위입니다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  containers:
    - name: app
      image: my-app:1.0
      ports:
        - containerPort: 3000
```

### Deployment

Pod의 배포와 스케일링을 관리합니다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: my-app:1.0
          ports:
            - containerPort: 3000
```

### Service

Pod에 안정적인 네트워크 접점을 제공합니다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-svc
spec:
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
```

## 자주 쓰는 명령어

| 명령어 | 설명 |
|--------|------|
| `kubectl get pods` | Pod 목록 |
| `kubectl describe pod <name>` | Pod 상세 |
| `kubectl logs <pod>` | 로그 확인 |
| `kubectl scale deployment <name> --replicas=5` | 스케일링 |
| `kubectl rollout status deployment <name>` | 배포 상태 |

Kubernetes는 학습 곡선이 있지만, 프로덕션 운영에서는 필수적인 도구입니다.
