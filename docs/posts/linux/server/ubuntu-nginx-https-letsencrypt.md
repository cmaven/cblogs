---
title: "Ubuntu 24.04 nginx HTTPS 설정 — Let's Encrypt 자동 갱신까지 10분 완성"
description: "Ubuntu 24.04 서버에 nginx와 Let's Encrypt 무료 SSL을 적용하고, certbot으로 인증서 자동 갱신을 설정하는 전체 절차. 실제 프로덕션에서 바로 적용 가능한 nginx.conf 예제 포함."
excerpt: "certbot --nginx 한 줄로 HTTPS 전환, 자동 갱신 cron 타이머 검증까지 — 실패 없이 첫 시도에 성공하는 체크리스트"
date: 2026-04-16
category: linux
subcategory: server
tags: [Ubuntu, nginx, HTTPS, LetsEncrypt, certbot, SSL]
---

# Ubuntu 24.04 nginx HTTPS 설정 — Let's Encrypt 자동 갱신까지 10분 완성

**📅 작성일**: 2026년 4월 16일

> [!NOTE]
> :bulb: Ubuntu 24.04 서버에 nginx와 Let's Encrypt 무료 SSL 인증서를 적용하는 완전한 절차를 정리한다. HTTP에서 HTTPS로 전환, 인증서 자동 갱신, A+ 등급 보안 설정까지 포함한다. 이 글은 실제 프로덕션 서버 구축 시 체크리스트로 바로 활용할 수 있다.

## 사전 준비물 확인

설정 전 아래 3가지가 준비되어야 한다. 하나라도 빠지면 certbot 발급이 실패한다.

| 항목 | 확인 방법 |
|------|----------|
| 도메인 A 레코드 | `dig example.com`으로 서버 IP 확인 |
| 80/443 포트 개방 | `sudo ufw status` + 보안 그룹 인바운드 |
| sudo 권한 | 일반 사용자로 sudo 사용 가능 |

도메인 전파에는 최대 48시간 걸릴 수 있으나 보통 10분 내 반영된다.

> [!TIP]
> `dig +short example.com`으로 A 레코드를 빠르게 확인할 수 있다. 서버 공인 IP와 일치해야 certbot 발급이 진행된다.

## 1단계: nginx 설치 및 기본 설정

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

방화벽 허용:

```bash
sudo ufw allow 'Nginx Full'  # 80, 443 모두 열림
sudo ufw reload
```

`http://your-domain.com`에 접속하여 기본 nginx 페이지가 보이는지 확인. 안 보이면 DNS 또는 방화벽 문제.

## 2단계: 가상 호스트 설정

`/etc/nginx/sites-available/example.com` 파일 생성:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    root /var/www/example.com;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

활성화:

```bash
sudo ln -s /etc/nginx/sites-available/example.com /etc/nginx/sites-enabled/
sudo nginx -t     # 문법 검사
sudo systemctl reload nginx
```

`nginx -t`가 `syntax is ok` 반환해야만 reload 한다.

## 3단계: certbot으로 Let's Encrypt 인증서 발급

Ubuntu 24.04는 `snap` 기반 설치가 권장된다.

```bash
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

nginx 자동 설정 모드로 발급:

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

대화식 프롬프트가 뜬다:
- 이메일 입력 (갱신 실패 시 알림용)
- 이용약관 동의
- 뉴스레터 구독 여부
- **HTTP→HTTPS 리다이렉트 여부** → `2` (redirect) 선택 권장

성공 시 `Congratulations!`와 함께 `/etc/letsencrypt/live/example.com/` 경로에 인증서가 저장된다.

> [!IMPORTANT]
> HTTP→HTTPS 리다이렉트는 **반드시 활성화**하자. 혼합 콘텐츠(HTTP/HTTPS) 상태는 SEO 페널티와 보안 경고로 이어진다. 선택 단계에서 `2` (redirect)를 고르면 nginx 설정에 301 리다이렉트가 자동 추가된다.

## 4단계: 보안 강화 설정

certbot이 만든 기본 설정은 작동하지만, A+ 등급을 받으려면 추가 설정이 필요하다.

`/etc/nginx/sites-available/example.com` 편집:

```nginx
server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # TLS 1.2/1.3만 허용
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # HSTS (HTTPS 강제)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 기타 보안 헤더
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    root /var/www/example.com;
    index index.html;
    location / { try_files $uri $uri/ =404; }
}
```

적용:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

[SSL Labs](https://www.ssllabs.com/ssltest/)에서 **A+ 등급** 확인.

> [!WARNING]
> `Strict-Transport-Security`에 `max-age=31536000`(1년)을 지정하면 **브라우저가 1년간 HTTPS만 시도한다.** 도메인 소유권을 잃거나 인증서 갱신이 장기간 실패하면 사이트 접속이 아예 불가해진다. 운영 중 도메인에 적용할 땐 `max-age`를 짧게 시작해 점진적으로 늘릴 것.

## 5단계: 자동 갱신 검증

snap 버전 certbot은 **systemd timer**로 자동 갱신이 이미 설정돼 있다. 확인만 하면 된다.

```bash
systemctl list-timers | grep certbot
```

실제 갱신 시뮬레이션(드라이런):

```bash
sudo certbot renew --dry-run
```

`Congratulations, all simulated renewals succeeded` 출력돼야 정상.

갱신 후 nginx를 reload 해야 새 인증서가 적용된다. certbot이 자동 hook으로 처리하지만, 안전장치로 `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`를 만들어두자:

```bash
#!/bin/bash
systemctl reload nginx
```

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

## 자주 만나는 문제 3가지

| 증상 | 원인 | 해결 |
|------|------|------|
| `Connection refused` (80) | 방화벽/보안그룹 | `ufw allow 80`, 인바운드 규칙 확인 |
| `DNS problem: NXDOMAIN` | 도메인 미전파 | `dig`로 A 레코드 확인, 10분~48시간 대기 |
| `too many certificates` | rate limit 초과 | 주당 5회 제한, `--staging` 플래그로 테스트 |

> [!CAUTION]
> Let's Encrypt는 **동일 도메인당 주 5건, 실패 요청당 시간당 5건**의 rate limit을 건다. 테스트 단계에서 실패가 반복되면 7일간 발급이 완전히 차단된다. 실제 발급 전엔 반드시 `certbot --staging`으로 먼저 시뮬레이션하자.

## 정리 체크리스트

- [ ] 도메인 A 레코드 서버 IP 가리킴
- [ ] 80, 443 포트 방화벽·보안그룹 개방
- [ ] `nginx -t` 통과
- [ ] `certbot --nginx` 성공 (`Congratulations!`)
- [ ] HTTPS 리다이렉트 동작
- [ ] SSL Labs A+ 등급
- [ ] `certbot renew --dry-run` 성공
- [ ] `systemd timer` 활성화

관련 글: SSH 접근 보안도 함께 점검하자 → [SSH 키 로테이션 자동화 — 연 1회 보안 위생](/posts/linux/server/ssh-key-rotation).

:bulb: **핵심**: Ubuntu 24.04 + snap 기반 certbot은 자동 갱신이 기본이다. 수동 cron을 만드는 예전 튜토리얼은 더 이상 따라 하지 말 것.
