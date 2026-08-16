# Orbit SSH

브라우저와 대상 서버 사이에 Node.js 중계 서버를 두는 웹 SSH 터미널입니다. 접속 정보와 개인 키는 메모리에서 해당 세션에만 사용하며 저장하지 않습니다.

## 실행

```bash
cd docs
npm install
npm start
```

브라우저에서 `http://localhost:3000`을 열고 호스트, 포트, 아이디와 비밀번호 또는 개인 키를 입력합니다. 암호화된 개인 키는 키 암호도 함께 입력할 수 있으며, 비밀번호 기반 keyboard-interactive 인증도 지원합니다. 인증 정보는 서버에 저장하지 않고 WebSocket/SSH 세션이 끝나면 메모리에서 해제합니다. 인터넷에 공개할 때는 반드시 HTTPS/WSS 역방향 프록시, 접근 제어, 연결 속도 제한 및 방화벽을 구성하세요.

## GitHub Pages에서 사용

GitHub Pages는 정적 파일만 제공하므로 브라우저에서 SSH의 TCP 소켓을 직접 열 수 없습니다. `server.js`를 TCP 연결이 가능한 별도 Node.js 호스팅에 배포한 뒤 다음 환경 변수를 설정하세요.

```bash
ALLOWED_ORIGINS=https://leemgs.github.io npm start
```

그 다음 홈페이지의 **고급 설정 → SSH 중계 서버 주소**에 `wss://배포한-서버/ssh`를 입력합니다. 주소는 브라우저에만 저장되며 URL의 `?gateway=wss://...` 매개변수로 미리 지정할 수도 있습니다. 중계 서버에는 반드시 TLS, 인증/접근 제어, 연결 속도 제한과 대상 네트워크 방화벽을 적용해야 합니다.
