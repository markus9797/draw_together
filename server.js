const express = require('express');
const socket = require('socket.io');

const {drawGame} = require('./drawGame');

const app = express();  // init server
const server = app.listen(process.env.PORT || 3000 );  // run server

const io = socket(server);  // init socket

let users = []; // connected users
let lines = []; // store the current painting

let Chat = [];

let Game = {
    started: false,
    chat: [],
    lines: [],
    host: null,
    rounds: 5,
    drawer: 0,
    maxTime: 5,
    wordlist: [
        {
            word: 'amgelo',
            category: 'funny',
            author: 'Markus'
        },
        {
            word: 'himbeere',
            category: 'normal',
            author: 'Herbert'
        },
        {
            word: 'bärtierchen',
            category: 'speziell',
            author: 'Lucas'
        }
    ]
};

let current_game = null;


io.sockets.on('connection', newConnection);

function newConnection(socket) {

    users.push(socket);

    socket.on('createGame', function() {
        Game.started = true;
        Game.host = users[0]; //todo: get host from emit data
        Game.socket = socket;
        Game.sockets = io.sockets;
        socket.broadcast.emit('gameCreated');
        //create new game instance
        current_game = new drawGame(Game);
        let words = current_game.wordPicker();
        socket.emit('pickWords', words);
    });


    socket.on('pickWord', function(word) {
        console.log("current word: ", word.word);
        current_game.wordPicked(word);
    });


    socket.on('sendMsg', function(message) {
       Game.chat.push(message);

        socket.broadcast.emit('getMsg', message);
    });

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
        socket.emit('loaded', Game.lines);

        let user_names = [];
        for (let u in users){
            user_names.push(users[u].username);
            console.log(users[u].username);
        }
        socket.emit('loadedUsers', user_names);
        socket.emit('loadedChat', Game.chat);

        let i = users.indexOf(socket);
        if (i === Game.drawer) {
            socket.emit('setDrawer');
        }

        socket.emit('loadedDrawer', users[Game.drawer].username);

    });

    socket.on('delete', ()=>{
        Game.lines = [];
        socket.broadcast.emit('deleted');
    });

    socket.on('mouse', (data)=>{
        let i = users.indexOf(socket);
        if (i === Game.drawer) {
            socket.broadcast.emit('mouse', data);
            Game.lines.push(data);
        }
        else {
            socket.emit('notAllowed');
        }
    });
}