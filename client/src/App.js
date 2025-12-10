import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";

// 서버 URL 설정
// 프론트엔드와 백엔드가 같은 출처에서 제공되는 경우 (ngrok을 통해),
// 서버 URL에 같은 출처 사용
const getServerUrl = () => {
  // 명시적으로 환경 변수가 설정된 경우 사용
  if (process.env.REACT_APP_SERVER_URL) {
    return process.env.REACT_APP_SERVER_URL;
  }

  // 프로덕션 빌드에서 실행 중인 경우 (백엔드에서 제공), 같은 출처 사용
  // 백엔드가 React 빌드를 제공할 때 작동
  if (
    process.env.NODE_ENV === "production" ||
    window.location.port === "5001"
  ) {
    return window.location.origin;
  }

  // 프론트엔드가 ngrok에 있는 경우, 백엔드도 같은 ngrok URL에 있어야 함
  // (백엔드가 프론트엔드를 제공할 때)
  const isNgrok =
    window.location.hostname.includes("ngrok") ||
    window.location.hostname.includes("ngrok-free.dev");

  if (isNgrok) {
    // 백엔드와 프론트엔드가 같은 ngrok URL에 있음
    return window.location.origin;
  }

  // 로컬 개발을 위한 기본값 (별도 포트)
  return "http://localhost:5001";
};

const SERVER_URL = getServerUrl();
console.log("Frontend URL:", window.location.origin);
console.log("Connecting to backend:", SERVER_URL);

// 모바일 연결을 위한 STUN 및 TURN 서버가 포함된 ICE 설정
const getIceConfiguration = () => {
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // TURN 서버 추가 (모바일 LTE에 필요)
  const turnServer = process.env.REACT_APP_TURN_SERVER;
  const turnUsername = process.env.REACT_APP_TURN_USERNAME;
  const turnCredential = process.env.REACT_APP_TURN_CREDENTIAL;

  if (turnServer) {
    iceServers.push({
      urls: turnServer,
      username: turnUsername || undefined,
      credential: turnCredential || undefined,
    });
  } else {
    // 무료 공개 TURN 서버 (속도 제한이 있을 수 있음)
    // 프로덕션에서는 Twilio, Metered, Cloudflare 같은 유료 TURN 서비스 사용 권장
    iceServers.push(
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
      }
    );
  }

  return { iceServers };
};

