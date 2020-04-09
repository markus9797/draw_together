const express = require('express');
const socket = require('socket.io');

const app = express();  // init server
const server = app.listen(process.env.PORT || 3000 );  // run server

const io = socket(server);  // init socket


io.sockets.on('connection', newConnection);

function newConnection(socket) {

    socket.on('mouse', (data)=>{
        socket.broadcast.emit('mouse', data);
    });
}