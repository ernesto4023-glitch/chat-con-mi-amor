const socket = io();
const joinSection = document.getElementById("joinSection");
const chatSection = document.getElementById("chatSection");
const roomInput = document.getElementById("room");
const passInput = document.getElementById("password");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const joinBtn = document.getElementById("joinBtn");
const exitBtn = document.getElementById("exitBtn");

const messages = document.getElementById("messages");
const typingEl = document.getElementById("typing");
const messageInput = document.getElementById("text");
const form = document.getElementById("form");
const notifySound = document.getElementById("notifySound");

let room, name, email;
let typingTimeout;

// 🔁 Restaurar sesión si existe
const saved = sessionStorage.getItem("chatData");
if (saved) {
  const data = JSON.parse(saved);
  ({ room, name, email } = data);
  socket.emit("join", data);
}

// 🚪 Salir
exitBtn.addEventListener("click", () => {
  sessionStorage.removeItem("chatData");
  chatSection.classList.add("hidden");
  joinSection.classList.remove("hidden");
  socket.disconnect();
  location.reload();
});

// 🎟️ Entrar a sala
joinBtn.addEventListener("click", () => {
  room = roomInput.value.trim();
  name = nameInput.value.trim();
  email = emailInput.value.trim();
  const password = passInput.value.trim();

  if (!room || !name || !email || !password) {
    alert("Completa todos los campos 💫");
    return;
  }

  const data = { room, password, name, email };
  sessionStorage.setItem("chatData", JSON.stringify(data));
  socket.emit("join", data);
});

socket.on("history", (history) => {
  joinSection.classList.add("hidden");
  chatSection.classList.remove("hidden");
  messages.innerHTML = "";
  history.forEach(appendMessage);
});

// 📩 Recibir mensajes y mostrar notificación
socket.on("chat message", (msg) => {
  appendMessage(msg);

  if (msg.email !== email) {
    // 🔊 Reproducir sonido
    notifySound.play();

    // 🔔 Mostrar notificación del sistema
    if (Notification.permission === "granted") {
      const notification = new Notification(`💌 Nuevo mensaje de ${msg.name}`, {
        body: msg.text,
        icon: "/icon-192.png" // asegúrate de tener este ícono en tu carpeta public/
      });

      // Si el usuario hace clic en la notificación, enfoca el chat
      notification.onclick = () => {
        window.focus();
      };
    }
  }
});

socket.on("system", ({ text }) => {
  const sys = document.createElement("div");
  sys.className = "message other";
  sys.style.textAlign = "center";
  sys.style.background = "transparent";
  sys.textContent = text;
  messages.appendChild(sys);
  messages.scrollTop = messages.scrollHeight;
});

socket.on("typing", (who) => (typingEl.textContent = `${who} está escribiendo...`));
socket.on("stop typing", () => (typingEl.textContent = ""));

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit("chat message", { room, email, name, text });
  messageInput.value = "";
  socket.emit("stop typing", room);
});

messageInput.addEventListener("input", () => {
  socket.emit("typing", room);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit("stop typing", room), 1000);
});

function appendMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(msg.email === email ? "you" : "other");
  div.textContent = `${msg.name}: ${msg.text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// 🧩 Registrar el Service Worker y pedir permiso de notificación
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("✅ Service Worker registrado"))
    .catch(err => console.error("❌ Error al registrar SW:", err));
}

// 🔔 Pedir permiso para notificaciones al cargar
if ("Notification" in window) {
  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      console.log("🔔 Permiso de notificaciones concedido");
    } else {
      console.warn("🚫 Notificaciones bloqueadas");
    }
  });
}

// 📲 Mostrar botón "Instalar App" cuando esté disponible
let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Crear el botón
  const btn = document.createElement("button");
  btn.textContent = "📲 Instalar App";
  btn.classList.add("install-btn");

  // Opcional: estiliza el botón
  btn.style.position = "fixed";
  btn.style.bottom = "20px";
  btn.style.right = "20px";
  btn.style.padding = "10px 15px";
  btn.style.background = "#ff4081";
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.borderRadius = "10px";
  btn.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "16px";
  btn.style.zIndex = "1000";

  document.body.appendChild(btn);

  // Evento de instalación
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`🧩 Resultado de instalación: ${outcome}`);
    deferredPrompt = null;
    btn.remove();
  });
});


