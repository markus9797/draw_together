class drawGame {

    constructor(init){
        this.rounds = init.rounds;
        this.wordlist = init.wordlist;
        this.maxTime = init.maxTime;
        this.timeLeft = init.maxTime;
        this.current_round = 0;
        this.current_player = 0;
        // this.total_players = 5; //todo: laod from init
        this.time_out = false;
        this.finished = false;
        this.rounds = init.rounds;
        this.current_word = null;
        this.socket = init.socket;
        this.sockets = init.sockets;
        this.lines = [];
        this.actions = [];
        this.chat = [];
        this.scores = {};
        this.players = init.players;
        this.correct_guesses = 0;
        this.total_players = init.players.length;
        this.initScores();
        this.initWordlist();
        this.countdown = null;
        this.disconnects = [];
        this.done = false;
    }

    loadDB(con, callback){
        con.query(`SELECT sk_begriff, category, author.name 
                     FROM skribbl, sk_author as author
                     where skribbl.author = author.ID`, function (error, results, fields) {
            if (error) {
                console.log("Could not connect to database.");
                console.log(error);
                return -1;
            }
            let wordlist_new = [];
            results.forEach(result => {
                let data = {
                    word: result.sk_begriff,
                    category: result.category,
                    author: result.name
                };
                wordlist_new.push(data);
            });
            callback(wordlist_new);
        });
    }

    initWordlist(){
        const mysql = require('mysql');
        const con = mysql.createConnection({
            host: process.env.db_name,
            user: process.env.db_user,
            password: process.env.db_password,
            database : process.env.db_table
        });
        this.loadDB(con, (words)=>{
            console.log ("LOADED WORDS from db");
            this.wordlist = words;
            con.end();
        })
    }

    initScores(){
        for (let p = 0; p < this.total_players; p++){
            this.scores[this.players[p].username] = 0; //todo: change to id, create jwt tokens
        }
        this.sockets.emit('loadedScores', this.scores);
    }

    time_clock(){
        this.countdown = setInterval(()=>{
            this.timeLeft -=1;
            //console.log("Time left: ", this.timeLeft);

            if (this.timeLeft === 0){
                this.tell_word();
                this.round_over(this.countdown);
            }
        }, 1000);
    }

    tell_word(){
        const message = {
            author: "Server",
            text: "Das Wort war " + this.current_word.word + "!",
            color: 'yellow'
        };
        this.sockets.emit("getMsg", message);
    }

    round_over(){
        clearInterval(this.countdown);

        this.sockets.emit("nextRound");
        this.lines = []; //clear game lines - important for undo

        let total_players = this.players.length;

        let done = false;
        do { //skipping d'ced players
            console.log("Skipping ", this.players[this.current_player].username);
            this.current_player ++;

            if (this.current_player >= total_players){
                if (this.current_round >= this.rounds){
                    this.finished = true;
                    done = true;
                    this.gameOver();
                }
                else{
                    this.current_round ++;
                    this.current_player = 0;
                    this.sockets.emit("setRound", this.current_round);
                }
            }

        } while (this.disconnects.includes(this.current_player) && !done);

        if(done)
            return 0;

        this.timeLeft = this.maxTime;
        this.correct_guesses = 0;

        console.log("Current Turn: ", this.players[this.current_player].username);

        console.log("Round: ", this.current_round, " of ", this.rounds);


        this.sockets.emit("loadedDrawer", null);
        this.sockets.emit("timeout");
        this.sockets.emit("deleted");

        let words = this.wordPicker();
        this.players[this.current_player].emit('pickWords', words);

    }

    wordPicked(word){
        this.current_word = word;
        this.sockets.emit("loadedDrawer", this.players[this.current_player].username);
        let spaces = [];
        for (let i=0; i < word.word.length; i++){
            if (word.word.charAt(i) === ' '){
                spaces.push(i);
            }
        }
        const data = {
            word_length: word.word.length,
            time: this.maxTime,
            spaces: spaces,
            category: word.category,
            author: word.author
        };

        const message = {
            author: "Server",
            text: "Es wurde ein Wort von " + word.author + " der Kategorie " + word.category + " gewählt.!",
            color: 'blue'
        };
        this.sockets.emit("getMsg", message);
        this.sockets.emit('setWord', data);

        this.time_clock();
    }

    wordPicker(){
        let max = this.wordlist.length;
        let random = this.getRandomInt(max);

        let suggestions = [];

        while (suggestions.length < 3){

            if (!suggestions.includes(random))
                suggestions.push(random);

            random = this.getRandomInt(max);
        }
        let words = [];
        for (let i in suggestions){
            words.push(this.wordlist[suggestions[i]]);
        }
        return words;
    }

    getRandomInt(max) {
        return Math.floor(Math.random() * Math.floor(max));
    }

    guess(player, text) {
        const name = player.username;
        if (this.current_word !== null) {

            if (player === this.players[this.current_player]) {
                let bad_text = "I hob a kloans nidei weili probiert hob mei eigenes wort zu erroten haha!";
                let message = {
                    text: bad_text,
                    author: name
                };
                this.sockets.emit("getMsg", message);
                return;
            }

            if (text.toLowerCase() === this.current_word.word.toLowerCase()) {
                this.correct_guess(player);
            } else {
                let message = {
                    text: text,
                    author: name
                };
                this.sockets.emit("getMsg", message);
            }

        } else {
            let message = {
                text: text,
                author: name
            };
           this.sockets.emit("getMsg", message);
        }
    }

    correct_guess(player){
        let text = player.username + ' hat das Wort erraten!';
        let message = {
            text: text,
            author: "Server"
        };
        this.sockets.emit("getMsg", message);
        player.emit("correctGuess");

        let points = this.calcPoints();
        this.scores[player.username] += points;

        this.correct_guesses ++;
        if(this.correct_guesses === this.total_players -1 - this.disconnects.length)
            this.wordGuessed();

        let data={
            player: player.username,
            points: points
        };

        this.sockets.emit("addPoints", data);
    }

    calcPoints(){
        let max_points = 500;
        let step = 50;

        let reduce = max_points / this.total_players;
        let time_factor = this.timeLeft / this.maxTime;
        let points = max_points - (this.correct_guesses * reduce);
        points *= time_factor;

        let foo = Math.floor(points / step);
        return foo * step ;
    }

    wordGuessed(){
        //todo: emit word solved event;
        console.log("jeder hats erraten!");
        console.log(this.scores);

        let text = 'Jeder hat das Wort erraten!';
        let message = {
            text: text,
            author: "Server",
            color: 'green',
        };
        this.sockets.emit("getMsg", message);

        this.round_over();
    }

    isPainter(player){
        let i = this.players.indexOf(player);
        return i === this.current_player;
    }


    undo(player, scale){
        if(!this.isPainter(player)){
            player.emit('notAllowed');
            return;
        }

        if (this.actions.length === 0)
            return;

        let action = this.actions.pop();

        if (action.type !== 'fill') {
            let distance = 0;
            let threshhold = 200 * scale; // scale = client / server canvas width

            console.log("Undo Threshhold = ", threshhold);

            while (distance < threshhold && this.actions.length > 0) {
                let action = this.actions.pop();
                if (action.type === 'fill') {
                    action.data.oldColor = action.data.color;
                    action.data.color = {r: 255, g: 255, b: 255}; // set white
                    this.bucket_fill(action.data, player);
                    break;
                }
                this.lines.pop();
                let line = action.data;
                let dx = line.x - line.px;
                let dy = line.y - line.py;
                distance += Math.hypot(dx, dy);
            }
        }
        else{
            action.data.oldColor = action.data.color;
            action.data.color = {r: 255, g: 255, b: 255}; //set white
            this.bucket_fill(action.data, player);
        }

       // player.broadcast.emit('deleted');
        player.broadcast.emit('loaded', this.actions);
        player.broadcast.emit('loadedLines', this.lines);
    }

    // draw a line (if user is drawer)
    paint(line, player){
            if (this.isPainter(player)) {
                player.broadcast.emit('drawLine', line);
                this.lines.push(line);
            }
            else {
                player.emit('notAllowed');
            }
    }

    // fill the area (if user is drawer)
    bucket_fill(data, player){
        if (this.isPainter(player)) {
            player.broadcast.emit('fillArea', data);
        }
        else {
            player.emit('notAllowed');
        }
    }

    addAction(action){
        this.actions.push(action);
    }

    delete(player) {
        if(!this.isPainter(player)){
            player.emit('notAllowed');
            return
        }

        this.lines = [];
        player.broadcast.emit('deleted');
    }

    gameOver(){
        //this.done = true;
        clearInterval(this.countdown);
        this.sockets.emit("finished");
        setTimeout(()=>this.stop(), 10000);
    }

    stop(){
        console.log("Game stopped");
        this.done = true;
        this.sockets.emit('gameStopped');
    }

    playerLeave(player){
        let i = this.players.indexOf(player); //todo: use sess id dict
        this.disconnects.push(i);
        console.log(this.players[i].username, "left !");
        if (i === this.current_player) //todo: replace username with session id (lexik jwt eg)
            this.round_over();
    }

    troll(player, data){
        let target = this.players[this.current_player];
        target.emit("getTroll", data);
    }
}

module.exports = {
    drawGame
};