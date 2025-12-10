const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

// CORS configuration - allow localhost and ngrok domains
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
  /https:\/\/.*\.ngrok-free\.dev/,
  /https:\/\/.*\.ngrok\.io/,
].filter(Boolean);

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

// Serve static files from React build (for production/ngrok)
const buildPath = path.join(__dirname, "../client/build");
if (require("fs").existsSync(buildPath)) {
  app.use(express.static(buildPath));
  console.log("Serving React build from:", buildPath);
}

// Store active rooms
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join a room
  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }

    const room = rooms.get(roomId);
    room.push(socket.id);

    console.log(`User ${socket.id} joined room ${roomId}`);
    console.log(`Room ${roomId} now has ${room.length} users`);

    // Notify others in the room
    socket.to(roomId).emit("user-joined", socket.id);

    // Send list of existing users to the new user
    const otherUsers = room.filter((id) => id !== socket.id);
    if (otherUsers.length > 0) {
      socket.emit("existing-users", otherUsers);
    }
  });

  // Handle WebRTC offer
  socket.on("offer", (data) => {
    socket.to(data.target).emit("offer", {
      offer: data.offer,
      sender: socket.id,
    });
  });

  // Handle WebRTC answer
  socket.on("answer", (data) => {
    socket.to(data.target).emit("answer", {
      answer: data.answer,
      sender: socket.id,
    });
  });

  // Handle ICE candidate
  socket.on("ice-candidate", (data) => {
    socket.to(data.target).emit("ice-candidate", {
      candidate: data.candidate,
      sender: socket.id,
    });
  });

  // Handle screen share offer
  socket.on("screen-share-offer", (data) => {
    socket.to(data.target).emit("screen-share-offer", {
      offer: data.offer,
      sender: socket.id,
    });
  });

  // Handle screen share answer
  socket.on("screen-share-answer", (data) => {
    socket.to(data.target).emit("screen-share-answer", {
      answer: data.answer,
      sender: socket.id,
    });
  });

  // Handle screen share ICE candidate
  socket.on("screen-share-ice", (data) => {
    socket.to(data.target).emit("screen-share-ice", {
      candidate: data.candidate,
      sender: socket.id,
    });
  });

  // Handle chat message
  socket.on("chat-message", (data) => {
    console.log(`Chat message from ${socket.id} to ${data.target}:`, data.message);
    socket.to(data.target).emit("chat-message", {
      message: data.message,
      sender: socket.id,
    });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Remove user from all rooms
    rooms.forEach((users, roomId) => {
      const index = users.indexOf(socket.id);
      if (index > -1) {
        users.splice(index, 1);
        socket.to(roomId).emit("user-left", socket.id);

        // Clean up empty rooms
        if (users.length === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

// Serve React app for all non-API routes (SPA routing)
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
