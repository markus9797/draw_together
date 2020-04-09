const express = require('express');
const socket = require('socket.io');

const app = express();  // init server
const server = app.listen(process.env.PORT || 3000 );  // run server

const io = socket(server);  // init socket

let users = []; // connected users
let lines = []; // store the current painting


io.sockets.on('connection', newConnection);

function newConnection(socket) {

    users.push(socket);

    socket.on('load', ()=>{
        socket.emit('loaded', lines);
    });

    socket.on('delete', ()=>{
        lines = [];
        socket.broadcast.emit('deleted');
    });

    socket.on('mouse', (data)=>{
        socket.broadcast.emit('mouse', data);
        lines.push(data);
    });
}