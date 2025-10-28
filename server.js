// server.js 💞 Chat con persistencia total y salas activas
const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "mensajes.json");

app.use(express.static("public"));
app.use(express.json());

// 📦 Leer y guardar mensajes
function readMessages() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data || "{}");
  } catch (err) {
    console.error("Error leyendo mensajes:", err);
    return {};
  }
}

function saveMessages(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 📄 Obtener todos los mensajes
app.get("/mensajes", (req, res) => {
  const data = readMessages();
  const all = Object.entries(data).flatMap(([room, msgs]) =>
    msgs.map((m) => ({ ...m, room }))
  );
  res.json(all);
});

// 🗑️ Eliminar mensaje o todos
app.delete("/mensajes/:index", (req, res) => {
  const all = readMessages();
  const index = parseInt(req.params.index);

  const allMsgs = Object.entries(all).flatMap(([room, msgs]) =>
    msgs.map((m, i) => ({ ...m, room, idx: i }))
  );

  if (isNaN(index) || index < 0 || index >= allMsgs.length)
    return res.status(400).json({ error: "Índice inválido" });

  const target = allMsgs[index];
  all[target.room].splice(target.idx, 1);
  saveMessages(all);
  res.json({ success: true });
});

app.delete("/mensajes", (req, res) => {
  saveMessages({});
  res.json({ success: true });
});

// 💬 CHAT SOCKET.IO
io.on("connection", (socket) => {
  console.log("🩷 Nuevo usuario conectado:", socket.id);

  socket.on("join", ({ room, password, name, email }) => {
    socket.join(room);
    socket.data = { room, name, email };

    const all = readMessages();
    if (!all[room]) all[room] = [];

    socket.emit("history", all[room]);
    io.to(room).emit("system", { text: `${name} se ha unido 💕` });
  });

  socket.on("chat message", ({ room, name, email, text }) => {
    const msg = {
      name,
      email,
      text,
      hora: new Date().toISOString(),
    };

    const all = readMessages();
    if (!all[room]) all[room] = [];
    all[room].push(msg);
    saveMessages(all);

    io.to(room).emit("chat message", msg);
  });

    // 📞 --- Señalización WebRTC para llamadas ---
  socket.on("offer", (data) => {
    socket.to(data.room).emit("offer", data);
  });

  socket.on("answer", (data) => {
    socket.to(data.room).emit("answer", data);
  });

  socket.on("candidate", (data) => {
    socket.to(data.room).emit("candidate", data);
  });


  socket.on("disconnect", () => {
    if (socket.data?.room && socket.data?.name) {
      io.to(socket.data.room).emit("system", {
        text: `${socket.data.name} salió 💔`,
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
