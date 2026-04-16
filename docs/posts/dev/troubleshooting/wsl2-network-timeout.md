---
title: "WSL2 VPN 연결 시 네트워크 타임아웃 완벽 해결 — MTU 설정 한 줄로 끝내기"
description: "Windows에서 사내 VPN에 접속하면 WSL2 Ubuntu의 apt, git, npm이 모두 멈추는 현상은 MTU 불일치가 원인이다. 임시 조치부터 wsl.conf 영구 설정까지, 재부팅 후에도 유지되는 완전한 해결 절차를 정리했다."
excerpt: "eth0 MTU를 1280으로 낮추면 VPN 터널링 환경에서도 패킷 손실 없이 통신 가능 — 실측 재현 사례 포함"
date: 2026-04-04
category: dev
subcategory: troubleshooting
tags: [WSL2, VPN, MTU, 네트워크, 트러블슈팅, Windows]
---

# WSL2 VPN 연결 시 네트워크 타임아웃 완벽 해결 — MTU 설정 한 줄로 끝내기

**📅 작성일**: 2026년 4월 4일

> [!NOTE]
> :bulb: Windows에서 사내 VPN에 연결한 순간부터 WSL2 Ubuntu 내부의 `apt update`, `git pull`, `npm install`이 무한 대기 상태로 빠진다면 높은 확률로 **MTU 불일치** 문제다. 로컬에서는 `ping`이 되는데 HTTPS가 타임아웃된다는 특유의 증상이 핵심 단서다. 이 글은 원인 추적 과정, 임시 조치, `wsl.conf`를 통한 영구 설정까지 재부팅 후에도 유지되는 완전한 해결 절차를 정리한다.

## 증상 — 정확히 이런 상태라면 이 글이 맞다

| 상황 | 결과 |
|------|------|
| Windows VPN 연결 전 | WSL2 정상 |
| Windows VPN 연결 후 | WSL2 네트워크 이상 |
| `ping 8.8.8.8` | 응답 있음 |
| `curl https://google.com` | **무한 대기** |
| `apt update` | **멈춤** |
| `git pull` | **멈춤** |
| Windows 브라우저 | **정상 접속** |

Windows는 멀쩡한데 WSL2만 멈춘다. 작은 패킷(ping, TCP 핸드셰이크)은 되지만 큰 패킷이 실패한다는 것이 핵심 특징.

## 원인 — MTU(Maximum Transmission Unit) 불일치

### 네트워크 기본 이해

MTU는 **한 번에 보낼 수 있는 최대 패킷 크기**다. 이더넷 기본값은 **1500바이트**.

```
┌─────────────────────────────────────┐
│  Ethernet 헤더 │  IP/TCP  │  데이터 │
│     14B       │    40B   │  1446B  │  ← 총 1500B
└─────────────────────────────────────┘
```

### VPN의 영향

VPN은 **패킷을 암호화해 다시 한 번 더 감싼다 (터널링)**.

```
┌───────────────────────────────────────────┐
│ 외부 헤더 │ VPN 암호화 │ 원본 1500B 패킷 │  ← 1500B 초과 발생
└───────────────────────────────────────────┘
```

이 "터널 헤더"가 추가되어 실제 사용 가능한 MTU가 **1500 미만**이 된다. 원본 패킷이 그대로 1500B이면 라우터가 "이 패킷 너무 크다"고 버리거나, 단편화가 실패해 **ICMP 'Packet too big'** 메시지가 차단되면 영원히 대기한다.

> [!TIP]
> Windows 측에서는 VPN 클라이언트가 자동으로 MTU를 조정하므로 문제가 안 보인다. WSL2는 Windows 네트워크 위에 가상 NIC를 얹어 쓰기 때문에 **VPN의 MTU 변경을 상속받지 못한다**. 이것이 WSL2만 먹통이 되는 진짜 이유다.

## 진단 — MTU가 원인인지 확인

### 테스트 1: 크기별 핑

```bash
# ping 기본 패킷 크기 (약 64B)
ping -c 2 google.com                   # 정상

# 1200B 패킷
ping -c 2 -M do -s 1200 google.com     # 보통 정상

# 1400B 패킷
ping -c 2 -M do -s 1400 google.com     # 실패하면 MTU 문제 확정
```

`-M do`는 "단편화 금지" 플래그. 큰 패킷이 실패하면 MTU 불일치가 확정.

### 테스트 2: 현재 MTU 확인

```bash
ip link show eth0 | grep mtu
# mtu 1500  ← 기본값, VPN 환경에서 너무 큼
```

## 임시 조치 — 현재 세션에만 적용

```bash
sudo ip link set dev eth0 mtu 1280
```

효과 확인:

```bash
curl -I https://google.com
# HTTP/2 200
```

즉시 동작한다. 하지만 WSL 재시작 시 1500으로 돌아감.

## 영구 조치 — `/etc/wsl.conf`

WSL2 부팅 시 자동으로 MTU를 조정하도록 설정.

```bash
sudo nano /etc/wsl.conf
```

다음 내용 작성:

```ini
[network]
generateResolvConf = true

[boot]
command = "ip link set dev eth0 mtu 1280"
```

