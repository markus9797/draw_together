const express = require('express');
const socket = require('socket.io');

const app = express();  // init server
const server = app.listen(process.env.PORT || 3000 );  // run server

const io = socket(server);  // init socket

let users = []; // connected users
let ellipses = []; // store the current painting


io.sockets.on('connection', newConnection);

function newConnection(socket) {

    users.push(socket);

    socket.on('load', ()=>{
        console.log("sending load data...", ellipses)
        socket.emit('loaded', ellipses);
    });

    socket.on('mouse', (data)=>{
        socket.broadcast.emit('mouse', data);
        ellipses.push(data);
    });
}