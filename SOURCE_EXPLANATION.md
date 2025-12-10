# 📋 프로젝트 소스 코드 설명 (발표용)

## 🎯 프로젝트 개요

WebRTC 기술을 활용한 1:1 실시간 화상 채팅 애플리케이션입니다.

- **프론트엔드**: React (클라이언트)
- **백엔드**: Node.js + Express + Socket.io (시그널링 서버)
- **통신**: WebRTC P2P 연결 + Socket.io 시그널링

---

## 🎓 프로젝트 작동 원리 (쉬운 설명)

### 📖 전체 흐름 개요

이 프로젝트는 **두 사람이 화상 통화**를 할 수 있게 해주는 앱입니다.
마치 전화를 거는 것처럼, 하지만 **비디오와 채팅**도 함께 사용할 수 있습니다.

### 🔄 단계별 작동 과정

#### **1단계: 앱 시작하기** 🚀

```
사용자 A가 브라우저에서 앱을 엽니다
  ↓
React 앱이 로드되고 Socket.io로 서버에 연결합니다
  ↓
"방 ID"를 입력하고 "방 입장" 버튼을 클릭합니다
  ↓
카메라와 마이크 권한을 요청하고 허용합니다
```

**무슨 일이 일어나나요?**

- 브라우저가 카메라/마이크에 접근합니다
- 서버에 "나는 이 방에 들어가고 싶어요"라고 알립니다
- 서버는 "알겠어요, 방에 등록했어요"라고 응답합니다

---

#### **2단계: 상대방 입장하기** 👥

```
사용자 B가 같은 방 ID로 입장합니다
  ↓
서버가 두 사용자를 연결하려고 합니다
  ↓
서버가 A에게 "B가 들어왔어요!" 알림
  ↓
서버가 B에게 "A가 이미 있어요!" 알림
```

**무슨 일이 일어나나요?**

- 서버가 두 사람이 같은 방에 있다는 것을 알게 됩니다
- 서버가 서로의 존재를 알려줍니다
- 이제 두 사람이 연결할 준비가 되었습니다

---

#### **3단계: 연결 정보 교환하기** 📡

```
사용자 B가 "연결 제안(Offer)"을 만듭니다
  ↓
B → 서버 → A: "연결하고 싶어요!"
  ↓
사용자 A가 "연결 수락(Answer)"을 만듭니다
  ↓
A → 서버 → B: "좋아요, 연결할게요!"
```

**왜 이렇게 하나요?**

- WebRTC는 직접 연결(P2P)을 하려면 먼저 "어떻게 연결할지" 협상해야 합니다
- 마치 전화번호를 주고받는 것처럼, 연결 방법을 주고받습니다
- 서버는 이 정보만 전달하고, 실제 비디오/오디오는 직접 전송합니다

---

#### **4단계: 최적 경로 찾기** 🗺️

```
양쪽에서 "ICE Candidate"를 교환합니다
  ↓
여러 연결 경로를 시도합니다
  ↓
가장 빠른 경로를 찾습니다
```

**ICE Candidate란?**

- 여러 네트워크 경로 중 가장 좋은 경로를 찾는 과정입니다
- 예: WiFi로 직접 연결? 아니면 TURN 서버를 거쳐야 하나?
- 마치 여러 길 중 가장 빠른 길을 찾는 것과 같습니다

---

#### **5단계: 화상 통화 시작!** 🎥

```
P2P 연결이 완료되었습니다
  ↓
비디오와 오디오 스트림이 직접 전송됩니다
  ↓
양쪽 화면에 상대방이 보입니다!
```

**이제 어떻게 되나요?**

- 서버를 거치지 않고 **직접** 비디오/오디오를 주고받습니다
- 서버는 더 이상 관여하지 않습니다 (시그널링만 했으니까요)
- 낮은 지연시간으로 부드러운 통화가 가능합니다

---

#### **6단계: 추가 기능 사용하기** ⚡

