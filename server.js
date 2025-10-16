// server.js 💞 Chat privado simple con persistencia en JSON
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'mensajes.json');

// Servir carpeta pública
app.use(express.static('public'));

// Leer historial al iniciar
let rooms = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    rooms = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Error leyendo mensajes.json:', err);
    rooms = {};
  }
}

// Guardar en JSON
function saveMessages() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(rooms, null, 2));
}

// Conexión de sockets
io.on('connection', (socket) => {
  console.log('🩷 Nuevo usuario conectado:', socket.id);

  socket.on('join', ({ room, password, email, name }) => {
    // Control de acceso
    if (!rooms[room]) {
      rooms[room] = { password, messages: [] };
    } else if (rooms[room].password !== password) {
      socket.emit('errorMsg', 'Contraseña incorrecta para esta sala 💔');
      return;
    }

    socket.join(room);
    socket.data = { room, email, name };

    // Enviar historial existente
    socket.emit('history', rooms[room].messages);

    // Avisar a los demás
    socket.to(room).emit('system', {
      text: `${name} se ha unido 💕`,
      time: new Date().toISOString()
    });
  });

  // Mensaje nuevo
  socket.on('chat message', ({ room, email, name, text }) => {
    const msg = { email, name, text, time: new Date().toISOString() };
    rooms[room].messages.push(msg);
    if (rooms[room].messages.length > 200) rooms[room].messages.shift(); // Limite
    saveMessages();
    io.to(room).emit('chat message', msg);
  });

  // Indicador de escritura
  socket.on('typing', (room) => {
    socket.to(room).emit('typing', socket.data.name);
  });
  socket.on('stop typing', (room) => {
    socket.to(room).emit('stop typing', socket.data.name);
  });

  socket.on('disconnect', () => {
    const { room, name } = socket.data || {};
    if (room && name) {
      socket.to(room).emit('system', {
        text: `${name} ha salido 🕊️`,
        time: new Date().toISOString()
      });
    }
    console.log('❌ Usuario desconectado:', socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
