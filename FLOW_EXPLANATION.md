# WebRTC 화상 채팅 진행 흐름 가이드

## 📋 전체 흐름 개요

### 1. 브라우저 접속 및 초기화

**이벤트**: 페이지 로드  
**App.js 소스 위치**: 
- **85-106줄**: 컴포넌트 상태 및 ref 초기화
- **108-194줄**: `useEffect` - 컴포넌트 마운트 시 실행

**동작 내용**:
- **110줄**: Socket.IO 서버 연결 (`io(SERVER_URL)`)
- **112줄**: 소켓을 `socketRef.current`에 저장
- **115-189줄**: 소켓 이벤트 핸들러 등록
  - `user-joined`: 다른 사용자 입장 알림 (115줄)
  - `existing-users`: 기존 사용자 목록 수신 (122줄)
  - `user-left`: 사용자 퇴장 알림 (131줄)
  - `offer`: WebRTC offer 수신 (146줄)
  - `answer`: WebRTC answer 수신 (151줄)
  - `ice-candidate`: ICE candidate 수신 (156줄)
  - `screen-share-offer`: 화면 공유 offer 수신 (161줄)
  - `screen-share-answer`: 화면 공유 answer 수신 (166줄)
  - `screen-share-ice`: 화면 공유 ICE candidate 수신 (171줄)
  - `chat-message`: 채팅 메시지 수신 (177줄)

**서버 측 (server.js)**:
- **73-74줄**: 클라이언트 연결 시 `connection` 이벤트 발생

---

### 2. 방 ID 입력 및 방 입장 클릭

**이벤트**: "방 입장" 버튼 클릭 또는 Enter 키 입력  
**App.js 소스 위치**: 
- **769줄**: 버튼 클릭 이벤트 → `onClick={handleJoinRoom}`
- **766줄**: Enter 키 입력 → `onKeyPress` 이벤트
- **550-576줄**: `handleJoinRoom` 함수

**동작 순서**:

#### 2-1. 방 ID 유효성 검사
- **551-554줄**: 방 ID가 비어있으면 알림 표시 후 종료

#### 2-2. 로컬 미디어 스트림 획득
- **556줄**: `getLocalStream()` 호출
- **230-249줄**: `getLocalStream` 함수
  - **232-239줄**: `navigator.mediaDevices.getUserMedia()` 호출
    - 카메라 및 마이크 접근 권한 요청
    - 비디오: 1280x720 해상도, 전면 카메라
    - 오디오: 활성화
  - **240줄**: 스트림을 `localStreamRef.current`에 저장
  - **243줄**: 스트림 반환

#### 2-3. 소켓으로 방 입장 이벤트 전송
- **563-564줄**: `socketRef.current.emit("join-room", roomId)` 실행
  - 서버에 방 입장 요청 전송

**서버 측 (server.js)**:
- **77-98줄**: `join-room` 이벤트 처리
  - **78줄**: 소켓을 해당 방에 조인
  - **80-85줄**: 방이 없으면 생성하고 사용자 추가
  - **91줄**: 방의 다른 사용자들에게 `user-joined` 이벤트 전송
  - **94-97줄**: 새 사용자에게 기존 사용자 목록 전송 (`existing-users` 이벤트)

#### 2-4. 상태 업데이트 및 비디오 표시
- **565줄**: `setJoined(true)` - 입장 상태로 변경
- **567-574줄**: 100ms 후 로컬 비디오 요소에 스트림 할당
  - **569줄**: `localVideoRef.current.srcObject = localStreamRef.current`
  - **570줄**: 비디오 재생 시작

#### 2-5. 로컬 비디오 자동 업데이트
- **197-207줄**: `useEffect` - `joined` 상태 변경 감지
  - **199줄**: 로컬 비디오 요소에 스트림 할당
  - **203줄**: 비디오 재생

---

### 3. 다른 사용자와 연결 설정