Windows PowerShell에서 재시작:

```powershell
wsl --shutdown
```

재시작 후 MTU 확인:

```bash
ip link show eth0 | grep mtu
# mtu 1280  ✓
```

> [!IMPORTANT]
> `[boot]` 섹션은 **WSL 2.0.9 이상에서만 지원**된다. `wsl --version`으로 확인하자. 오래된 버전이라면 Windows Store에서 업데이트하거나 아래 대안을 사용.

## 대안 — WSL 버전이 낮은 경우

### 옵션 A: `~/.bashrc`에 alias

```bash
# ~/.bashrc
alias vpn-mtu='sudo ip link set dev eth0 mtu 1280'
```

VPN 연결 후 `vpn-mtu` 입력. 단 sudo 비밀번호 필요.

### 옵션 B: NOPASSWD sudo

```bash
sudo visudo
# 마지막 줄에 추가:
username ALL=(ALL) NOPASSWD: /sbin/ip link set dev eth0 mtu *
```

이후 비밀번호 없이 MTU 변경 가능.

### 옵션 C: 부팅 시 systemd 유닛

WSL2 systemd 지원(2.0 이상)이 활성화되어 있다면:

```
/etc/systemd/system/wsl-mtu.service
```

```ini
[Unit]
Description=Set WSL MTU for VPN
After=network.target

[Service]
Type=oneshot
ExecStart=/sbin/ip link set dev eth0 mtu 1280

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable wsl-mtu.service
```

## MTU 값 튜닝

1280이 만능은 아니다. VPN 프로바이더에 따라 최적값이 다르다.

| VPN 유형 | 권장 MTU |
|---------|---------|
| 일반 IPsec | 1400 |
| OpenVPN (UDP) | 1350 |
| OpenVPN (TCP) | 1300 |
| Cisco AnyConnect | 1280~1350 |
| WireGuard | 1420 |

### 최적값 찾기 스크립트

```bash
for mtu in 1500 1450 1400 1350 1300 1280; do
  sudo ip link set dev eth0 mtu $mtu
  echo "Testing MTU=$mtu"
  timeout 3 curl -sI https://google.com && echo "  ✓ OK" || echo "  ✗ FAIL"
done
```

가장 큰 MTU로 성공한 값을 선택. 너무 낮추면 오버헤드가 늘어 속도가 떨어진다.

> [!WARNING]
> MTU를 **너무 낮게(예: 1000 이하)** 설정하면 패킷이 과도하게 쪼개져 처리량이 절반 이하로 떨어진다. "안 되면 무조건 낮춰"가 아니라 "동작하는 최대값"을 찾아야 한다.

## 검증 — 해결 확인

```bash
# HTTPS 접속
curl -I https://google.com
# HTTP/2 200

# apt 동작
sudo apt update

# git pull
cd ~/projects/repo && git pull

# npm install
npm install
```

모두 즉시 응답하면 성공.

## 흔한 실수

| 실수 | 결과 |
|------|------|
| `eth0` 아닌 다른 인터페이스명 | 명령어 실패 |
| `wsl.conf` 들여쓰기 오류 | 설정 무시 |
| `wsl --shutdown` 없이 테스트 | 기존 설정 잔존 |
| Windows 방화벽 오인 | 디버깅 시간 낭비 |

> [!CAUTION]
> `wsl.conf`는 WSL 내부(`/etc/wsl.conf`)에, `.wslconfig`는 Windows 홈 디렉터리(`%USERPROFILE%\.wslconfig`)에 위치한다. **두 파일은 다르다**. 네트워크 MTU는 **WSL 내부 파일**에 설정해야 한다.

## 관련 문제 — DNS 타임아웃

VPN 연결 시 DNS 조회도 실패할 수 있다. 이때는 `/etc/resolv.conf`에 Google DNS 추가:

```bash
[network]
generateResolvConf = false
```

수동 설정:

```bash
sudo tee /etc/resolv.conf > /dev/null <<EOF
nameserver 8.8.8.8
nameserver 1.1.1.1
EOF
```

## 체크리스트

- [ ] `ip link show eth0`로 현재 MTU 확인
- [ ] 크기별 ping으로 MTU 문제 확정
- [ ] 임시 조치로 1280 설정 후 동작 검증
- [ ] `/etc/wsl.conf`에 영구 설정 추가
- [ ] `wsl --shutdown` 후 재부팅 검증
- [ ] 최적 MTU 값 찾기 (속도 최적화)
- [ ] DNS 문제 동반 시 `/etc/resolv.conf` 점검

관련 글: 서버 초기 세팅과 보안 위생은 [SSH 키 로테이션 자동화](/posts/linux/server/ssh-key-rotation)에서 다룬다.

## 정리

WSL2의 네트워크 문제는 대부분 Windows 네트워크 스택과의 **경계면에서 발생**한다. MTU 조정 한 줄로 해결되는 문제에 몇 시간을 날리는 경우가 흔하다. 이 글을 북마크하고, VPN 환경에서 WSL이 먹통일 때 **가장 먼저 MTU를 확인**하자. 방화벽·프록시·DNS를 의심하기 전에 MTU. 이것이 트러블슈팅 순서의 황금률이다.
