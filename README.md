# 🎥 WebRTC 1:1 화상 채팅 서비스

React + Node.js 기반의 실시간 1:1 화상 채팅 애플리케이션입니다. WebRTC 기술을 활용하여 브라우저 간 직접적인 P2P 통신을 구현했습니다.

## ✨ 주요 기능

- ✅ 1:1 실시간 화상 통화
- ✅ 실시간 음성 통신
- ✅ 화면 공유 기능
- ✅ Socket.io 기반 Signaling 서버
- ✅ STUN 서버를 통한 NAT 통과
- ✅ 반응형 디자인

## 🏗️ 프로젝트 구조

```
1207-team-webrtc-videdo-chat/
├── client/                 # React 프론트엔드
│   ├── public/
│   ├── src/
│   │   ├── App.js         # 메인 컴포넌트
│   │   ├── App.css        # 스타일
│   │   └── index.js       # 진입점
│   └── package.json
├── server/                 # Node.js 시그널링 서버
│   ├── server.js          # Socket.io 서버
│   └── package.json
└── README.md
```

## 🚀 실행 방법

### 1. Node.js 서버 실행

```bash
# server 디렉토리로 이동
cd server

# 의존성 설치
npm install

# 서버 실행
npm start

# 또는 개발 모드 (nodemon 사용)
npm run dev
```

서버는 기본적으로 `http://localhost:5001`에서 실행됩니다.

### 2. React 프론트엔드 실행

새 터미널 창에서:

```bash
# client 디렉토리로 이동
cd client

# 의존성 설치
npm install

# 개발 서버 실행
npm start
```

프론트엔드는 기본적으로 `http://localhost:3000`에서 실행됩니다.

### 3. 사용 방법

1. 브라우저에서 `http://localhost:3000` 접속
2. 같은 방 ID를 입력 (예: "room1")
3. 두 개의 브라우저 창/탭에서 같은 방 ID로 입장
4. 자동으로 WebRTC 연결이 설정되고 화상 통화 시작
5. "화면 공유" 버튼을 클릭하여 화면 공유 가능

## 🔧 기술 스택

### Frontend
- **React 18**: UI 프레임워크
- **Socket.io Client**: 시그널링을 위한 WebSocket 통신
- **WebRTC API**: 
  - `getUserMedia`: 로컬 미디어 스트림 획득
  - `getDisplayMedia`: 화면 공유 스트림 획득
  - `RTCPeerConnection`: P2P 연결 관리
  - `RTCSessionDescription`: Offer/Answer 교환
  - `RTCIceCandidate`: ICE 후보 교환

### Backend
- **Node.js**: 서버 런타임
- **Express**: HTTP 서버
- **Socket.io**: WebSocket 기반 시그널링 서버
- **CORS**: Cross-Origin 리소스 공유

## 📚 WebRTC 동작 원리

### 1. Signaling (시그널링)
- WebRTC는 직접적인 P2P 연결을 위해 시그널링 서버가 필요합니다
- Socket.io를 사용하여 Offer, Answer, ICE Candidate를 교환합니다

### 2. STUN 서버
- NAT(Network Address Translation) 뒤에 있는 클라이언트의 공인 IP를 확인합니다
- Google의 공개 STUN 서버를 사용합니다: `stun:stun.l.google.com:19302`

### 3. 연결 흐름
```
1. 사용자 A가 방에 입장
2. 사용자 B가 같은 방에 입장
3. 사용자 A가 Offer 생성 및 전송
4. 사용자 B가 Answer 생성 및 전송
5. 양쪽에서 ICE Candidate 교환
6. P2P 연결 수립 완료
7. 미디어 스트림 전송 시작
```

### 4. 화면 공유
- 별도의 PeerConnection을 생성하여 화면 공유 스트림을 전송합니다
- `getDisplayMedia` API를 사용하여 화면 캡처

## 🎯 주요 구현 내용

### MediaStream 관리
- 로컬 비디오/오디오 스트림 획득 및 표시
- 원격 스트림 수신 및 표시
- 화면 공유 스트림 별도 관리

### RTCPeerConnection
- Peer-to-Peer 연결 생성 및 관리
- Offer/Answer 교환을 통한 SDP 협상
- ICE Candidate 교환을 통한 최적 경로 탐색

### RTCDataChannel (향후 확장 가능)
- 현재는 미디어 스트림만 사용
- 텍스트 채팅, 파일 전송 등에 활용 가능

## ⚠️ 주의사항

1. **HTTPS 또는 localhost**: 
   - `getUserMedia`와 `getDisplayMedia`는 보안상 HTTPS 환경 또는 localhost에서만 동작합니다
   - 프로덕션 배포 시 HTTPS가 필요합니다

2. **브라우저 호환성**:
   - Chrome, Firefox, Edge 등 최신 브라우저에서 동작합니다
   - Safari는 일부 제한이 있을 수 있습니다

3. **방화벽/NAT**:
   - 일부 네트워크 환경에서는 STUN만으로는 연결이 안 될 수 있습니다
   - 이 경우 TURN 서버가 필요합니다

4. **카메라/마이크 권한**:
   - 브라우저에서 카메라와 마이크 접근 권한을 허용해야 합니다

## 🔮 향후 개선 사항

- [ ] TURN 서버 연동 (NAT 통과 개선)
- [ ] 텍스트 채팅 기능 추가
- [ ] 다중 사용자 지원 (1:N 화상 회의)
- [ ] 화면 녹화 기능
- [ ] 음소거/비디오 끄기 토글
- [ ] 연결 상태 표시
- [ ] 에러 핸들링 개선

## 📝 라이선스

MIT License

## 👥 팀 프로젝트

이 프로젝트는 WebRTC 기술 학습 및 실전 구현을 위한 팀 프로젝트입니다.

---

**만든이**: WebRTC 팀 프로젝트  
**과제**: React + Node.js 기반 WebRTC 실시간 통신 서비스 구현