#### 시나리오 A: 첫 번째 사용자 (방이 비어있음)
- **122-129줄**: `existing-users` 이벤트 수신
  - 기존 사용자가 없으므로 이벤트가 발생하지 않음
  - 상대방을 기다리는 상태로 대기

#### 시나리오 B: 두 번째 사용자 입장 (기존 사용자 있음)

**3-1. 기존 사용자 측 (이미 방에 있음)**
- **115-120줄**: `user-joined` 이벤트 수신
  - **117줄**: `remoteUserIdRef.current = userId` - 상대방 ID 저장
  - **119줄**: `createPeerConnection(userId, false)` 호출
    - `false`: offer를 생성하지 않음 (기존 사용자는 answer를 보냄)

**3-2. 새 사용자 측 (방에 입장 중)**
- **122-129줄**: `existing-users` 이벤트 수신
  - **125줄**: `remoteUserIdRef.current = userIds[0]` - 상대방 ID 저장
  - **127줄**: `createPeerConnection(userIds[0], true)` 호출
    - `true`: offer를 생성함 (새 사용자가 offer를 보냄)

---

### 4. WebRTC Peer Connection 생성

**App.js 소스 위치**: **251-313줄** - `createPeerConnection` 함수

**동작 순서**:

#### 4-1. ICE 설정 및 PeerConnection 생성
- **256줄**: `getIceConfiguration()` 호출
  - **43-83줄**: STUN/TURN 서버 설정 반환
- **258줄**: `new RTCPeerConnection(configuration)` 생성
- **259줄**: `peerConnectionRef.current`에 저장

#### 4-2. 로컬 스트림 트랙 추가
- **262-266줄**: 로컬 스트림의 모든 트랙을 PeerConnection에 추가
  - 비디오 트랙과 오디오 트랙 추가

#### 4-3. 원격 스트림 수신 처리 설정
- **269-275줄**: `pc.ontrack` 이벤트 핸들러
  - **272줄**: 원격 스트림을 `remoteVideoRef.current`에 할당
  - **273줄**: `setIsCallActive(true)` - 통화 활성화

#### 4-4. ICE Candidate 전송 설정
- **278-285줄**: `pc.onicecandidate` 이벤트 핸들러
  - **280-283줄**: ICE candidate가 생성되면 소켓으로 전송
    - `socket.emit("ice-candidate", {target, candidate})`

**서버 측 (server.js)**:
- **117-122줄**: `ice-candidate` 이벤트를 상대방에게 전달

#### 4-5. 연결 상태 모니터링
- **288-296줄**: `pc.onconnectionstatechange` 이벤트 핸들러
  - 연결이 끊기거나 실패하면 `setIsCallActive(false)`

#### 4-6. Offer 생성 및 전송 (새 사용자인 경우)
- **299-306줄**: `shouldCreateOffer === true`인 경우
  - **300줄**: `pc.createOffer()` - offer 생성
  - **301줄**: `pc.setLocalDescription(offer)` - 로컬 설명 설정
  - **302-305줄**: 소켓으로 offer 전송
    - `socket.emit("offer", {target, offer})`

**서버 측 (server.js)**:
- **101-106줄**: `offer` 이벤트를 상대방에게 전달

---

### 5. Offer/Answer 교환

#### 5-1. Offer 수신 및 Answer 생성 (기존 사용자)

**App.js 소스 위치**: **315-336줄** - `handleOffer` 함수

- **146-149줄**: `offer` 이벤트 수신
- **315-336줄**: `handleOffer` 함수 실행
  - **317-319줄**: PeerConnection이 없으면 생성
  - **321-323줄**: 원격 offer를 PeerConnection에 설정
  - **324줄**: Answer 생성
  - **325줄**: 로컬 answer 설정
  - **328-331줄**: 소켓으로 answer 전송
    - `socket.emit("answer", {target, answer})`

**서버 측 (server.js)**:
- **109-114줄**: `answer` 이벤트를 상대방에게 전달

#### 5-2. Answer 수신 (새 사용자)

**App.js 소스 위치**: **338-348줄** - `handleAnswer` 함수

