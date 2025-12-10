const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

// CORS 설정 - localhost 및 ngrok 도메인 허용
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
  /https:\/\/.*\.ngrok-free\.dev/,
  /https:\/\/.*\.ngrok\.io/,
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // 같은 출처 요청 허용 (프론트엔드와 백엔드가 같은 도메인에 있을 때)
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

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
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
    credentials: true,
  })
);
app.use(express.json());

// React 빌드에서 정적 파일 제공 (프로덕션/ngrok용)
const buildPath = path.join(__dirname, "../client/build");
if (require("fs").existsSync(buildPath)) {
  app.use(express.static(buildPath));
  console.log("Serving React build from:", buildPath);
}

// 활성 방 저장
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 방 입장
  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }

    const room = rooms.get(roomId);
    room.push(socket.id);

    console.log(`User ${socket.id} joined room ${roomId}`);
    console.log(`Room ${roomId} now has ${room.length} users`);

    // 방의 다른 사용자들에게 알림
    socket.to(roomId).emit("user-joined", socket.id);

    // 새 사용자에게 기존 사용자 목록 전송
    const otherUsers = room.filter((id) => id !== socket.id);
    if (otherUsers.length > 0) {
      socket.emit("existing-users", otherUsers);
    }
  });

  // WebRTC offer 처리
  socket.on("offer", (data) => {
    socket.to(data.target).emit("offer", {
      offer: data.offer,
      sender: socket.id,
    });
  });

  // WebRTC answer 처리
  socket.on("answer", (data) => {
    socket.to(data.target).emit("answer", {
      answer: data.answer,
      sender: socket.id,
    });
  });

  // ICE candidate 처리
  socket.on("ice-candidate", (data) => {
    socket.to(data.target).emit("ice-candidate", {
      candidate: data.candidate,
      sender: socket.id,
    });
  });

  // 화면 공유 offer 처리
  socket.on("screen-share-offer", (data) => {
    socket.to(data.target).emit("screen-share-offer", {
      offer: data.offer,
      sender: socket.id,
    });
  });

  // 화면 공유 answer 처리
  socket.on("screen-share-answer", (data) => {
    socket.to(data.target).emit("screen-share-answer", {
      answer: data.answer,
      sender: socket.id,
    });
  });

  // 화면 공유 ICE candidate 처리
  socket.on("screen-share-ice", (data) => {
    socket.to(data.target).emit("screen-share-ice", {
      candidate: data.candidate,
      sender: socket.id,
    });
  });

  // 채팅 메시지 처리
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

  // 연결 해제 처리
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // 모든 방에서 사용자 제거
    rooms.forEach((users, roomId) => {
      const index = users.indexOf(socket.id);
      if (index > -1) {
        users.splice(index, 1);
        socket.to(roomId).emit("user-left", socket.id);

        // 빈 방 정리
        if (users.length === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

// 모든 비-API 라우트에 React 앱 제공 (SPA 라우팅)
app.get("*", (req, res) => {
  const buildPath = path.join(__dirname, "../client/build/index.html");
  if (require("fs").existsSync(buildPath)) {
    res.sendFile(buildPath);
  } else {
    res
      .status(404)
      .send("React build not found. Run 'npm run build' in client directory.");
  }
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`Serving frontend and backend from the same server`);
});
