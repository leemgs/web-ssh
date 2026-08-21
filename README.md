# Orbit SSH

브라우저와 대상 서버 사이에서 Node.js 중계 서버를 사용하는 웹 SSH 터미널입니다. 웹 앱과 로컬 개발 방법은 [`docs/README.md`](docs/README.md)를 참고하세요.

## 배포 문서

- [Ubuntu 24.04 + Nginx에서 WSS/WS 중계 서버 구축](documents/wss-ws-setup.md)
- [Ubuntu 24.04 + Apache에서 WSS/WS 중계 서버 구축](documents/wss-ws-apache-setup.md)

두 문서 모두 기존 `docs/server.js`를 systemd 서비스로 실행하고, 선택한 웹 서버와 Let's Encrypt를 이용해 `wss://` 엔드포인트를 구성하는 과정을 설명합니다.