- **151-154줄**: `answer` 이벤트 수신
- **338-348줄**: `handleAnswer` 함수 실행
  - **341-343줄**: 원격 answer를 PeerConnection에 설정

#### 5-3. ICE Candidate 교환

**App.js 소스 위치**: **350-360줄** - `handleIceCandidate` 함수

- **156-159줄**: `ice-candidate` 이벤트 수신
- **350-360줄**: `handleIceCandidate` 함수 실행
  - **353-355줄**: ICE candidate를 PeerConnection에 추가
  - 양방향으로 여러 번 교환됨 (네트워크 경로 탐색)

---

### 6. 비디오 연결 완료

- **269-275줄**: `pc.ontrack` 이벤트 발생
  - 원격 스트림이 수신되면 자동으로 실행
  - **272줄**: 원격 비디오 요소에 스트림 할당
  - **273줄**: `setIsCallActive(true)` - 통화 활성화
  - 화면에 상대방 비디오 표시

---

### 7. 추가 기능들

#### 7-1. 비디오/오디오 토글

**이벤트**: "비디오 끄기/켜기" 또는 "오디오 끄기/켜기" 버튼 클릭  
**App.js 소스 위치**:
- **868-876줄**: 비디오 토글 버튼 → `onClick={handleToggleVideo}`
- **697-707줄**: `handleToggleVideo` 함수
  - **699-705줄**: 비디오 트랙의 `enabled` 속성 토글
- **877-885줄**: 오디오 토글 버튼 → `onClick={handleToggleAudio}`
- **709-719줄**: `handleToggleAudio` 함수
  - **711-717줄**: 오디오 트랙의 `enabled` 속성 토글

#### 7-2. 화면 공유

**이벤트**: "화면 공유" 버튼 클릭  
**App.js 소스 위치**:
- **886-893줄**: 화면 공유 버튼 → `onClick={handleScreenShare}`
- **621-677줄**: `handleScreenShare` 함수

**동작 순서**:
- **626-632줄**: `navigator.mediaDevices.getDisplayMedia()` 호출
  - 화면 공유 권한 요청
- **635줄**: 스트림을 `screenStreamRef.current`에 저장
- **637줄**: `setIsScreenSharing(true)`
- **640-650줄**: 로컬 화면 공유 비디오 표시
- **653-661줄**: 화면 공유용 PeerConnection 생성
  - **362-445줄**: `createScreenShareConnection` 함수
  - 별도의 PeerConnection 사용 (일반 비디오와 분리)
- **664-667줄**: 화면 공유 종료 이벤트 핸들러 등록

**서버 측 (server.js)**:
- **125-146줄**: 화면 공유 관련 이벤트 처리
  - `screen-share-offer`, `screen-share-answer`, `screen-share-ice`

#### 7-3. 채팅 메시지 전송

**이벤트**: 채팅 입력 후 Enter 또는 "전송" 버튼 클릭  
**App.js 소스 위치**:
- **848줄**: 폼 제출 → `onSubmit={handleSendMessage}`
- **721-751줄**: `handleSendMessage` 함수

**동작 순서**:
- **723-729줄**: 메시지 유효성 검사
- **731-734줄**: 메시지 데이터 구성
- **736줄**: 소켓으로 `chat-message` 이벤트 전송
- **739-748줄**: 자신의 메시지를 채팅 목록에 추가
- **750줄**: 입력 필드 초기화

**서버 측 (server.js)**:
- **149-158줄**: `chat-message` 이벤트를 상대방에게 전달

**메시지 수신**:
- **177-189줄**: `chat-message` 이벤트 수신
  - **179-188줄**: 메시지를 채팅 목록에 추가

#### 7-4. 통화 종료

**이벤트**: "통화 종료" 버튼 클릭  
**App.js 소스 위치**:
- **894-896줄**: 통화 종료 버튼 → `onClick={handleLeaveRoom}`
- **578-619줄**: `handleLeaveRoom` 함수

