const socket = io()

/************************** draw **************************/

const canvas = document.getElementById('draw')
const whiteboard = document.querySelector('.whiteboard')
canvas.width = whiteboard.offsetWidth
canvas.height = whiteboard.offsetHeight
const context = canvas.getContext('2d')
const current = { color: 'red' }
let drawing = false

canvas.addEventListener('mousedown', onMouseDown, false)
canvas.addEventListener('mouseup', onMouseUp, false)
canvas.addEventListener('mouseout', onMouseUp, false)
canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false)

//Touch support for mobile devices
canvas.addEventListener('touchstart', onMouseDown, false)
canvas.addEventListener('touchend', onMouseUp, false)
canvas.addEventListener('touchcancel', onMouseUp, false)
canvas.addEventListener('touchmove', throttle(onMouseMove, 10), false)

socket.on('drawing', onDrawingEvent)

function onDrawingEvent(data) {
  var w = canvas.width
  var h = canvas.height
  drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h)
}

function drawLine(x0, y0, x1, y1, emit) {
  context.beginPath()
  context.moveTo(x0, y0)
  context.lineTo(x1, y1)
  context.strokeStyle = current.color
  context.lineWidth = 2
  context.stroke()
  context.closePath()

  if (!emit) return
  var w = canvas.width
  var h = canvas.height
  socket.emit('drawing', {
    x0: x0 / w,
    y0: y0 / h,
    x1: x1 / w,
    y1: y1 / h
  })
}

function onMouseDown(e) {
  drawing = true
  current.x = e.offsetX || e.changedTouches[0].pageX - canvas.offsetLeft
  current.y = e.offsetY || e.changedTouches[0].pageY - canvas.offsetTop
}

function onMouseUp(e) {
  if (!drawing) return
  drawing = false
  drawLine(
    current.x,
    current.y,
    e.offsetX || e.changedTouches[0].pageX - canvas.offsetLeft,
    e.offsetY || e.changedTouches[0].pageY - canvas.offsetTop,
    true
  )
}

function onMouseMove(e) {
  if (!drawing) return
  drawLine(
    current.x,
    current.y,
    e.offsetX || e.changedTouches[0].pageX - canvas.offsetLeft,
    e.offsetY || e.changedTouches[0].pageY - canvas.offsetTop,
    true
  )
  current.x = e.offsetX || e.changedTouches[0].pageX - canvas.offsetLeft
  current.y = e.offsetY || e.changedTouches[0].pageY - canvas.offsetTop
}

// limit the number of events per second
function throttle(callback, delay) {
  var previousCall = new Date().getTime()
  return function () {
    var time = new Date().getTime()

    if (time - previousCall >= delay) {
      previousCall = time
      callback.apply(null, arguments)
    }
  }
}

/************************** chat **************************/

const chat = document.querySelector('.chat')
const msg = document.querySelector('#msg')
const send = document.querySelector('#send')

send.addEventListener('click', onSendMsg, false)

socket.on('chating', onChatingEvent)

function onChatingEvent(data) {
  const li = document.createElement('li')
  li.textContent = data
  chat.appendChild(li)
}

function onSendMsg() {
  socket.emit('chating', msg.value)
  msg.value = ''
}

/************************** video **************************/

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
