# Ubuntu 24.04 + Apache WSS/WS 중계 서버 구축

이 저장소에는 SSH 중계 서버가 이미 구현되어 있으므로 새 `server.js`를 만들 필요가 없습니다. `docs/server.js`는 `/ssh` WebSocket 경로에서 브라우저의 `connect`, `input`, `resize`, `disconnect` 메시지를 처리하며 비밀번호, 개인 키, passphrase, keyboard-interactive 인증을 지원합니다.

아래 예시는 웹 앱을 `https://leemgs.github.io`에서 제공하고, 중계 서버의 도메인으로 `leemgs.mooo.com`을 사용하는 경우입니다. 도메인, 사용자 이름과 저장소 경로는 실제 환경에 맞게 바꾸세요. Nginx를 사용하는 경우에는 [Nginx 기반 매뉴얼](wss-ws-setup.md)을 이용하세요.

## 1. 필수 패키지와 저장소 설치

```bash
sudo apt update
sudo apt install -y git nodejs npm apache2 certbot python3-certbot-apache
```

이 프로젝트는 Node.js 20 이상이 필요합니다. Ubuntu 저장소에서 설치한 버전이 이 조건을 충족하는지 반드시 확인합니다.

```bash
node --version
command -v node
command -v npm
```

Node.js 메이저 버전이 20 미만이면 이 상태로 진행하지 말고 [Node.js 공식 설치 안내](https://nodejs.org/en/download)를 따라 LTS 버전으로 교체한 다음 다시 확인합니다.

저장소를 받고 잠금 파일에 기록된 의존성을 설치합니다.

```bash
cd ~
git clone https://github.com/leemgs/web-ssh.git
cd web-ssh/docs
npm ci
```

## 2. 중계 서버 직접 실행 및 확인

허용할 웹 앱의 Origin과 포트를 지정해 중계 서버를 직접 실행합니다.

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

다음 응답이 오면 중계 서버 자체는 정상입니다.

```json
{"status":"ok"}
```

확인이 끝나면 직접 실행한 프로세스를 `Ctrl+C`로 종료하고 systemd 서비스로 전환합니다.

## 3. systemd 서비스 등록

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

`User`, `WorkingDirectory`와 `ExecStart`를 실제 환경에 맞게 수정합니다. 현재 계정과 npm 경로는 다음 명령으로 확인할 수 있습니다.

```bash
whoami
command -v npm
```

서비스를 활성화하고 즉시 시작한 뒤 상태를 확인합니다.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now web-ssh
sudo systemctl status web-ssh --no-pager
curl http://127.0.0.1:3000/health
```

## 4. Apache WebSocket 역방향 프록시 구성

필요한 Apache 모듈을 활성화합니다. `proxy_wstunnel`은 WebSocket 프록시에 사용하며, `ssl`과 `headers`는 TLS 가상 호스트에서 사용합니다.

```bash
sudo a2enmod proxy proxy_http proxy_wstunnel headers ssl
sudo systemctl restart apache2
```

가상 호스트 설정 파일을 만듭니다.

```bash
sudo nano /etc/apache2/sites-available/web-ssh.conf
```

```apache
<VirtualHost *:80>
    ServerName leemgs.mooo.com

    ProxyRequests Off
    ProxyPreserveHost On

    ProxyPass        /ssh  ws://127.0.0.1:3000/ssh retry=0 timeout=86400
    ProxyPassReverse /ssh  ws://127.0.0.1:3000/ssh

    ProxyPass        /health  http://127.0.0.1:3000/health
    ProxyPassReverse /health  http://127.0.0.1:3000/health

    ErrorLog ${APACHE_LOG_DIR}/web-ssh-error.log
    CustomLog ${APACHE_LOG_DIR}/web-ssh-access.log combined
</VirtualHost>
```

`ProxyRequests Off`는 Apache가 공개 포워드 프록시로 동작하지 않도록 합니다. `ProxyPass`의 `/ssh` 대상에는 중계 서버와 동일한 `/ssh` 경로를 포함해야 합니다.

사이트를 활성화하고 설정 문법을 검사한 뒤 Apache를 다시 불러옵니다.

```bash
sudo a2ensite web-ssh.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

기본 사이트가 같은 도메인과 충돌하면 비활성화한 뒤 다시 검사합니다.

```bash
sudo a2dissite 000-default.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

## 5. TLS 인증서 설치

도메인의 DNS가 이 서버를 가리키고 80/443 포트가 외부에서 접근 가능한지 확인한 뒤 Certbot의 Apache 플러그인으로 인증서를 설치합니다.

```bash
sudo certbot --apache -d leemgs.mooo.com
```

Certbot이 생성하거나 수정한 `*:443` 가상 호스트에도 `/ssh`와 `/health`의 `ProxyPass` 설정이 유지되어 있는지 확인합니다.

```bash
sudo apache2ctl -S
sudo apache2ctl configtest
curl -I https://leemgs.mooo.com/health
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
Apache :443
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

중계 서버는 WebSocket 연결의 `Origin`을 검사하고 허용 목록에 없는 Origin을 HTTP `403`으로 거절합니다. 여러 Origin은 쉼표로 구분할 수 있습니다. Origin 검사는 사용자 인증을 대신하지 않으므로 인터넷에 공개할 때는 별도의 인증·접근 제어, 연결 속도 제한과 방화벽도 적용하세요.

현재 구현은 브라우저가 지정한 SSH 목적지 `host`와 `port`에 접속합니다. 개인용 중계 서버라면 임의 서버로의 프록시 악용을 막기 위해 방화벽으로 목적지를 `localhost:22` 또는 신뢰할 수 있는 특정 서버로 제한하는 것이 안전합니다.

## 문제 진단

```bash
systemctl status web-ssh --no-pager
curl http://127.0.0.1:3000/health
sudo apache2ctl configtest
sudo apache2ctl -S
sudo ss -lntp | grep -E ':(22|80|443|3000)'
curl -I https://leemgs.mooo.com/health
sudo tail -n 100 /var/log/apache2/web-ssh-error.log
```

모든 항목이 정상이면 `https://leemgs.github.io/web-ssh/`에서 중계 서버 주소를 설정한 뒤 **터미널 연결**을 사용할 수 있습니다.
