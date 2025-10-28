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

// ----------------------------
// 🔁 Restaurar sesión si existe
// ----------------------------
const saved = sessionStorage.getItem("chatData");
if (saved) {
  const data = JSON.parse(saved);
  ({ room, name, email } = data);
  socket.emit("join", data);
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
});

// ----------------------------
// 💬 Recibir historial y mostrar chat
// ----------------------------
socket.on("history", (history) => {
  joinSection.classList.add("hidden");
  chatSection.classList.remove("hidden");
  messages.innerHTML = "";
  history.forEach(appendMessage);

  // 🚨 Agregar botones de llamada solo una vez
  if (!document.getElementById("voiceCallBtn")) {
    const callButtons = document.createElement("div");
    callButtons.style.display = "flex";
    callButtons.style.justifyContent = "center";
    callButtons.style.gap = "10px";
    callButtons.style.margin = "10px 0";
    callButtons.innerHTML = `
      <button id="voiceCallBtn">📞 Llamar</button>
      <button id="videoCallBtn">🎥 Videollamada</button>
    `;
    chatSection.insertBefore(callButtons, messages);

    document.getElementById("voiceCallBtn").addEventListener("click", () => startCall(false));
    document.getElementById("videoCallBtn").addEventListener("click", () => startCall(true));
  }
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

// ----------------------------
// 🧩 Service Worker y notificaciones
// ----------------------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("✅ Service Worker registrado"))
    .catch(err => console.error("❌ Error al registrar SW:", err));
}

if ("Notification" in window) {
  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      console.log("🔔 Permiso de notificaciones concedido");
    } else {
      console.warn("🚫 Notificaciones bloqueadas");
    }
  });
}

// ----------------------------
// 📞 Llamadas y videollamadas con WebRTC
// ----------------------------
let localStream, remoteStream, peerConnection;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const videoContainer = document.createElement("div");
videoContainer.style.display = "none";
videoContainer.style.position = "fixed";
videoContainer.style.top = "0";
videoContainer.style.left = "0";
videoContainer.style.width = "100%";
videoContainer.style.height = "100%";
videoContainer.style.background = "rgba(0,0,0,0.8)";
videoContainer.style.justifyContent = "center";
videoContainer.style.alignItems = "center";
videoContainer.style.flexDirection = "column";
videoContainer.style.zIndex = "2000";
videoContainer.innerHTML = `
  <video id="localVideo" autoplay muted playsinline style="width: 150px; border-radius: 10px; position: absolute; top: 10px; right: 10px;"></video>
  <video id="remoteVideo" autoplay playsinline style="width: 90%; border-radius: 12px;"></video>
  <button id="hangUpBtn" style="margin-top: 15px; background:red; color:white; border:none; padding:10px 20px; border-radius:8px;">Colgar</button>
`;
document.body.appendChild(videoContainer);

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const hangUpBtn = document.getElementById("hangUpBtn");
hangUpBtn.addEventListener("click", endCall);

async function startCall(withVideo) {
  try {
    videoContainer.style.display = "flex";
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

socket.on("offer", async (data) => {
  try {
    videoContainer.style.display = "flex";
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
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (err) {
      console.error("Error al agregar candidato ICE:", err);
    }
  }
});

function endCall() {
  videoContainer.style.display = "none";
  if (peerConnection) peerConnection.close();
  peerConnection = null;
  localStream?.getTracks().forEach(track => track.stop());
  remoteStream = null;
}
