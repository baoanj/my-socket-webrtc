const socket = io()
const localVideo = document.getElementById('local-video')
const remoteVideo = document.getElementById('remote-video')
let pc, receive

async function startVideoTalk() {
  createPeerConnection()
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  })
  localVideo.srcObject = stream
  stream.getTracks().forEach(track => pc.addTrack(track, stream))
}

function createPeerConnection() {
  const iceConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.xten.com' },
      { urls: 'stun:stun.ekiga.net' }
    ]
  }
  pc = new RTCPeerConnection(iceConfig)
  pc.onnegotiationneeded = onnegotiationneeded
  pc.onicecandidate = onicecandidate
  pc.ontrack = ontrack
}

async function onnegotiationneeded() {
  if (receive) return
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  socket.emit('offer', offer)
}

function onicecandidate(evt) {
  if (evt.candidate) socket.emit('candidate', evt.candidate)
}

function ontrack(evt) {
  remoteVideo.srcObject = evt.streams[0]
}

socket.on('offer', handleReceiveOffer)

async function handleReceiveOffer(offer) {
  receive = true
  await startVideoTalk()

  const remoteDescription = new RTCSessionDescription(offer)
  await pc.setRemoteDescription(remoteDescription)

  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  socket.emit('answer', answer)
}

socket.on('answer', handleReceiveAnswer)

async function handleReceiveAnswer(answer) {
  const remoteDescription = new RTCSessionDescription(answer)
  await pc.setRemoteDescription(remoteDescription)
}

socket.on('candidate', handleReceiveCandidate)

async function handleReceiveCandidate(candidate, n = 10) {
  if (n === 0) return
  if (!pc || !pc.remoteDescription.type) {
    setTimeout(() => {
      handleReceiveCandidate(candidate, n - 1)
    }, 500)
    return
  }
  await pc.addIceCandidate(new RTCIceCandidate(candidate))
}
