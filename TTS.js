
class TTS {
    constructor(token) {
        this.token = token;
        this.socket = undefined;
        this.txtStack = [];
        this.player = undefined;
        this.currSid = undefined;
        this.oldSidList = [];
        this.statusCallback = (status) => {
            // console.log('ttsStatusCallback', status)
            if (status === 'connected') {
                this.txtStack.forEach(txt => {
                    this.socket?.send({
                        serviceName: 'XunFei',
                        chatContent: txt
                    });
                });
                this.txtStack = [];
            }
        };
        this.msgCallback = (msg) => {
            // console.log('ttsMsgCallback', msg)
            if (msg.errorCode === 0 && (!this.currSid || (this.currSid && this.currSid === msg.sid)) && !this.oldSidList.includes(msg.sid)) {
                if (!this.currSid) {
                    this.currSid = msg.sid;
                }
                const pcmData = Base64.toUint8Array(msg.result);
                this.playAudio(pcmData);
            }
        };
    }

    sendStr(text) {
        if (!this.player) {
            this.player = new PCMPlayer({
                flushTime: 1000,
                inputCodec: 'Int16',
                channels: 1,
                sampleRate: 16000
            });
            this.player.volume(0.8);
        }
        if (!text.trim()) {
            return;
        }
        this.txtStack.push(text);
        if (this.socket === undefined || this.socket.status !== 'connected') {
            return;
        }
        this.txtStack.forEach(txt => {
            this.socket?.send({
                serviceName: 'XunFei',
                chatContent: txt
            });
        });
        this.txtStack = [];
    }

    playAudio(pcmData) {

        this.player.feed(pcmData);
    }

    reset() {
        if (this.currSid) {
            this.oldSidList.push(this.currSid);
            if (this.oldSidList.length > 10) {
                this.oldSidList.shift();
            }
        }
        this.currSid = undefined;
        this.txtStack = [];
        if (this.player) {
            this.player.destroy();
            this.player = undefined;
        }
    }

    init() {
        const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
        this.socket = new Socket(`wss://vauth-rh.ha.chinamobile.com:28091//aichat/asstapi/textToAudioTTS/yifei/0/20/${this.token}`, this.msgCallback, this.statusCallback);
        this.socket.connect(true);
    }

    destroy() {
        if (this.socket) {
            this.socket.close();
            this.socket = undefined;
        }
        this.reset();
    }
}