**비디오/오디오 끄기:**

```
버튼 클릭 → MediaStreamTrack.enabled = false
  ↓
즉시 반영 (재협상 불필요)
```

**화면 공유:**

```
버튼 클릭 → getDisplayMedia() 호출
  ↓
별도의 PeerConnection 생성
  ↓
화면 공유 스트림 전송
```

**텍스트 채팅:**

```
메시지 입력 → Socket.io로 서버에 전송
  ↓
서버가 상대방에게 전달
  ↓
양쪽 화면에 메시지 표시
```

---

### 🎯 핵심 개념 정리

#### **1. 시그널링 vs 미디어**

| 구분     | 시그널링                     | 미디어 데이터                |
| -------- | ---------------------------- | ---------------------------- |
| **역할** | "어떻게 연결할지" 정보 교환  | 실제 비디오/오디오           |
| **경로** | 서버를 거침                  | 직접 전송 (P2P)              |
| **예시** | Offer, Answer, ICE Candidate | 비디오 스트림, 오디오 스트림 |
| **비유** | 전화번호 주고받기            | 실제 전화 통화               |

#### **2. STUN vs TURN**

**STUN 서버:**

- "내 공인 IP 주소가 뭐야?"를 알려줍니다
- WiFi 같은 일반 네트워크에서 사용
- 무료로 사용 가능

**TURN 서버:**

- 직접 연결이 안 될 때 트래픽을 중계해줍니다
- 모바일 LTE 같은 복잡한 네트워크에서 필요
- 서버 자원을 사용하므로 유료일 수 있음

#### **3. 왜 P2P를 사용하나요?**

✅ **장점:**

- 서버 부하가 적습니다 (비디오/오디오를 서버가 처리하지 않음)
- 지연시간이 낮습니다 (서버를 거치지 않으니까)
- 비용이 적습니다 (서버 대역폭을 많이 쓰지 않음)

❌ **단점:**

- 방화벽/NAT 때문에 연결이 어려울 수 있습니다 (STUN/TURN 필요)
- 서버가 연결을 도와줘야 합니다 (시그널링)

---

### 📊 전체 아키텍처

```
┌─────────────┐         ┌─────────────┐
│  사용자 A   │         │  사용자 B   │
│  (브라우저) │         │  (브라우저) │
└──────┬──────┘         └──────┬──────┘
       │                       │
       │  시그널링 (서버 경유)  │
       │  (Offer/Answer/ICE)    │
       │                       │
       └───────────┬───────────┘
                   │
            ┌──────▼──────┐
            │   서버      │
            │ (Socket.io) │
            └─────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
       │  미디어 (P2P 직접)     │
       │  (비디오/오디오)       │
       │                       │
┌──────▼──────┐         ┌──────▼──────┐
│  사용자 A   │◄────────►│  사용자 B   │
│  (브라우저) │  직접 연결 │  (브라우저) │
└─────────────┘         └─────────────┘
```

---

### 💡 실생활 비유

**전화를 거는 과정과 비슷합니다:**

1. **시그널링** = 전화번호를 주고받는 과정

   - "내 번호는 010-1234-5678이야"
   - "알겠어, 나는 010-9876-5432야"

2. **P2P 연결** = 실제 전화 통화

   - 이제 서로 직접 통화합니다
   - 통신사(서버)는 더 이상 관여하지 않습니다

3. **STUN/TURN** = 전화 연결을 도와주는 것
   - STUN: "내 번호 알려줘"
   - TURN: "직접 연결 안 되면 내가 중계해줄게"

---

### 🎬 실제 사용 시나리오

**시나리오: 친구와 화상 통화하기**

1. **준비 단계**

   - 친구 A: "room1" 방에 입장
   - 친구 B: "room1" 방에 입장
   - 서버: "두 사람이 같은 방에 있네요!"

2. **연결 단계**

   - 친구 B가 연결 제안을 보냅니다
   - 친구 A가 수락합니다
   - 서버가 이 정보를 전달합니다

