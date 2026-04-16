<!-- ssh-key-rotation.md: SSH ed25519 키 로테이션 완전 가이드 | 수정일: 2026-04-16 -->
---
title: "SSH 키 로테이션 완전 가이드 — ed25519 생성·등록·검증·폐기 자동화"
description: "ed25519 SSH 키를 연 1회 안전하게 교체하는 전체 절차. 신규 키 생성부터 서버 등록, 접속 검증, 기존 키 폐기, cron 알림 자동화까지 — 중간 차단 없이 무중단으로 로테이션하는 체크리스트 완전 가이드."
excerpt: "기존 키를 살린 채 신규 키를 등록하고 검증 후 교체 — 잠금 위험 없는 SSH 키 로테이션 안전 절차"
date: 2026-03-30
category: linux
subcategory: server
tags: [SSH, 보안, 키관리, ed25519, sysadmin, 키로테이션, authorized_keys, 자동화]
---

# SSH 키 로테이션 완전 가이드 — ed25519 생성·등록·검증·폐기 자동화

**📅 작성일**: 2026년 3월 30일

> [!NOTE]
> :bulb: SSH 키는 유효기간이 없는 정적 크리덴셜이다. 한 번 유출되면 무기한 재사용될 수 있으므로 연 1회 교체가 필수 보안 위생이다. 이 글은 ed25519 키 생성·서버 등록·접속 검증·기존 키 폐기·cron 알림 자동화까지 중단 없이 안전하게 로테이션하는 전체 절차를 다룬다.

## 왜 SSH 키 로테이션이 필요한가

SSH 비밀번호 인증을 키 인증으로 전환한 뒤, 많은 관리자가 "이제 안전하다"고 안심한다. 그러나 키 인증에는 치명적인 특성이 있다.

**SSH 키는 만료되지 않는다.** 한번 생성한 키 쌍은 명시적으로 폐기하지 않는 한 영원히 유효하다. 다음 시나리오를 생각해보자:

- 퇴사한 직원의 개인 노트북에 비공개 키가 남아있다
- 3년 전 개발 서버에서 유출된 키가 아직 `authorized_keys`에 등록되어 있다
- 백업 아카이브에 포함된 `.ssh/` 디렉터리가 외부에 노출됐다

이런 경우 비밀번호 재설정처럼 즉각적인 차단이 없다. **연 1회 키 로테이션은 이 구멍을 닫는 가장 직접적인 수단**이다.

| 인증 방식 | 유효기간 | 유출 시 대응 |
|----------|----------|------------|
| 비밀번호 | 정책 설정 가능 | 즉시 변경 |
| SSH 키 (미로테이션) | **무기한** | 유출 인지 불가 |
| SSH 키 (연 1회 로테이션) | 실질적 1년 | 이전 키 자동 무효화 |
| 하드웨어 키 (YubiKey) | 물리 보안 | 키 분리로 즉시 차단 |

> [!TIP]
> ed25519는 RSA 4096 대비 키 길이가 짧고 서명 속도가 빠르며, 타원곡선 암호화 특성상 동일한 보안 수준에서 더 효율적이다. 2024년 이후 신규 키는 모두 ed25519로 생성할 것을 권장한다. RSA 2048은 이미 취약점 우려가 있으며, RSA 4096도 ed25519 대비 실질적 이점이 없다.

## 사전 준비물 확인

로테이션 전 아래 사항을 반드시 확인한다. 특히 **콘솔/VNC 접근 경로** 확보가 핵심이다.

| 확인 항목 | 이유 |
|----------|------|
| 서버 콘솔/VNC 접근 가능 여부 | SSH 완전 차단 시 복구 경로 |
| 현재 `~/.ssh/authorized_keys` 백업 | 실수로 삭제 시 복구용 |
| 로컬 기존 키 파일 위치 확인 | `~/.ssh/id_ed25519` 등 |
| 패스프레이즈(암호구문) 관리 도구 | 1Password, Bitwarden 등 |
| 대상 서버 목록 정리 | 다중 서버 시 누락 방지 |

> [!IMPORTANT]
> 로테이션 중 가장 위험한 순간은 **기존 키를 먼저 제거한 뒤 신규 키 등록에 실패하는 경우**다. 이 절차에서는 신규 키 접속 검증이 완전히 완료되기 전까지 기존 키를 절대 제거하지 않는다. 콘솔 접근이 불가능한 VPS나 클라우드 인스턴스는 반드시 웹 콘솔(AWS EC2 Serial Console, GCP Cloud Shell 등)을 먼저 확인하자.

## 1단계: 신규 ed25519 키 생성

로컬 머신에서 실행한다. 키 파일명에 연도를 포함시켜 관리 편의성을 높인다.

```bash
# 키 파일명에 연도 포함 — 예: id_ed25519_2026
ssh-keygen -t ed25519 \
  -C "user@hostname-2026" \
  -f ~/.ssh/id_ed25519_2026
```

실행 시 두 가지를 입력한다:

