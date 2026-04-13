---
title: "개발자를 위한 생산성 도구 모음"
date: 2026-04-01
category: life
subcategory: productivity
excerpt: "개발 생산성을 높여주는 도구와 환경 설정 팁을 소개합니다."
tags: [productivity, tools, workflow]
---

# 개발자를 위한 생산성 도구 모음

## 터미널 환경

### Zsh + Oh My Zsh

기본 Bash 대신 Zsh를 사용하면 자동완성, 테마, 플러그인 등 다양한 기능을 활용할 수 있습니다.

추천 플러그인:
- **zsh-autosuggestions**: 이전 명령어 기반 자동 제안
- **zsh-syntax-highlighting**: 명령어 구문 강조
- **z**: 자주 방문하는 디렉토리로 빠르게 이동

### tmux

터미널 멀티플렉서로, 여러 세션을 관리하고 SSH 연결이 끊겨도 작업이 유지됩니다.

```bash
# 새 세션
tmux new -s work

# 분할
Ctrl+b %    # 수평 분할
Ctrl+b "    # 수직 분할
```

## 에디터 설정

### VS Code 필수 확장

| 확장 | 용도 |
|------|------|
| GitLens | Git 히스토리 시각화 |
| Error Lens | 에러를 인라인으로 표시 |
| Thunder Client | API 테스트 |
| Todo Tree | TODO 주석 관리 |

## CLI 도구

- **fzf**: 퍼지 검색
- **ripgrep (rg)**: 초고속 텍스트 검색
- **jq**: JSON 처리
- **httpie**: 직관적인 HTTP 클라이언트
- **lazygit**: 터미널 Git UI

## 자동화 팁

1. **dotfiles 관리**: 설정 파일을 Git으로 관리하면 어디서든 동일한 환경을 구축할 수 있습니다
2. **Makefile 활용**: 반복 명령어를 `make dev`, `make deploy` 등으로 단순화
3. **Git hooks**: 커밋 전 린트, 테스트 자동 실행

좋은 도구를 잘 설정해두면 일상적인 작업에서 큰 시간을 절약할 수 있습니다.
