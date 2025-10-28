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

const voiceCallBtn = document.getElementById("voiceCallBtn");
const videoCallBtn = document.getElementById("videoCallBtn");
const hangUpBtn = document.getElementById("hangUpBtn");
const videoContainer = document.getElementById("videoContainer");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let room, name, email;
let typingTimeout;
let localStream, remoteStream, peerConnection;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ----------------------------
// 🔁 Restaurar sesión si existe
// ----------------------------
const saved = sessionStorage.getItem("chatData");
if (saved) {
  const data = JSON.parse(saved);
  ({ room, name, email } = data);
  socket.emit("join", data);
  joinSection.classList.add("hidden");
  chatSection.classList.remove("hidden");
}

// ----------------------------
// 🚪 Salir
// ----------------------------
exitBtn.addEventListener("click", () => {
  sessionStorage.removeItem("chatData");
  chatSection.classList.add("hidden");
  joinSection.classList.remove("hidden");
  socket.disconnect();
  location.reload();
});

// ----------------------------
// 🎟️ Entrar a sala
// ----------------------------
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

  joinSection.classList.add("hidden");
  chatSection.classList.remove("hidden");
});

// ----------------------------
// 💬 Recibir historial y mostrar chat
// ----------------------------
socket.on("history", (history) => {
  messages.innerHTML = "";
  history.forEach(appendMessage);
});

// ----------------------------
// 📩 Recibir mensajes
// ----------------------------
socket.on("chat message", (msg) => {
  appendMessage(msg);

  if (msg.email !== email) {
    notifySound.play();
    if (Notification.permission === "granted") {
      const notification = new Notification(`💌 Nuevo mensaje de ${msg.name}`, {
        body: msg.text,
        icon: "/icon-192.png"
      });
      notification.onclick = () => window.focus();
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

// ----------------------------
// 💬 Enviar mensajes
// ----------------------------
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

// ----------------------------
// Función para mostrar mensaje
// ----------------------------
function appendMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(msg.email === email ? "you" : "other");
  div.textContent = `${msg.name}: ${msg.text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// ----------------------------
// 🧩 Service Worker y notificaciones
// ----------------------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("✅ Service Worker registrado"))
    .catch(err => console.error("❌ Error al registrar SW:", err));
}

if ("Notification" in window) {
  Notification.requestPermission();
}

// ----------------------------
// 📞 Llamadas y videollamadas con WebRTC
// ----------------------------
voiceCallBtn.addEventListener("click", () => startCall(false));
videoCallBtn.addEventListener("click", () => startCall(true));
hangUpBtn.addEventListener("click", endCall);

async function startCall(withVideo) {
  try {
    videoContainer.classList.remove("hidden");
    localStream = await navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    remoteStream = new MediaStream();
    peerConnection.ontrack = event => {
      event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
      remoteVideo.srcObject = remoteStream;
    };

    peerConnection.onicecandidate = event => {
      if (event.candidate) socket.emit("candidate", { room, candidate: event.candidate });
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", { room, offer });

  } catch (err) {
    console.error("Error al iniciar llamada:", err);
    alert("No se pudo acceder a la cámara o micrófono 😢");
  }
}

// Señalización WebRTC
socket.on("offer", async (data) => {
  try {
    videoContainer.classList.remove("hidden");

    peerConnection = new RTCPeerConnection(config);
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    remoteStream = new MediaStream();
    peerConnection.ontrack = event => {
      event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
      remoteVideo.srcObject = remoteStream;
    };

    peerConnection.onicecandidate = event => {
      if (event.candidate) socket.emit("candidate", { room, candidate: event.candidate });
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { room, answer });

  } catch (err) {
    console.error("Error al recibir la oferta:", err);
  }
});

socket.on("answer", async (data) => {
  if (!peerConnection) return;
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on("candidate", async (data) => {
  if (peerConnection && data.candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

function endCall() {
  videoContainer.classList.add("hidden");
  if (peerConnection) peerConnection.close();
  peerConnection = null;
  localStream?.getTracks().forEach(track => track.stop());
  remoteStream = null;
}