1. **패스프레이즈(암호구문)**: 반드시 설정. 비밀 키 파일이 유출되어도 패스프레이즈 없이는 사용 불가
2. 확인용 재입력

```
Generating public/private ed25519 key pair.
Enter passphrase (empty for no passphrase): [강력한 암호구문 입력]
Enter same passphrase again:
Your identification has been saved in /home/user/.ssh/id_ed25519_2026
Your public key has been saved in /home/user/.ssh/id_ed25519_2026.pub
The key fingerprint is:
SHA256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx user@hostname-2026
```

생성된 키 확인:

```bash
# 공개키 확인 (서버에 등록할 내용)
cat ~/.ssh/id_ed25519_2026.pub

# 지문 확인 (등록 후 검증용으로 기록해두자)
ssh-keygen -lf ~/.ssh/id_ed25519_2026.pub
```

## 2단계: 서버에 신규 키 등록 (기존 키 유지)

**핵심 원칙**: 기존 키를 제거하지 않고 신규 키를 추가한다. 이 시점부터 두 키 모두 접속 가능 상태가 된다.

### 방법 A: ssh-copy-id 사용 (권장)

```bash
# 기존 키로 인증해서 신규 공개키를 서버에 추가
ssh-copy-id -i ~/.ssh/id_ed25519_2026.pub user@server
```

`ssh-copy-id`는 자동으로 `~/.ssh/authorized_keys`에 공개키를 append하며, 권한(600)도 올바르게 설정한다.

### 방법 B: 수동 등록

`ssh-copy-id`가 없는 환경이나 점프 호스트를 거치는 경우:

```bash
# 로컬에서 공개키 내용을 파이프로 서버에 전달
cat ~/.ssh/id_ed25519_2026.pub | ssh user@server \
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && \
   cat >> ~/.ssh/authorized_keys && \
   chmod 600 ~/.ssh/authorized_keys"
```

### 다중 서버 등록

```bash
# 서버 목록 파일로 일괄 등록
servers=("server1.example.com" "server2.example.com" "server3.example.com")

for srv in "${servers[@]}"; do
  echo "등록 중: $srv"
  ssh-copy-id -i ~/.ssh/id_ed25519_2026.pub "user@${srv}"
done
```

## 3단계: 신규 키로 접속 검증

등록 직후 반드시 검증한다. 기존 SSH 세션을 열어둔 채 **새 터미널**에서 테스트한다.

```bash
# 신규 키를 명시적으로 지정해서 접속
ssh -i ~/.ssh/id_ed25519_2026 user@server 'echo "접속 성공: $(hostname)"'
```

성공 시 출력:

```
접속 성공: myserver
```

### `~/.ssh/config`에 신규 키 등록

검증이 완료되면 SSH 설정 파일을 업데이트한다:

```
# ~/.ssh/config
Host myserver
    HostName server.example.com
    User user
    IdentityFile ~/.ssh/id_ed25519_2026
    IdentitiesOnly yes
```

`IdentitiesOnly yes`는 지정한 키만 사용하도록 강제한다. 에이전트에 여러 키가 로드된 경우 의도치 않은 키로 인증되는 것을 방지한다.

```bash
# config 반영 후 재테스트 (키 파일 명시 없이 접속)
ssh myserver 'echo "config 기반 접속 성공"'
```

## 4단계: 기존 키 폐기

신규 키로 **모든 대상 서버 접속이 확인된 후**에만 진행한다.

### 서버에서 기존 공개키 제거

```bash
# 기존 공개키의 내용 확인 (로컬에서)
cat ~/.ssh/id_ed25519.pub  # 기존 공개키

# 서버에서 해당 키 줄을 삭제
ssh -i ~/.ssh/id_ed25519_2026 user@server \
  "grep -v 'user@hostname-이전연도' ~/.ssh/authorized_keys > /tmp/ak_new && \
   mv /tmp/ak_new ~/.ssh/authorized_keys && \
   chmod 600 ~/.ssh/authorized_keys"

# 제거 후 authorized_keys 확인
ssh user@server 'cat ~/.ssh/authorized_keys'
```

키 코멘트(`-C` 옵션으로 지정한 값)를 활용하면 정확한 줄을 특정할 수 있다.

### 로컬에서 기존 키 파일 처리

```bash
# 기존 키 파일을 백업 위치로 이동 (즉시 삭제보다 이동이 안전)
mv ~/.ssh/id_ed25519 ~/.ssh/archive/id_ed25519_2025
mv ~/.ssh/id_ed25519.pub ~/.ssh/archive/id_ed25519_2025.pub

# 아카이브 디렉터리 권한 설정
chmod 700 ~/.ssh/archive
```

> [!CAUTION]
> 기존 키 파일을 로컬에서 바로 삭제하지 말자. 일정 기간(최소 1개월) 아카이브 디렉터리에 보관했다가 확실히 문제가 없음을 확인한 후 삭제한다. 기존 키가 다른 서버나 서비스(GitHub, GitLab, Bitbucket 등)에도 등록되어 있을 수 있으므로, 삭제 전 전체 사용처를 점검해야 한다.

