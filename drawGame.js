class drawGame {

    constructor(init){
        this.rounds = init.rounds;
        this.wordlist = init.wordlist;
        this.maxTime = init.maxTime;
        this.timeLeft = init.maxTime;
        this.current_round = 0;
        this.current_player = 0;
        this.total_players = 5; //todo: laod from init
        this.time_out = false;
        this.finished = false;
        this.rounds = init.rounds;
        this.current_word = null;
        this.socket = init.socket;
        this.sockets = init.sockets;
    }

    time_clock(){
        let countdown = setInterval(()=>{
            this.timeLeft -=1;

            console.log(this.timeLeft);

            if (this.timeLeft === 0){
                clearInterval(countdown);

                if (this.current_player +1 > this.total_players){
                    if (this.current_round +1 > this.rounds){
                        this.finished = true;
                    }
                    else{
                        this.current_round ++;
                    }
                }

                const data = {
                    finished: this.finished,
                    current_player: this.current_player,
                    current_round: this.current_round
                };


                console.log("emitting ", this.socket, data);

                this.sockets.emit("timeout", data);

                this.time_out = true;
                setTimeout(()=>{
                    this.time_out = false;
                }, 2000)

            }
        }, 1000);
    }

    wordPicked(word){
        this.current_word = word;
        return this.time_clock();
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

}

module.exports = {
    drawGame
};