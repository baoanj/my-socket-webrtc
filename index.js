const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const port = process.env.PORT || 3030

app.use(express.static(__dirname + '/public'))

io.on('connection', socket => {
  // sending to all clients except sender
  socket.on('drawing', data => socket.broadcast.emit('drawing', data))

  // sending to all connected clients
  socket.on('chating', data => io.emit('chating', data))

  socket.on('offer', data => socket.broadcast.emit('offer', data))

  socket.on('answer', data => socket.broadcast.emit('answer', data))

  socket.on('candidate', data => socket.broadcast.emit('candidate', data))
})

http.listen(port, () => console.log('listening on port ' + port))