function App() {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenVideoRef = useRef(null);

  const peerConnectionRef = useRef(null);
  const screenPeerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const remoteUserIdRef = useRef(null);
  const socketRef = useRef(null);
  const chatMessagesRef = useRef(null);

  useEffect(() => {
    // 소켓 연결 초기화
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);
    socketRef.current = newSocket;

    // 소켓 이벤트 핸들러
    newSocket.on("user-joined", (userId) => {
      console.log("User joined:", userId);
      remoteUserIdRef.current = userId;
      // 기존 사용자는 새 사용자로부터 offer를 기다림
      createPeerConnection(userId, false);
    });

    newSocket.on("existing-users", (userIds) => {
      console.log("Existing users:", userIds);
      if (userIds.length > 0) {
        remoteUserIdRef.current = userIds[0];
        // 새 사용자가 offer 생성
        createPeerConnection(userIds[0], true);
      }
    });

    newSocket.on("user-left", (userId) => {
      console.log("User left:", userId);
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (screenPeerConnectionRef.current) {
        screenPeerConnectionRef.current.close();
        screenPeerConnectionRef.current = null;
      }
      remoteUserIdRef.current = null;
      setIsCallActive(false);
      setIsScreenSharing(false);
    });

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

    newSocket.on("screen-share-offer", async (data) => {
      console.log("Received screen share offer from:", data.sender);
      await handleScreenShareOffer(data.offer, data.sender);
    });

    newSocket.on("screen-share-answer", async (data) => {
      console.log("Received screen share answer from:", data.sender);
      await handleScreenShareAnswer(data.answer);
    });

    newSocket.on("screen-share-ice", async (data) => {
      console.log("Received screen share ICE candidate from:", data.sender);
      await handleScreenShareIce(data.candidate);
    });

    // 채팅 메시지 핸들러
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

  // 스트림이 사용 가능할 때 로컬 비디오 업데이트
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current && joined) {
      localVideoRef.current.srcObject = localStreamRef.current;
      console.log("Local video stream assigned to element");

      // 비디오 재생 보장
      localVideoRef.current.play().catch((err) => {
        console.error("Error playing local video:", err);
      });
    }
  }, [joined]);

  // 스트림이 사용 가능할 때 화면 공유 비디오 업데이트
  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current) {
      // 로컬 화면 공유 스트림이 있으면 사용
      if (screenStreamRef.current && !screenVideoRef.current.srcObject) {
        console.log("Setting local screen share stream in useEffect");
        screenVideoRef.current.srcObject = screenStreamRef.current;
        screenVideoRef.current.play().catch((err) => {
          console.error("Error playing screen share in useEffect:", err);
        });
      }
    }
  }, [isScreenSharing]);

  // 채팅 메시지 자동 스크롤
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

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
      console.log("Local stream obtained:", stream);
      // useEffect가 비디오 요소에 할당 처리
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      alert("카메라와 마이크 접근 권한이 필요합니다.");
      return null;
    }
  };

  const createPeerConnection = async (
    targetUserId,
    shouldCreateOffer = false
  ) => {
    try {
      const configuration = getIceConfiguration();

      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // 로컬 스트림 트랙 추가
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // 원격 스트림 처리
      pc.ontrack = (event) => {
        console.log("Received remote stream");
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsCallActive(true);
        }
      };

      // ICE candidate 처리
      pc.onicecandidate = (event) => {
        if (event.candidate && targetUserId && socketRef.current) {
          socketRef.current.emit("ice-candidate", {
            target: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // 연결 상태 변경 처리
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed"
        ) {
          setIsCallActive(false);
        }
      };

      // 초기화자인 경우 offer 생성 및 전송
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

  const handleOffer = async (offer, senderId) => {
    try {
      if (!peerConnectionRef.current) {
        await createPeerConnection(senderId);
      }

      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      if (socketRef.current) {
        socketRef.current.emit("answer", {
          target: senderId,
          answer: answer,
        });
      }
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  };

  const handleAnswer = async (answer) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  };

  const handleIceCandidate = async (candidate) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  };

  const createScreenShareConnection = async (
    targetUserId,
    shouldCreateOffer = true
  ) => {
    try {
      // 기존 연결이 있으면 닫기
      if (screenPeerConnectionRef.current) {
        screenPeerConnectionRef.current.close();
      }

      const configuration = getIceConfiguration();

      const pc = new RTCPeerConnection(configuration);
      screenPeerConnectionRef.current = pc;

      // 화면 공유 스트림 트랙 추가 (공유 중인 경우에만)
      if (shouldCreateOffer && screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, screenStreamRef.current);
          console.log("Added screen share track:", track.kind);
        });
      }

      // 원격 화면 공유 스트림 처리
      pc.ontrack = (event) => {
        console.log("Received remote screen share stream", event.streams);
        console.log("Stream tracks:", event.streams[0]?.getTracks());
        if (event.streams && event.streams.length > 0) {
          const stream = event.streams[0];
          console.log(
            "Remote screen share stream received, setting to video element"
          );
          // 원격 스트림을 받을 때 화면 공유 섹션 표시
          setIsScreenSharing(true);

          // 비디오 요소가 렌더링될 때까지 조금 대기
          setTimeout(() => {
            if (screenVideoRef.current) {
              console.log("Assigning remote screen share to video element");
              screenVideoRef.current.srcObject = stream;
              screenVideoRef.current.play().catch((err) => {
                console.error("Error playing screen share video:", err);
              });
              console.log("Screen share video should now be visible");
            } else {
              console.warn("Screen video ref not available");
            }
          }, 100);
        }
      };

      // 연결 상태 처리
      pc.onconnectionstatechange = () => {
        console.log("Screen share connection state:", pc.connectionState);
      };

      // ICE candidate 처리
      pc.onicecandidate = (event) => {
        if (event.candidate && targetUserId && socketRef.current) {
          socketRef.current.emit("screen-share-ice", {
            target: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // 초기화하는 경우에만 offer 생성 및 전송
      if (shouldCreateOffer) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socketRef.current) {
          socketRef.current.emit("screen-share-offer", {
            target: targetUserId,
            offer: offer,
          });
        }
      }

      return pc;
    } catch (error) {
      console.error("Error creating screen share connection:", error);
      return null;
    }
  };

  const handleScreenShareOffer = async (offer, senderId) => {
    try {
      console.log("Handling screen share offer from:", senderId);
      // offer를 전송하지 않고 연결 생성 (받는 중)
      if (!screenPeerConnectionRef.current) {
        console.log("Creating screen share connection to receive offer");
        await createScreenShareConnection(senderId, false);
      }

      const pc = screenPeerConnectionRef.current;
      if (!pc) {
        console.error("Screen share peer connection not available");
        return;
      }

      // 원격 설명을 설정하기 전에 연결 상태 확인
      console.log("Screen share connection state:", pc.signalingState);
      if (pc.signalingState === "stable") {
        console.log("Setting remote description for screen share offer");
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log("Remote description set, creating answer...");
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("Screen share answer created and sent");

        if (socketRef.current) {
          socketRef.current.emit("screen-share-answer", {
            target: senderId,
            answer: answer,
          });
        }
      } else {
        console.warn(
          "Cannot set remote description, connection in state:",
          pc.signalingState
        );
        // 유효한 상태라면 어쨌든 설정 시도
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (socketRef.current) {
            socketRef.current.emit("screen-share-answer", {
              target: senderId,
              answer: answer,
            });
          }
        } catch (err) {
          console.error("Failed to handle screen share offer:", err);
        }
      }
    } catch (error) {
      console.error("Error handling screen share offer:", error);
    }
  };

  const handleScreenShareAnswer = async (answer) => {
    try {
      const pc = screenPeerConnectionRef.current;
      if (!pc) {
        console.error("Screen share peer connection not available");
        return;
      }

      // 연결 상태 확인 - 원격 answer를 설정하려면 'have-local-offer' 상태여야 함
      if (pc.signalingState === "have-local-offer") {
        console.log("Setting remote description for screen share answer");
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } else {
        console.warn(
          "Cannot set remote answer, connection in state:",
          pc.signalingState
        );
        // stable 상태인 경우, 로컬 offer를 설정하기 전에 answer가 도착했을 수 있음
        // 어쨌든 설정 시도 (경쟁 조건에서 발생할 수 있음)
        if (pc.signalingState === "stable") {
          console.log(
            "Attempting to set remote answer in stable state (race condition)"
          );
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          } catch (err) {
            console.error("Failed to set remote answer:", err);
          }
        }
      }
    } catch (error) {
      console.error("Error handling screen share answer:", error);
    }
  };

  const handleScreenShareIce = async (candidate) => {
    try {
      if (screenPeerConnectionRef.current) {
        await screenPeerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      }
    } catch (error) {
      console.error("Error handling screen share ICE candidate:", error);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomId.trim()) {
      alert("방 ID를 입력해주세요.");
      return;
    }

    const stream = await getLocalStream();
    if (!stream) {
      console.error("Failed to get local stream");
      return;
    }

    console.log("Stream obtained, joining room:", roomId);
    if (socketRef.current) {
      socketRef.current.emit("join-room", roomId);
      setJoined(true);
      // 비디오 요소가 렌더링되도록 작은 지연
      setTimeout(() => {
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch((err) => {
            console.error("Error playing video:", err);
          });
        }
      }, 100);
    }
  };

  const handleLeaveRoom = () => {
    // 모든 트랙 중지
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // 피어 연결 닫기
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (screenPeerConnectionRef.current) {
      screenPeerConnectionRef.current.close();
      screenPeerConnectionRef.current = null;
    }

    // 비디오 요소 초기화
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }

    if (socketRef.current) {
      socketRef.current.emit("leave-room", roomId);
    }
    setJoined(false);
    setIsCallActive(false);
    setIsScreenSharing(false);
    setMessages([]);
    setMessageInput("");
    localStreamRef.current = null;
    screenStreamRef.current = null;
    remoteUserIdRef.current = null;
  };

  const handleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        console.log("Starting screen share...");
        // 화면 공유 시작
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

        // 비디오 요소가 렌더링될 때까지 조금 대기
        setTimeout(() => {
          if (screenVideoRef.current) {
            console.log("Assigning local screen share to video element");
            screenVideoRef.current.srcObject = stream;
            screenVideoRef.current.play().catch((err) => {
              console.error("Error playing local screen share:", err);
            });
          } else {
            console.warn("Screen video ref not available yet");
          }
        }, 100);

        // 상태가 설정된 후 화면 공유 피어 연결 생성
        if (remoteUserIdRef.current) {
          console.log(
            "Creating screen share connection for:",
            remoteUserIdRef.current
          );
          await createScreenShareConnection(remoteUserIdRef.current, true);
        } else {
          console.warn("No remote user ID available for screen share");
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
      if (error.name !== "NotAllowedError" && error.name !== "AbortError") {
        alert("화면 공유를 시작할 수 없습니다: " + error.message);
      }
    }
  };

  const handleStopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (screenPeerConnectionRef.current) {
      screenPeerConnectionRef.current.close();
      screenPeerConnectionRef.current = null;
    }

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }

    setIsScreenSharing(false);
  };

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

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (
      !messageInput.trim() ||
      !socketRef.current ||
      !remoteUserIdRef.current
    ) {
      return;
    }

    const messageData = {
      target: remoteUserIdRef.current,
      message: messageInput.trim(),
    };

    socketRef.current.emit("chat-message", messageData);

    // 자신의 메시지를 채팅에 추가
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

  return (
    <div className="App">
      <div className="container">
        <h1 className="title">🎥 WebRTC 1:1 화상 채팅</h1>

        {!joined ? (
          <div className="join-section">
            <div className="input-group">
              <input
                type="text"
                placeholder="방 ID를 입력하세요"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
                className="room-input"
              />
              <button onClick={handleJoinRoom} className="btn btn-primary">
                방 입장
              </button>
            </div>
            <p className="info-text">
              같은 방 ID를 사용하면 연결됩니다. (예: "room1")
            </p>
          </div>
        ) : (
          <div className="video-section">
            <div className="video-container">
              <div className="video-wrapper">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="video local-video"
                />
                <div className="video-label">나</div>
              </div>

              <div className="video-wrapper">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="video remote-video"
                />
                <div className="video-label">상대방</div>
                {!isCallActive && (
                  <div className="waiting-overlay">
                    <p>상대방을 기다리는 중...</p>
                  </div>
                )}
              </div>
            </div>

            {isScreenSharing && (
              <div className="screen-share-container">
                <h3>화면 공유</h3>
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  muted={false}
                  className="screen-video"
                  style={{
                    width: "100%",
                    maxWidth: "800px",
                    backgroundColor: "#000",
                  }}
                />
              </div>
            )}

            {/* 채팅 섹션 */}
            <div className="chat-container">
              <h3>💬 채팅</h3>
              <div className="chat-messages" ref={chatMessagesRef}>
                {messages.length === 0 ? (
                  <p className="chat-empty">메시지가 없습니다.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`chat-message ${msg.isOwn ? "own" : "other"}`}
                    >
                      <div className="message-content">{msg.text}</div>
                      <div className="message-time">
                        {msg.timestamp.toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendMessage} className="chat-input-form">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  className="chat-input"
                  disabled={!remoteUserIdRef.current}
                />
                <button
                  type="submit"
                  className="btn btn-primary chat-send-btn"
                  disabled={!messageInput.trim() || !remoteUserIdRef.current}
                >
                  전송
                </button>
              </form>
            </div>

            <div className="controls">
              <button
                onClick={handleToggleVideo}
                className={`btn ${
                  isVideoEnabled ? "btn-secondary" : "btn-danger"
                }`}
                title={isVideoEnabled ? "비디오 끄기" : "비디오 켜기"}
              >
                {isVideoEnabled ? "📹 비디오 끄기" : "📹 비디오 켜기"}
              </button>
              <button
                onClick={handleToggleAudio}
                className={`btn ${
                  isAudioEnabled ? "btn-secondary" : "btn-danger"
                }`}
                title={isAudioEnabled ? "오디오 끄기" : "오디오 켜기"}
              >
                {isAudioEnabled ? "🎤 오디오 끄기" : "🎤 오디오 켜기"}
              </button>
              <button
                onClick={handleScreenShare}
                className={`btn ${
                  isScreenSharing ? "btn-danger" : "btn-secondary"
                }`}
              >
                {isScreenSharing ? "🖥️ 화면 공유 중지" : "🖥️ 화면 공유"}
              </button>
              <button onClick={handleLeaveRoom} className="btn btn-danger">
                📞 통화 종료
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
