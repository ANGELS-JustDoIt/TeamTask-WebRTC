# 📋 프로젝트 소스 코드 설명 (발표용)

## 🎯 프로젝트 개요

WebRTC 기술을 활용한 1:1 실시간 화상 채팅 애플리케이션입니다.

- **프론트엔드**: React (클라이언트)
- **백엔드**: Node.js + Express + Socket.io (시그널링 서버)
- **통신**: WebRTC P2P 연결 + Socket.io 시그널링

---

## 📁 주요 파일 구조

### 1. **client/src/App.js** (프론트엔드 메인 컴포넌트)

#### 🔑 핵심 기능

**1) ICE 서버 설정 (42-83줄)**

```javascript
const getIceConfiguration = () => {
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" }, // STUN 서버
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // TURN 서버 추가 (모바일 LTE 지원)
  iceServers.push({
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  });

  return { iceServers };
};
```

- **STUN**: NAT 뒤의 공인 IP 확인
- **TURN**: 직접 연결 실패 시 트래픽 릴레이 (모바일 필수)

**2) 미디어 스트림 획득 (203-222줄)**

```javascript
const getLocalStream = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: true,
  });
  localStreamRef.current = stream;
  return stream;
};
```

- `getUserMedia`: 카메라/마이크 접근
- `getDisplayMedia`: 화면 공유 (497줄)

**3) Peer Connection 생성 (224-290줄)**

```javascript
const createPeerConnection = async (targetUserId, shouldCreateOffer) => {
  const configuration = getIceConfiguration();
  const pc = new RTCPeerConnection(configuration);

  // 로컬 스트림 추가
  localStreamRef.current.getTracks().forEach((track) => {
    pc.addTrack(track, localStreamRef.current);
  });

  // 원격 스트림 수신 처리
  pc.ontrack = (event) => {
    remoteVideoRef.current.srcObject = event.streams[0];
    setIsCallActive(true);
  };

  // ICE Candidate 전송
  pc.onicecandidate = (event) => {
    socketRef.current.emit("ice-candidate", {
      target: targetUserId,
      candidate: event.candidate,
    });
  };

  // Offer 생성 및 전송
  if (shouldCreateOffer) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit("offer", { target: targetUserId, offer });
  }
};
```

**4) WebRTC 연결 흐름**

```
1. 사용자 A가 방 입장 → getLocalStream() 호출
2. 사용자 B가 같은 방 입장
3. 서버가 "existing-users" 이벤트로 B에게 A의 ID 전송
4. B가 createPeerConnection(A의 ID, true) 호출
   → Offer 생성 및 서버로 전송
5. 서버가 A에게 Offer 전달
6. A가 handleOffer() 호출
   → Answer 생성 및 서버로 전송
7. 서버가 B에게 Answer 전달
8. 양쪽에서 ICE Candidate 교환
9. P2P 연결 수립 완료 → 비디오/오디오 스트림 전송 시작
```

**5) Socket.io 이벤트 핸들링 (104-174줄)**

```javascript
// 사용자 입장
newSocket.on("user-joined", (userId) => {
  createPeerConnection(userId, false); // Offer 대기
});

// 기존 사용자 목록 수신
newSocket.on("existing-users", (userIds) => {
  createPeerConnection(userIds[0], true); // Offer 생성
});

// Offer/Answer/ICE Candidate 수신
newSocket.on("offer", async (data) => {
  await handleOffer(data.offer, data.sender);
});

newSocket.on("answer", async (data) => {
  await handleAnswer(data.answer);
});

newSocket.on("ice-candidate", async (data) => {
  await handleIceCandidate(data.candidate);
});
```

**6) 화면 공유 (497-568줄)**

```javascript
const handleScreenShare = async () => {
  // 화면 공유 스트림 획득
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { cursor: "always" },
    audio: true,
  });

  screenStreamRef.current = stream;

  // 별도의 PeerConnection 생성
  await createScreenShareConnection(remoteUserIdRef.current, true);
};
```

- 비디오 통화와 별도의 PeerConnection 사용
- 동시에 두 개의 미디어 스트림 전송 가능

**7) 비디오/오디오 켜기/끄기 (669-690줄)**

```javascript
const handleToggleVideo = () => {
  if (localStreamRef.current) {
    const videoTrack = localStreamRef.current
      .getTracks()
      .find((track) => track.kind === "video");
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
    }
  }
};

const handleToggleAudio = () => {
  if (localStreamRef.current) {
    const audioTrack = localStreamRef.current
      .getTracks()
      .find((track) => track.kind === "audio");
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
    }
  }
};
```

- 통화 중 실시간으로 비디오/오디오 제어 가능
- MediaStreamTrack의 `enabled` 속성을 토글하여 즉시 반영
- PeerConnection 재협상 없이 동작 (효율적)
- 상대방에게도 즉시 반영됨

---

### 2. **server/server.js** (백엔드 시그널링 서버)

#### 🔑 핵심 기능

**1) Socket.io 서버 설정 (18-40줄)**

```javascript
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // ngrok 도메인 허용
      if (origin.includes("ngrok")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  },
});
```

**2) 방 관리 (77-98줄)**