3. **통화 단계**

   - 두 사람이 직접 비디오/오디오를 주고받습니다
   - 서버는 더 이상 관여하지 않습니다
   - 부드러운 화상 통화가 시작됩니다!

4. **기능 사용**
   - 비디오 끄기: 버튼 클릭 → 즉시 반영
   - 채팅: 메시지 입력 → 서버 경유 → 상대방에게 전달
   - 화면 공유: 별도 연결 생성 → 화면 전송

---

이제 프로젝트가 어떻게 작동하는지 이해하셨나요? 🎉

---

## 📁 주요 파일 구조

### 1. **client/src/App.js** (프론트엔드 메인 컴포넌트)

#### 🔑 핵심 기능

**1) ICE 서버 설정 (43-83줄)**

```javascript
// client/src/App.js:43-83
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

**2) 미디어 스트림 획득 (230-249줄)**

```javascript
// client/src/App.js:230-249
const getLocalStream = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
      audio: true,
    });
    localStreamRef.current = stream;
    return stream;
  } catch (error) {
    console.error("Error accessing media devices:", error);
    alert("카메라와 마이크 접근 권한이 필요합니다.");
    return null;
  }
};
```

- `getUserMedia`: 카메라/마이크 접근
- `getDisplayMedia`: 화면 공유 (621줄)

**3) Peer Connection 생성 (251-310줄)**

```javascript
// client/src/App.js:251-310
const createPeerConnection = async (targetUserId, shouldCreateOffer) => {
  try {
    const configuration = getIceConfiguration();
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    // 로컬 스트림 추가
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // 원격 스트림 수신 처리
    pc.ontrack = (event) => {
      console.log("Received remote stream");
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsCallActive(true);
      }
    };

    // ICE Candidate 전송
    pc.onicecandidate = (event) => {
      if (event.candidate && targetUserId && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          target: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    // Offer 생성 및 전송
    if (shouldCreateOffer && targetUserId && socketRef.current) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit("offer", {
        target: targetUserId,
        offer: offer,
      });
    }

    return pc;
  } catch (error) {
    console.error("Error creating peer connection:", error);
    return null;
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

**5) Socket.io 이벤트 핸들링 (108-189줄)**

```javascript
// client/src/App.js:108-189
useEffect(() => {
  const newSocket = io(SERVER_URL);
  setSocket(newSocket);
  socketRef.current = newSocket;

  // 사용자 입장
  newSocket.on("user-joined", (userId) => {
    console.log("User joined:", userId);
    remoteUserIdRef.current = userId;
    createPeerConnection(userId, false); // Offer 대기
  });

  // 기존 사용자 목록 수신
  newSocket.on("existing-users", (userIds) => {
    console.log("Existing users:", userIds);
    if (userIds.length > 0) {
      remoteUserIdRef.current = userIds[0];
      createPeerConnection(userIds[0], true); // Offer 생성
    }
  });

  // Offer/Answer/ICE Candidate 수신
  newSocket.on("offer", async (data) => {
    console.log("Received offer from:", data.sender);
    await handleOffer(data.offer, data.sender);
  });

  newSocket.on("answer", async (data) => {
    console.log("Received answer from:", data.sender);
    await handleAnswer(data.answer);
  });

  newSocket.on("ice-candidate", async (data) => {
    console.log("Received ICE candidate from:", data.sender);
    await handleIceCandidate(data.candidate);
  });

  // 채팅 메시지 수신
  newSocket.on("chat-message", (data) => {
    console.log("Received chat message:", data);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: data.message,
        sender: data.sender,
        isOwn: false,
        timestamp: new Date(),
      },
    ]);
  });

  return () => {
    newSocket.close();
  };
}, []);
```

**6) 화면 공유 (621-680줄)**