**동작 순서**:
- **580-585줄**: 모든 미디어 트랙 중지
- **588-595줄**: 모든 PeerConnection 닫기
- **598-606줄**: 모든 비디오 요소 초기화
- **609줄**: 소켓으로 `leave-room` 이벤트 전송 (현재는 서버에서 처리 안 함)
- **611-618줄**: 모든 상태 초기화

**서버 측 (server.js)**:
- **161-177줄**: `disconnect` 이벤트 처리
  - **165-176줄**: 모든 방에서 사용자 제거
  - **169줄**: 다른 사용자들에게 `user-left` 이벤트 전송

---

## 🔄 전체 흐름 다이어그램

```
[브라우저 접속]
    ↓
[컴포넌트 마운트]
    ↓
[Socket.IO 연결] (App.js:110)
    ↓
[이벤트 핸들러 등록] (App.js:115-189)
    ↓
[방 ID 입력]
    ↓
[방 입장 클릭] (App.js:769)
    ↓
[미디어 스트림 획득] (App.js:556 → 230-249)
    ↓
[join-room 이벤트 전송] (App.js:564)
    ↓
[서버: 방에 조인] (server.js:77-98)
    ↓
┌─────────────────┬─────────────────┐
│  첫 번째 사용자  │  두 번째 사용자  │
└─────────────────┴─────────────────┘
         │                  │
         │                  ↓
         │      [existing-users 수신] (App.js:122)
         │                  │
         │                  ↓
         │      [PeerConnection 생성] (App.js:127)
         │                  │
         │                  ↓
         │      [Offer 생성 및 전송] (App.js:300-305)
         │                  │
         ↓                  │
[user-joined 수신] (App.js:115) │
         │                  │
         ↓                  │
[PeerConnection 생성] (App.js:119) │
         │                  │
         │                  ↓
         │      [서버: offer 전달] (server.js:101-106)
         │                  │
         ↓                  │
[offer 수신] (App.js:146)   │
         │                  │
         ↓                  │
[Answer 생성 및 전송] (App.js:324-331) │
         │                  │
         │                  ↓
         │      [서버: answer 전달] (server.js:109-114)
         │                  │
         ↓                  │
[answer 수신] (App.js:151)  │
         │                  │
         ↓                  ↓
    [ICE Candidate 교환] (양방향, 여러 번)
         │                  │
         ↓                  ↓
    [비디오 연결 완료] (App.js:269-275)
         │                  │
         ↓                  ↓
    [화상 통화 시작]
```

---

## 📝 주요 이벤트 흐름 요약

| 단계 | 클라이언트 이벤트 | 서버 이벤트 | App.js 줄 번호 | server.js 줄 번호 |
|------|-----------------|------------|---------------|------------------|
| 초기화 | - | connection | 108-194 | 73-74 |
| 방 입장 | emit("join-room") | on("join-room") | 564 | 77 |
| 사용자 알림 | on("user-joined") | emit("user-joined") | 115 | 91 |
| 기존 사용자 목록 | on("existing-users") | emit("existing-users") | 122 | 96 |
| Offer 전송 | emit("offer") | on("offer") | 302 | 101 |
| Answer 전송 | emit("answer") | on("answer") | 328 | 109 |
| ICE Candidate | emit("ice-candidate") | on("ice-candidate") | 280 | 117 |
| 채팅 메시지 | emit("chat-message") | on("chat-message") | 736 | 149 |
| 통화 종료 | - | disconnect | 578-619 | 161 |

---

## 💡 디버깅 팁

1. **소켓 연결 확인**: 브라우저 콘솔에서 "Connecting to backend:" 메시지 확인 (App.js:40)
2. **방 입장 확인**: 서버 콘솔에서 "User {socket.id} joined room {roomId}" 메시지 확인 (server.js:87)
3. **WebRTC 연결 확인**: 브라우저 개발자 도구 → Network → WebRTC 탭에서 연결 상태 확인
4. **이벤트 흐름 확인**: 각 이벤트 핸들러에 `console.log`가 있으므로 콘솔에서 확인 가능