### GitHub/GitLab 등 외부 서비스 키 갱신

SSH 키를 Git 호스팅 서비스에도 등록한 경우 함께 교체한다:

```bash
# GitHub 새 키 등록 (gh CLI 사용)
gh ssh-key add ~/.ssh/id_ed25519_2026.pub --title "workstation-2026"

# 기존 키 목록 확인 및 제거
gh ssh-key list
gh ssh-key delete <KEY_ID>
```

## 5단계: ssh-agent로 패스프레이즈 관리

패스프레이즈를 설정했다면 매번 입력하는 번거로움을 `ssh-agent`로 해결한다.

```bash
# ssh-agent 시작 및 키 추가
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519_2026

# 현재 에이전트에 등록된 키 확인
ssh-add -l
```

로그인 셸에서 자동으로 에이전트를 시작하려면 `~/.bashrc` 또는 `~/.zshrc`에 추가:

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
if [ -z "$SSH_AUTH_SOCK" ]; then
  eval "$(ssh-agent -s)" > /dev/null
  ssh-add ~/.ssh/id_ed25519_2026 2>/dev/null
fi
```

macOS는 Keychain 연동으로 재부팅 후에도 패스프레이즈를 기억한다:

```bash
# macOS: Keychain에 저장
ssh-add --apple-use-keychain ~/.ssh/id_ed25519_2026
```

## 6단계: 연 1회 알림 자동화

SSH 키 로테이션은 자동화하기 어렵다. 검증 단계가 반드시 수동으로 이루어져야 하기 때문이다. 대신 **알림을 자동화**하여 잊지 않도록 한다.

```bash
# /usr/local/bin/ssh-rotate-reminder.sh
#!/bin/bash
# ============================================================
# ssh-rotate-reminder.sh: SSH 키 로테이션 알림 스크립트
# 생성일: 2026-03-30 | 수정일: 2026-04-16
# ============================================================

YEAR=$(date +%Y)
RECIPIENT="admin@example.com"
SUBJECT="[보안 위생] SSH 키 로테이션 필요 — ${YEAR}년"
BODY="연 1회 SSH 키 로테이션 시기입니다.

절차: https://your-wiki/ssh-key-rotation

현재 등록된 키 목록:
$(cat ~/.ssh/authorized_keys | awk '{print $3}')

완료 후 이 스크립트의 cron을 내년으로 갱신하세요."

echo "$BODY" | mail -s "$SUBJECT" "$RECIPIENT"
echo "[$(date)] SSH 로테이션 알림 발송 완료" >> /var/log/ssh-rotate.log
```

```bash
sudo chmod +x /usr/local/bin/ssh-rotate-reminder.sh
```

crontab 등록:

```bash
# crontab -e
# 매년 4월 1일 오전 9시 알림 발송
0 9 1 4 * /usr/local/bin/ssh-rotate-reminder.sh
```

> [!WARNING]
> 키 로테이션 자체를 완전 자동화하는 스크립트를 작성하는 것은 권장하지 않는다. 자동 스크립트가 검증 단계 없이 기존 키를 제거하면 서버 접속이 영구 차단될 수 있다. 특히 클라우드 인스턴스에서 콘솔 접근이 제한된 경우 복구 비용이 매우 크다. **알림만 자동화하고, 실제 교체는 반드시 수동으로 진행**하자.

## 관련 글

- [Ubuntu 24.04 nginx HTTPS 설정 — Let's Encrypt 자동 갱신까지 10분 완성](/posts/linux/server/ubuntu-nginx-https-letsencrypt): 서버 보안 강화의 다른 축인 HTTPS 설정도 함께 점검하자.

## 정리

SSH 키 로테이션의 안전한 순서를 다시 한번 확인한다:

- [ ] 콘솔/VNC 등 비상 접근 경로 확보
- [ ] 현재 `authorized_keys` 백업
- [ ] `ssh-keygen -t ed25519 -C "user@host-연도"` 신규 키 생성 (패스프레이즈 필수)
- [ ] 공개키 지문 별도 기록 (검증용)
- [ ] `ssh-copy-id`로 서버에 신규 키 추가 (기존 키 유지)
- [ ] 신규 키로 접속 검증: `ssh -i ~/.ssh/id_ed25519_new user@server 'echo OK'`
- [ ] `~/.ssh/config` 업데이트 후 재검증
- [ ] 다중 서버 모두 검증 완료 확인
- [ ] 서버 `authorized_keys`에서 기존 키 제거
- [ ] GitHub/GitLab 등 외부 서비스 키도 교체
- [ ] 로컬 기존 키 파일 아카이브 이동 (즉시 삭제 금지)
- [ ] cron 알림 내년으로 갱신

:bulb: **핵심**: 기존 키 제거는 반드시 신규 키 접속 검증 **이후**에 한다. 이 순서만 지키면 로테이션 중 서버 차단 위험은 거의 없다.