```javascript
// client/src/App.js:621-680
const handleScreenShare = async () => {
  try {
    if (!isScreenSharing) {
      console.log("Starting screen share...");
      // 화면 공유 스트림 획득
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "monitor",
        },
        audio: true,
      });

      console.log("Screen share stream obtained:", stream);
      screenStreamRef.current = stream;
      setIsScreenSharing(true);

      // 별도의 PeerConnection 생성
      if (remoteUserIdRef.current) {
        await createScreenShareConnection(remoteUserIdRef.current, true);
      }

      // 화면 공유 종료 처리
      stream.getVideoTracks()[0].onended = () => {
        console.log("Screen share ended by user");
        handleStopScreenShare();
      };
    } else {
      handleStopScreenShare();
    }
  } catch (error) {
    console.error("Error sharing screen:", error);
  }
};
```

- 비디오 통화와 별도의 PeerConnection 사용
- 동시에 두 개의 미디어 스트림 전송 가능

**7) 비디오/오디오 켜기/끄기 (697-719줄)**

```javascript
// client/src/App.js:697-719
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

**8) 텍스트 채팅 (721-747줄)**

```javascript
// client/src/App.js:721-747
const handleSendMessage = (e) => {
  e.preventDefault();
  if (!messageInput.trim() || !socketRef.current || !remoteUserIdRef.current) {
    return;
  }

  const messageData = {
    target: remoteUserIdRef.current,
    message: messageInput.trim(),
  };

  socketRef.current.emit("chat-message", messageData);

  // 내 메시지를 채팅 목록에 추가
  setMessages((prev) => [
    ...prev,
    {
      id: Date.now(),
      text: messageInput.trim(),
      sender: socketRef.current?.id || "me",
      isOwn: true,
      timestamp: new Date(),
    },
  ]);

  setMessageInput("");
};

