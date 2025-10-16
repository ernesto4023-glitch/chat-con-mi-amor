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

socket.on("chat message", (msg) => {
  appendMessage(msg);
  if (msg.email !== email) notifySound.play();
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
