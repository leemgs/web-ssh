# Ubuntu 24.04 + Nginx WSS/WS 중계 서버 구축

이 저장소에는 SSH 중계 서버가 이미 구현되어 있으므로 새 `server.js`를 만들 필요가 없습니다. `docs/server.js`는 `/ssh` WebSocket 경로에서 브라우저의 `connect`, `input`, `resize`, `disconnect` 메시지를 처리하며 비밀번호, 개인 키, passphrase, keyboard-interactive 인증을 지원합니다.

아래 예시는 웹 앱을 `https://leemgs.github.io`에서 제공하고, 중계 서버의 도메인으로 `leemgs.mooo.com`을 사용하는 경우입니다. 도메인, 사용자 이름과 저장소 경로는 실제 환경에 맞게 바꾸세요.

## 1. 필수 패키지와 저장소 설치

```bash
sudo apt update
sudo apt install -y git nodejs npm nginx certbot python3-certbot-nginx
```

이 프로젝트는 Node.js 20 이상이 필요합니다. Ubuntu 저장소에서 설치한 버전이 이 조건을 충족하는지 반드시 확인하세요.

```bash
node --version
```

출력된 메이저 버전이 20 미만이면 이 상태로 진행하지 말고 [Node.js 공식 설치 안내](https://nodejs.org/en/download)를 따라 LTS 버전으로 교체한 다음 다시 확인합니다. systemd에서 사용할 실행 파일 경로도 함께 확인하세요.

```bash
command -v node
command -v npm
```

저장소를 받고 의존성을 설치합니다.

```bash
cd ~
git clone https://github.com/leemgs/web-ssh.git
cd web-ssh/docs
npm ci
```

## 2. 중계 서버 직접 실행 및 확인

허용할 웹 앱의 Origin과 포트를 지정해 먼저 직접 실행합니다.

```bash
ALLOWED_ORIGINS=https://leemgs.github.io PORT=3000 npm start
```

정상적으로 실행되면 다음과 비슷한 메시지가 표시됩니다.

```text
Web SSH: http://localhost:3000
```

다른 터미널에서 상태 확인 엔드포인트를 호출합니다.

```bash
curl http://127.0.0.1:3000/health
```

다음 응답이 오면 SSH 중계 서버가 정상적으로 실행된 것입니다.

```json
{"status":"ok"}
```

## 3. systemd 서비스 등록

서비스 파일을 만듭니다.

```bash
sudo nano /etc/systemd/system/web-ssh.service
```

저장소가 `/home/invain/web-ssh`에 있는 경우의 예시는 다음과 같습니다.

```ini
[Unit]
Description=Orbit Web SSH Relay
After=network.target

[Service]
Type=simple
User=invain
WorkingDirectory=/home/invain/web-ssh/docs

Environment=PORT=3000
Environment=ALLOWED_ORIGINS=https://leemgs.github.io

ExecStart=/usr/bin/npm start

Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

`User=invain`과 `/home/invain/...`은 실제 계정 및 경로로 변경합니다. `ExecStart` 역시 앞에서 `command -v npm`으로 확인한 절대 경로와 다르면 수정해야 합니다. 현재 계정은 다음 명령으로 확인할 수 있습니다.

```bash
whoami
```

서비스를 활성화하고 즉시 시작합니다.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now web-ssh
```

서비스와 상태 확인 엔드포인트를 모두 확인합니다.

```bash
sudo systemctl status web-ssh
curl http://127.0.0.1:3000/health
```

## 4. Nginx WebSocket 역방향 프록시 구성

외부의 WSS 연결을 내부의 `ws://127.0.0.1:3000`으로 전달할 Nginx 설정 파일을 만듭니다.

```bash
sudo nano /etc/nginx/sites-available/web-ssh
```

```nginx
server {
    listen 80;
    server_name leemgs.mooo.com;

    location /ssh {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
    }
}
```

사이트를 활성화하고 설정을 검사한 뒤 Nginx를 다시 불러옵니다.

```bash
sudo ln -s /etc/nginx/sites-available/web-ssh \
  /etc/nginx/sites-enabled/web-ssh
sudo nginx -t
sudo systemctl reload nginx
```

같은 이름의 심볼릭 링크가 이미 있으면 `ln` 명령은 생략합니다. Ubuntu 기본 사이트가 같은 도메인이나 포트를 선점해 충돌한다면 `sudo a2dissite`가 아니라 다음 Nginx 명령으로 기본 사이트를 비활성화한 뒤 설정을 다시 검사합니다.

```bash
sudo unlink /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 5. TLS 인증서 설치

도메인의 DNS가 이 서버를 가리키고 80/443 포트가 외부에서 접근 가능한지 확인한 뒤 인증서를 설치합니다.

```bash
sudo certbot --nginx -d leemgs.mooo.com
```

설치가 완료되면 웹 앱의 **고급 설정 → SSH 중계 서버 주소**에 다음 주소를 입력합니다.

```text
wss://leemgs.mooo.com/ssh
```

전체 연결 구조는 다음과 같습니다.

```text
https://leemgs.github.io/web-ssh/
          │
          │ WSS
          ▼
wss://leemgs.mooo.com/ssh
          │
          ▼
Nginx :443
          │
          │ WS
          ▼
127.0.0.1:3000
          │
          ▼
docs/server.js
          │
          │ SSH
          ▼
SSH server :22
```

## 보안 주의 사항

`ALLOWED_ORIGINS`에는 중계 서버 사용을 허용할 웹 앱의 Origin을 지정합니다.

```bash
ALLOWED_ORIGINS=https://leemgs.github.io
```

중계 서버는 WebSocket 연결의 `Origin`을 검사하고, 목록에 없는 Origin을 HTTP `403`으로 거절합니다. 여러 Origin은 쉼표로 구분할 수 있습니다. 다만 Origin 검사는 브라우저 기반의 무단 사용을 줄이는 수단일 뿐 사용자 인증을 대신하지 않으므로, 인터넷에 공개할 때는 별도의 인증·접근 제어, 연결 속도 제한과 방화벽도 적용하세요.

현재 구현은 브라우저가 지정한 SSH 목적지 `host`와 `port`에 접속합니다. 개인용으로 운영한다면 임의 서버로의 프록시 악용을 막기 위해 방화벽으로 목적지를 `localhost:22` 또는 신뢰할 수 있는 특정 서버로 제한하는 것이 안전합니다.

## 문제 진단

문제가 발생하면 다음 명령을 차례대로 실행해 서비스, 내부 상태 확인, Nginx 설정, 리스닝 포트 및 외부 HTTPS 응답을 점검합니다.

```bash
systemctl status web-ssh --no-pager
curl http://127.0.0.1:3000/health
sudo nginx -t
sudo ss -lntp | grep -E ':(22|80|443|3000)'
curl -I https://leemgs.mooo.com/health
```

모든 항목이 정상이면 `https://leemgs.github.io/web-ssh/`에서 중계 서버 주소를 설정한 뒤 **터미널 연결**을 사용할 수 있습니다.
