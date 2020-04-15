const express = require('express');
const socket = require('socket.io');

const {drawGame} = require('./drawGame');

//require('dotenv').config(); // todo: remove in production

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
    maxTime: 60,
    wordlist: [
        {
            word: 'hippogreif',
            category: 'funny',
            author: 'Julia'
        },
        {
            word: 'himbeere',
            category: 'normal',
            author: 'Markus'
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

    // users.push(socket);

    socket.on('createGame', function(maxtime = 60) {
        Game.started = true;
        // put player who started on pos 1 (host);
        let i = users.indexOf(socket);
        let temp = users[i];
        users[i] = users[0];
        users[0] = temp;

        console.log(users[i].username, "Starting new Game with host: ", users[0].username, " \n Total players: ", users.length);

        Game.host = users[0];
        Game.socket = socket;
        Game.sockets = io.sockets;
        Game.players = users;

        // set first drawer to the person who started the game (todo: order array new)
        Game.drawer = users.indexOf(socket);

        // notify everbody the game has started
        io.sockets.emit('lobby', false);

        //create new game instance
        current_game = new drawGame(Game);
        let words = current_game.wordPicker();

        socket.emit('pickWords', words);
        io.sockets.emit('loadedDrawer', users[current_game.current_player].username);
    });

    socket.on('stopGame', function(){
        io.sockets.emit('gameStopped');
        users = [];
        current_game = null;
    });

    socket.on('pickWord', function(word) {
        console.log("current word: ", word.word);
        current_game.wordPicked(word);
        let data = {
            author: word.author,
            category: word.category,
            length: word.word.length,
            time: current_game.maxTime
        };
        socket.emit('drawTimer', current_game.maxTime);
    });


    socket.on('sendMsg', function(message) {
       current_game.chat.push(message);
       current_game.guess(users[users.indexOf(socket)], message.text);
    });

    socket.on('disconnect', function() {
        let i = users.indexOf(socket);
        if (i !== -1) {
            const username = users[i].username;
            users.splice(i, 1);
            console.log('Got disconnect! ', username);
            socket.broadcast.emit('removeUser', username);
        }
    });

    socket.on('join', (data)=>{

        users.push(socket);
        console.log('got connect! ', data.username);
        let i = users.indexOf(socket);
        users[i].username = data.username;
        socket.broadcast.emit('addUser', data.username);
    });

    socket.on('load', ()=>{
        if(current_game !== null) {
            socket.emit('loaded', current_game.lines);
            socket.emit('loadedChat', current_game.chat);
            socket.emit('loadedDrawer', users[current_game.current_player].username);
            socket.emit('loadedScores', current_game.scores);
            socket.emit('lobby', false);
        }

        else{
            socket.emit('lobby', true);
        }

        let user_names = [];
        for (let u in users){
            user_names.push(users[u].username);
        }
        socket.emit('loadedUsers', user_names);

    });

    socket.on('delete', ()=>{
        current_game.lines = [];
        socket.broadcast.emit('deleted');
    });

    socket.on('undo', ()=>{
        let distance = 0;
        let threshhold = 200;

        while (distance < threshhold){
            let line = current_game.lines.pop();
            let dx = line.x - line.px;
            let dy = line.y - line.py;
            distance += Math.hypot(dx, dy);
        }

        socket.broadcast.emit('deleted');
        socket.broadcast.emit('loaded', current_game.lines);
    });


    socket.on('mouse', (data)=> {
        let i = users.indexOf(socket);
        try {
            if (i === current_game.current_player) {
                socket.broadcast.emit('mouse', data);
                current_game.lines.push(data);
            }
            else {
                socket.emit('notAllowed');
            }
        } catch (e) {
            console.log(e);
        }
    });
}