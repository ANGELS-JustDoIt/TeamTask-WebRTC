import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";

// Server URL configuration
// When frontend and backend are served from the same origin (via ngrok),
// use the same origin for the server URL
const getServerUrl = () => {
  // Use explicit environment variable if set
  if (process.env.REACT_APP_SERVER_URL) {
    return process.env.REACT_APP_SERVER_URL;
  }

  // If running in production build (served from backend), use same origin
  // This works when backend serves the React build
  if (
    process.env.NODE_ENV === "production" ||
    window.location.port === "5001"
  ) {
    return window.location.origin;
  }

  // If frontend is on ngrok, backend should be on same ngrok URL
  // (when backend serves the frontend)
  const isNgrok =
    window.location.hostname.includes("ngrok") ||
    window.location.hostname.includes("ngrok-free.dev");

  if (isNgrok) {
    // Backend and frontend are on same ngrok URL
    return window.location.origin;
  }

  // Default to localhost for local development (separate ports)
  return "http://localhost:5001";
};

const SERVER_URL = getServerUrl();
console.log("Frontend URL:", window.location.origin);
console.log("Connecting to backend:", SERVER_URL);

// ICE configuration with STUN and TURN servers for mobile connectivity
const getIceConfiguration = () => {
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // Add TURN servers if configured (required for mobile LTE)
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
    // Free public TURN servers (may have rate limits)
    // For production, use a paid TURN service like Twilio, Metered, or Cloudflare
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
    // Initialize socket connection
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);
    socketRef.current = newSocket;

    // Socket event handlers
    newSocket.on("user-joined", (userId) => {
      console.log("User joined:", userId);
      remoteUserIdRef.current = userId;
      // Existing user waits for offer from new user
      createPeerConnection(userId, false);
    });

    newSocket.on("existing-users", (userIds) => {
      console.log("Existing users:", userIds);
      if (userIds.length > 0) {
        remoteUserIdRef.current = userIds[0];
        // New user creates the offer
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

    // Chat message handler
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

  // Update local video when stream is available
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current && joined) {
      localVideoRef.current.srcObject = localStreamRef.current;
      console.log("Local video stream assigned to element");

      // Ensure video plays
      localVideoRef.current.play().catch((err) => {
        console.error("Error playing local video:", err);
      });
    }
  }, [joined]);

  // Update screen share video when stream is available
  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current) {
      // If we have a local screen share stream, use it
      if (screenStreamRef.current && !screenVideoRef.current.srcObject) {
        console.log("Setting local screen share stream in useEffect");
        screenVideoRef.current.srcObject = screenStreamRef.current;
        screenVideoRef.current.play().catch((err) => {
          console.error("Error playing screen share in useEffect:", err);
        });
      }
    }
  }, [isScreenSharing]);

  // Auto-scroll chat messages
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
      // The useEffect will handle assigning to video element
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

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log("Received remote stream");
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsCallActive(true);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && targetUserId && socketRef.current) {
          socketRef.current.emit("ice-candidate", {
            target: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed"
        ) {
          setIsCallActive(false);
        }
      };

      // Create and send offer if we're the initiator
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
      // Close existing connection if any
      if (screenPeerConnectionRef.current) {
        screenPeerConnectionRef.current.close();
      }

      const configuration = getIceConfiguration();

      const pc = new RTCPeerConnection(configuration);
      screenPeerConnectionRef.current = pc;

      // Add screen share stream tracks (only if we're sharing)
      if (shouldCreateOffer && screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, screenStreamRef.current);
          console.log("Added screen share track:", track.kind);
        });
      }

      // Handle remote screen share stream
      pc.ontrack = (event) => {
        console.log("Received remote screen share stream", event.streams);
        console.log("Stream tracks:", event.streams[0]?.getTracks());
        if (event.streams && event.streams.length > 0) {
          const stream = event.streams[0];
          console.log(
            "Remote screen share stream received, setting to video element"
          );
          // Show screen share section when receiving remote stream
          setIsScreenSharing(true);

          // Wait a bit for the video element to be rendered
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

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log("Screen share connection state:", pc.connectionState);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && targetUserId && socketRef.current) {
          socketRef.current.emit("screen-share-ice", {
            target: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Create and send offer only if we're initiating
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
      // Create connection without sending offer (we're receiving one)
      if (!screenPeerConnectionRef.current) {
        console.log("Creating screen share connection to receive offer");
        await createScreenShareConnection(senderId, false);
      }

      const pc = screenPeerConnectionRef.current;
      if (!pc) {
        console.error("Screen share peer connection not available");
        return;
      }

      // Check connection state before setting remote description
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
        // Try to set it anyway if we're in a valid state
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

      // Check connection state - should be 'have-local-offer' to set remote answer
      if (pc.signalingState === "have-local-offer") {
        console.log("Setting remote description for screen share answer");
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } else {
        console.warn(
          "Cannot set remote answer, connection in state:",
          pc.signalingState
        );
        // If we're in stable state, the answer might have arrived before we set local offer
        // Try to set it anyway (this might happen in race conditions)
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
      // Small delay to ensure video element is rendered
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
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close peer connections
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (screenPeerConnectionRef.current) {
      screenPeerConnectionRef.current.close();
      screenPeerConnectionRef.current = null;
    }

    // Clear video elements
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
        // Start screen sharing
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

        // Wait a bit for the video element to be rendered
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

        // Create screen share peer connection after state is set
        if (remoteUserIdRef.current) {
          console.log(
            "Creating screen share connection for:",
            remoteUserIdRef.current
          );
          await createScreenShareConnection(remoteUserIdRef.current, true);
        } else {
          console.warn("No remote user ID available for screen share");
        }

        // Handle screen share end
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
    if (!messageInput.trim() || !socketRef.current || !remoteUserIdRef.current) {
      return;
    }

    const messageData = {
      target: remoteUserIdRef.current,
      message: messageInput.trim(),
    };

    socketRef.current.emit("chat-message", messageData);

    // Add own message to chat
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

            {/* Chat Section */}
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
