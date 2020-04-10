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
        let i = users.indexOf(socket);
        const username = users[i].username;
        users.splice(i, 1);

        console.log('Got disconnect! ', username);

        socket.broadcast.emit('removeUser', username);
    });

    socket.on('join', (data)=>{

        console.log('got connect! ', data.username);

        let i = users.indexOf(socket);
        users[i].username = data.username;
        socket.broadcast.emit('addUser', data.username);
    });

    socket.on('load', ()=>{
        socket.emit('loaded', lines);
        let user_names = [];
        for (let u in users){
            user_names.push(users[u].username);
            console.log(users[u].username);
        }
        socket.emit('loadedUsers', user_names);
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