```javascript
const rooms = new Map(); // 방별 사용자 목록 저장

socket.on("join-room", (roomId) => {
  socket.join(roomId); // Socket.io 룸에 조인

  if (!rooms.has(roomId)) {
    rooms.set(roomId, []);
  }

  rooms.get(roomId).push(socket.id);

  // 기존 사용자에게 새 사용자 입장 알림
  socket.to(roomId).emit("user-joined", socket.id);

  // 새 사용자에게 기존 사용자 목록 전송
  const otherUsers = room.filter((id) => id !== socket.id);
  if (otherUsers.length > 0) {
    socket.emit("existing-users", otherUsers);
  }
});
```

**3) WebRTC 시그널링 메시지 전달 (100-146줄)**

```javascript
// Offer 전달
socket.on("offer", (data) => {
  socket.to(data.target).emit("offer", {
    offer: data.offer,
    sender: socket.id,
  });
});

// Answer 전달
socket.on("answer", (data) => {
  socket.to(data.target).emit("answer", {
    answer: data.answer,
    sender: socket.id,
  });
});

// ICE Candidate 전달
socket.on("ice-candidate", (data) => {
  socket.to(data.target).emit("ice-candidate", {
    candidate: data.candidate,
    sender: socket.id,
  });
});
```

- **역할**: 두 클라이언트 간 Offer/Answer/ICE Candidate를 중계
- **중요**: 시그널링만 담당, 실제 미디어 데이터는 P2P로 직접 전송

**4) 정적 파일 서빙 (63-68줄)**

```javascript
// React 빌드 파일 서빙 (ngrok 사용 시)
const buildPath = path.join(__dirname, "../client/build");
if (require("fs").existsSync(buildPath)) {
  app.use(express.static(buildPath));
}
```

- 프론트엔드와 백엔드를 같은 포트에서 서빙
- 하나의 ngrok 터널로 모두 접근 가능

---

## 🔄 전체 동작 흐름

### 시나리오: 두 사용자가 화상 통화 시작

```
[사용자 A]                    [서버]                    [사용자 B]
   |                            |                           |
   |-- join-room("room1") ---->|                           |
   |<-- existing-users([]) ----|                           |
   |                            |                           |
   |                            |<-- join-room("room1") ---|
   |                            |-- existing-users([A]) -->|
   |                            |<-- user-joined(B) --------|
   |                            |                           |
   |                            |                           |
   |<-- user-joined(B) ---------|                           |
   |                            |                           |
   |-- createPeerConnection(B, false)                       |
   |                            |                           |
   |                            |                           |-- createPeerConnection(A, true)
   |                            |                           |-- createOffer()
   |                            |                           |-- offer --------->|
   |                            |<-- offer ------------------|
   |<-- offer ------------------|                           |
   |-- handleOffer()            |                           |
   |-- createAnswer()           |                           |
   |-- answer ---------------->|                           |
   |                            |-- answer ---------------->|
   |                            |                           |-- handleAnswer()
   |                            |                           |
   |-- ICE Candidate <-------->|                           |
   |                            |<-- ICE Candidate <--------|
   |                            |                           |
   |========== P2P 연결 수립 완료 ==========|
   |                            |                           |
   |<======== 비디오/오디오 스트림 직접 전송 ========>|
```

---

## 🎯 핵심 기술 포인트

### 1. **WebRTC P2P 연결**

- 서버를 거치지 않고 클라이언트 간 직접 통신
- 낮은 지연시간, 서버 부하 감소

### 2. **시그널링 서버의 역할**

- Offer/Answer/ICE Candidate만 중계
- 실제 미디어 데이터는 P2P로 전송

### 3. **STUN/TURN 서버**

- **STUN**: NAT 통과 (WiFi 환경)
- **TURN**: 트래픽 릴레이 (모바일 LTE 필수)

### 4. **화면 공유**

- 별도의 PeerConnection 사용
- 비디오 통화와 독립적으로 동작

### 5. **비디오/오디오 실시간 제어**

- 통화 중 MediaStreamTrack의 `enabled` 속성을 토글
- PeerConnection 재협상 없이 즉시 반영
- 상대방에게도 실시간으로 반영됨

### 6. **ngrok 통합**

- 프론트엔드와 백엔드를 같은 포트에서 서빙
- 하나의 ngrok 터널로 외부 접근 가능

---

## 💡 발표 시 강조할 점

1. **WebRTC의 P2P 특성**: 서버를 거치지 않는 직접 통신
2. **시그널링 vs 미디어**: 시그널링만 서버 경유, 미디어는 P2P
3. **모바일 지원**: TURN 서버를 통한 LTE 네트워크 지원
4. **실시간성**: Socket.io를 통한 즉각적인 메시지 교환
5. **실시간 미디어 제어**: 통화 중 비디오/오디오 켜기/끄기 기능
6. **확장성**: 다중 사용자 지원 가능한 구조

---

## 🚀 개선 가능한 부분

1. **에러 핸들링**: 연결 실패 시 재시도 로직
2. **다중 사용자**: 1:N 화상 회의 지원
3. **텍스트 채팅**: RTCDataChannel 활용
4. **화질 조절**: 네트워크 상태에 따른 자동 조절
5. **녹화 기능**: MediaRecorder API 활용

---

**발표 준비 완료! 화이팅! 🎉**
