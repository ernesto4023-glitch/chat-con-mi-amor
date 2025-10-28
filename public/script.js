//---------------------------------------------//
// 📞 Llamadas y videollamadas con WebRTC
//---------------------------------------------//

let localStream;
let remoteStream;
let peerConnection;

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" } // servidor STUN gratuito
  ]
};

// 🎥 Crear contenedores de video
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

// 📞 Botones de llamada
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
      if (event.candidate) {
        socket.emit("candidate", { room, candidate: event.candidate });
      }
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
      if (event.candidate) {
        socket.emit("candidate", { room, candidate: event.candidate });
      }
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