// 메시지 수신은 Socket.io 이벤트 핸들러에서 처리 (176-189줄)
```

- Socket.io를 통한 실시간 텍스트 메시지 교환
- 통화 중에도 채팅 가능
- 내 메시지와 상대방 메시지를 구분하여 표시
- 자동 스크롤 기능으로 최신 메시지 확인

---

### 2. **server/server.js** (백엔드 시그널링 서버)

#### 🔑 핵심 기능

**1) Socket.io 서버 설정 (18-40줄)**

```javascript
// server/server.js:18-40
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow same-origin requests (when frontend and backend are on same domain)
      if (!origin) {
        return callback(null, true);
      }
      if (
        allowedOrigins.some((allowed) => {
          if (typeof allowed === "string") return origin === allowed;
          if (allowed instanceof RegExp) return allowed.test(origin);
          return false;
        })
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});
```

**2) 방 관리 (77-98줄)**

```javascript
// server/server.js:77-98
socket.on("join-room", (roomId) => {
  socket.join(roomId);

  if (!rooms.has(roomId)) {
    rooms.set(roomId, []);
  }

  const room = rooms.get(roomId);
  room.push(socket.id);

  console.log(`User ${socket.id} joined room ${roomId}`);
  console.log(`Room ${roomId} now has ${room.length} users`);

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
// server/server.js:100-146
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

// 화면 공유 Offer/Answer/ICE Candidate 전달
socket.on("screen-share-offer", (data) => {
  socket.to(data.target).emit("screen-share-offer", {
    offer: data.offer,
    sender: socket.id,
  });
});

socket.on("screen-share-answer", (data) => {
  socket.to(data.target).emit("screen-share-answer", {
    answer: data.answer,
    sender: socket.id,
  });
});

socket.on("screen-share-ice", (data) => {
  socket.to(data.target).emit("screen-share-ice", {
    candidate: data.candidate,
    sender: socket.id,
  });
});
```

- **역할**: 두 클라이언트 간 Offer/Answer/ICE Candidate를 중계
- **중요**: 시그널링만 담당, 실제 미디어 데이터는 P2P로 직접 전송

**4) 텍스트 채팅 메시지 전달 (149-155줄)**

```javascript
// server/server.js:149-155
socket.on("chat-message", (data) => {
  console.log(
    `Chat message from ${socket.id} to ${data.target}:`,
    data.message
  );
  socket.to(data.target).emit("chat-message", {
    message: data.message,
    sender: socket.id,
  });
});
```

- Socket.io를 통한 텍스트 메시지 중계
- 실시간 메시지 전달

**5) 정적 파일 서빙 (63-68줄)**

```javascript
// server/server.js:63-68
// Serve static files from React build (for production/ngrok)
const buildPath = path.join(__dirname, "../client/build");
if (require("fs").existsSync(buildPath)) {
  app.use(express.static(buildPath));
  console.log("Serving React build from:", buildPath);
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

### 6. **텍스트 채팅**

- Socket.io를 통한 실시간 메시지 교환
- 통화 중에도 채팅 가능
- 메시지 구분 및 타임스탬프 표시

### 7. **ngrok 통합**

- 프론트엔드와 백엔드를 같은 포트에서 서빙
- 하나의 ngrok 터널로 외부 접근 가능

---

## 💡 발표 시 강조할 점

1. **WebRTC의 P2P 특성**: 서버를 거치지 않는 직접 통신
2. **시그널링 vs 미디어**: 시그널링만 서버 경유, 미디어는 P2P
3. **모바일 지원**: TURN 서버를 통한 LTE 네트워크 지원
4. **실시간성**: Socket.io를 통한 즉각적인 메시지 교환
5. **실시간 미디어 제어**: 통화 중 비디오/오디오 켜기/끄기 기능
6. **텍스트 채팅**: 통화 중 실시간 텍스트 메시지 교환
7. **확장성**: 다중 사용자 지원 가능한 구조

---

## 🚀 개선 가능한 부분

1. **에러 핸들링**: 연결 실패 시 재시도 로직
2. **다중 사용자**: 1:N 화상 회의 지원
3. **화질 조절**: 네트워크 상태에 따른 자동 조절
4. **녹화 기능**: MediaRecorder API 활용
5. **파일 전송**: RTCDataChannel을 활용한 파일 공유

---

## 🌐 ngrok을 이용한 배포 동작 방식

### 📋 ngrok이란?

**ngrok**은 로컬 서버를 인터넷에 공개할 수 있게 해주는 터널링 서비스입니다.

- 로컬호스트(`localhost`)는 외부에서 접근할 수 없습니다
- ngrok이 로컬 서버를 HTTPS URL로 공개합니다
- 예: `https://xxxx-xx-xx-xx-xx.ngrok-free.dev`

### 🏗️ ngrok 배포 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    인터넷 (Internet)                     │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         ngrok 서버 (ngrok.com)                  │    │
│  │  https://xxxx-xx-xx-xx-xx.ngrok-free.dev       │    │
│  └──────────────┬─────────────────────────────────┘    │
│                 │                                        │
│                 │ HTTPS 터널                            │
│                 │                                        │
└─────────────────┼────────────────────────────────────────┘
                  │
        ┌─────────▼─────────┐
        │   로컬 컴퓨터      │
        │  (개발자 PC)       │
        │                    │
        │  ┌──────────────┐ │
        │  │  ngrok 클라이언트│ │
        │  │  (터널링)     │ │
        │  └──────┬───────┘ │
        │         │         │
        │  ┌──────▼───────┐ │
        │  │  Node.js 서버 │ │
        │  │  (포트 5001)  │ │
        │  │              │ │
        │  │  - Express   │ │
        │  │  - Socket.io │ │
        │  │  - React 빌드 │ │
        │  └──────────────┘ │
        └───────────────────┘
```

### 🔄 ngrok 배포 시 동작 흐름

#### **1단계: 서버 준비 및 빌드**

```bash
# React 앱 빌드
cd client
npm run build

# 백엔드 서버 실행 (빌드 파일 포함)
cd ../server
npm start
```

**무슨 일이 일어나나요?**

- React 앱이 `client/build/` 폴더에 빌드됩니다
- 백엔드 서버가 포트 5001에서 실행됩니다
- 백엔드가 `client/build/` 폴더를 정적 파일로 서빙합니다
- 이제 `http://localhost:5001`에서 프론트엔드와 백엔드 모두 접근 가능합니다

#### **2단계: ngrok 터널 생성**

```bash
ngrok http 5001
```

**ngrok이 하는 일:**

```
로컬 포트 5001 → ngrok 서버 → 공개 HTTPS URL
```

**결과:**

- ngrok이 `https://xxxx-xx-xx-xx-xx.ngrok-free.dev` URL을 생성합니다
- 이 URL은 로컬 포트 5001로 트래픽을 전달합니다
- 외부에서 이 URL로 접근하면 로컬 서버에 연결됩니다

#### **3단계: 클라이언트 접속**

**사용자가 ngrok URL로 접속:**

```
https://xxxx-xx-xx-xx-xx.ngrok-free.dev
```

**동작 과정:**

```
1. 사용자 브라우저
   ↓ HTTPS 요청
2. ngrok 서버 (ngrok.com)
   ↓ 터널링 (HTTPS → HTTP)
3. 로컬 ngrok 클라이언트
   ↓ 포트 포워딩
4. 로컬 Node.js 서버 (포트 5001)
   ↓
5. Express가 React 빌드 파일 서빙
   ↓
6. 브라우저에 React 앱 로드
```

#### **4단계: Socket.io 연결**

**프론트엔드 코드 (5-40줄):**

```javascript
// client/src/App.js:5-40
const getServerUrl = () => {
  // ngrok URL 감지
  const isNgrok =
    window.location.hostname.includes("ngrok") ||
    window.location.hostname.includes("ngrok-free.dev");

  if (isNgrok) {
    // 같은 ngrok URL 사용 (프론트엔드와 백엔드가 같은 도메인)
    return window.location.origin;
  }

  return "http://localhost:5001";
};

const SERVER_URL = getServerUrl();
// ngrok 사용 시: https://xxxx-xx-xx-xx-xx.ngrok-free.dev
```

**Socket.io 연결:**

```
브라우저 → ngrok URL → 로컬 서버 (포트 5001)
```

**백엔드 CORS 설정 (10-16줄):**

```javascript
// server/server.js:10-16
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
  /https:\/\/.*\.ngrok-free\.dev/, // ngrok 도메인 허용
  /https:\/\/.*\.ngrok\.io/,
].filter(Boolean);
```

#### **5단계: WebRTC 연결**

**중요한 점:**

- **시그널링**: ngrok을 통해 전달 (서버 경유)
- **미디어 스트림**: P2P 직접 연결 (ngrok을 거치지 않음)

```
[사용자 A]                    [ngrok]                    [사용자 B]
   |                            |                           |
   |-- Socket.io 연결 --------->|                           |
   |                            |-- 로컬 서버 (5001)        |
   |                            |                           |
   |-- Offer/Answer/ICE ------>|                           |
   |                            |<-- Offer/Answer/ICE ------|
   |                            |                           |
   |========== P2P 직접 연결 ==========|
   |                            |                           |
   |<======== 비디오/오디오 직접 전송 ========>|
   |                            |                           |
   (ngrok은 더 이상 관여하지 않음)
```

### 🎯 ngrok 배포의 핵심 포인트

#### **1. Same-Origin 정책 활용**

**프론트엔드와 백엔드를 같은 ngrok URL에서 서빙:**

- 프론트엔드: `https://xxxx.ngrok-free.dev/` (React 앱)
- 백엔드: `https://xxxx.ngrok-free.dev/` (Socket.io, API)
- **같은 도메인**이므로 CORS 문제 없음
- **같은 도메인**이므로 쿠키/인증 공유 가능

#### **2. HTTPS 자동 제공**

**ngrok의 장점:**

- 로컬 서버는 HTTP지만, ngrok이 HTTPS를 제공합니다
- WebRTC의 `getUserMedia`는 HTTPS 또는 localhost에서만 동작합니다
- ngrok을 사용하면 자동으로 HTTPS가 제공됩니다

#### **3. 동적 URL 문제**

**ngrok 무료 계정:**

- ngrok을 재시작하면 URL이 변경됩니다
- 해결책: ngrok 유료 계정 사용 또는 고정 도메인 설정

#### **4. 네트워크 흐름**

```
┌──────────────┐
│  모바일 기기  │
│  (LTE)       │
└──────┬───────┘
       │
       │ HTTPS
       │
┌──────▼──────────────────┐
│  ngrok 서버              │
│  (ngrok.com)             │
└──────┬───────────────────┘
       │
       │ 터널링
       │
┌──────▼──────────────────┐
│  로컬 컴퓨터              │
│  - ngrok 클라이언트       │
│  - Node.js 서버 (5001)    │
│  - React 빌드 파일        │
└──────────────────────────┘
```

### 📊 ngrok vs 일반 배포 비교

| 구분          | ngrok 배포          | 일반 배포 (VPS/클라우드) |
| ------------- | ------------------- | ------------------------ |
| **서버 위치** | 로컬 컴퓨터         | 원격 서버                |
| **접근성**    | ngrok URL           | 고정 도메인/IP           |
| **비용**      | 무료 (제한적)       | 유료 (서버 비용)         |
| **안정성**    | 낮음 (로컬 PC 의존) | 높음 (24/7 운영)         |
| **용도**      | 개발/테스트/데모    | 프로덕션                 |
| **HTTPS**     | 자동 제공           | 별도 설정 필요           |

### ⚠️ ngrok 배포 시 주의사항

1. **로컬 컴퓨터가 켜져 있어야 함**

   - ngrok은 로컬 서버를 터널링하는 것이므로
   - 로컬 컴퓨터가 꺼지면 서비스가 중단됩니다

2. **인터넷 연결 필요**

   - 로컬 컴퓨터의 인터넷 연결이 필요합니다
   - ngrok 서버와의 연결이 끊기면 서비스가 중단됩니다

3. **무료 계정 제한**

   - 동시 터널 1개만 가능
   - URL이 재시작 시 변경됨
   - 트래픽 제한이 있을 수 있음

4. **보안 고려사항**
   - ngrok URL은 누구나 접근 가능합니다
   - 인증/보안을 추가로 구현해야 합니다

### 🚀 실제 배포 시나리오

**시나리오: 친구와 화상 통화 (ngrok 사용)**

1. **개발자가 서버 실행**

   ```bash
   cd server
   npm start  # 포트 5001에서 실행
   ```

2. **ngrok 터널 생성**

   ```bash
   ngrok http 5001
   # 결과: https://abc123.ngrok-free.dev
   ```

3. **친구 A 접속**

   - 브라우저에서 `https://abc123.ngrok-free.dev` 접속
   - React 앱이 로드됨
   - Socket.io가 같은 URL로 연결됨
   - "room1" 방에 입장

4. **친구 B 접속**

   - 같은 URL로 접속
   - "room1" 방에 입장
   - WebRTC 연결 시작

5. **통화 시작**
   - 시그널링: ngrok을 통해 전달
   - 미디어: P2P 직접 연결 (ngrok 거치지 않음)

### 💡 ngrok 배포의 장단점

**✅ 장점:**

- 빠른 배포 (서버 구축 불필요)
- HTTPS 자동 제공
- 개발/테스트에 적합
- 무료로 시작 가능

**❌ 단점:**

- 로컬 PC 의존성
- URL 변경 가능성
- 트래픽 제한
- 프로덕션에는 부적합

---

**발표 준비 완료! 화이팅! 🎉**
