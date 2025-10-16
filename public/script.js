const socket = io();
const joinSection = document.getElementById("joinSection");
const chatSection = document.getElementById("chatSection");
const roomInput = document.getElementById("room");
const passInput = document.getElementById("password");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const joinBtn = document.getElementById("joinBtn");

const messages = document.getElementById("messages");
const typingEl = document.getElementById("typing");
const messageInput = document.getElementById("text");
const form = document.getElementById("form");
const notifySound = document.getElementById("notifySound");

let room, name, email;
let typingTimeout;

// Entrar a la sala
joinBtn.addEventListener("click", () => {
  room = roomInput.value.trim();
  name = nameInput.value.trim();
  email = emailInput.value.trim();
  const password = passInput.value.trim();

  if (!room || !name || !email || !password) {
    alert("Por favor completa todos los campos 💫");
    return;
  }

  socket.emit("join", { room, password, email, name });
});

// Recibir error de contraseña
socket.on("errorMsg", (msg) => alert(msg));

// Una vez dentro
socket.on("history", (history) => {
  joinSection.classList.add("hidden");
  chatSection.classList.remove("hidden");
  messages.innerHTML = "";
  history.forEach(appendMessage);
});

// Mensajes nuevos
socket.on("chat message", (msg) => {
  appendMessage(msg);
  if (msg.email !== email) notifySound.play();
});

// Mensajes del sistema
socket.on("system", ({ text, time }) => {
  const sys = document.createElement("div");
  sys.className = "message other";
  sys.style.textAlign = "center";
  sys.style.background = "transparent";
  sys.textContent = `${text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

// Indicador de escritura
socket.on("typing", (who) => {
  typingEl.textContent = `${who} está escribiendo...`;
});
socket.on("stop typing", () => {
  typingEl.textContent = "";
});

// Enviar mensaje
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit("chat message", { room, email, name, text });
  messageInput.value = "";
  socket.emit("stop typing", room);
});

// Detectar escritura
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
