const express = require('express');
const socket = require('socket.io');

const app = express();  // init server
const server = app.listen(process.env.PORT || 3000 );  // run server

const io = socket(server);  // init socket

let users = []; // connected users
let lines = []; // store the current painting

let Players = [];

io.sockets.on('connection', newConnection);

function newConnection(socket) {

    users.push(socket);

    socket.on('disconnect', function() {
        console.log('Got disconnect!');
        const username = users[socket].username;
        let i = users.indexOf(socket);
        users.splice(i, 1);

        socket.broadcast.emit('removeUser', username);
    });

    socket.on('join', (username)=>{
        users[socket].username = username;
        socket.broadcast.emit('addUser', username)
    });

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