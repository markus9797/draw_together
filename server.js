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
    players: [],
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
            word: 'eine ameise',
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

    socket.on('createGame', function(data) {
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
        Game.players = users.slice(0); // copy users into game instance
        Game.maxTime = data.max_time;
        Game.rounds = data.rounds;

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
        if (!checkGame())
            return false;
        current_game.stop();
        current_game = null;
        users = [];
    });

    socket.on('pickWord', function(word) {
        if (!checkGame())
            return false;
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
        if (checkGame()) {
            current_game.chat.push(message);
            current_game.guess(users[users.indexOf(socket)], message.text);
        }
    });

    socket.on('disconnect', function() {
        let i = users.indexOf(socket);
        if (i !== -1) {
            const username = users[i].username;
            users.splice(i, 1);
            console.log('Got disconnect! ', username);
            socket.broadcast.emit('removeUser', username);
        }
        if (checkGame()) {
            if (current_game.players.includes(socket)) //todo: replace username with sess id
                current_game.playerLeave(socket);
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
        if(checkGame()) {
            socket.emit('loaded', current_game.lines);
            socket.emit('loadedChat', current_game.chat);
            socket.emit('loadedDrawer', users[current_game.current_player].username);
            socket.emit('loadedScores', current_game.scores);

            let data = {
                rounds: current_game.rounds,
                max_time:  current_game.maxTime
            };

            socket.emit('loadedSetup', data);
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
        if (checkGame())
            current_game.delete(socket);
    });

    socket.on('undo', (scale)=>{
        if (checkGame())
            current_game.undo(socket, scale);
    });


    socket.on('mouse', (line)=> {
        if (checkGame())
            current_game.paint(line, socket);
    });
}

function checkGame(){ //check if a game is currently active (todo: and available)
    if (current_game === null)
        return false;
    else if (current_game.finished) {
        current_game = null;
        return false;
    }
    else
        return true;
}