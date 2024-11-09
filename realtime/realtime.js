import { io } from "socket.io-client";
import axios from 'axios';
import * as msgPackParser from 'socket.io-msgpack-parser';

export class Realtime {

    #event_func = {}; 
    #topicMap = []; 
    roomKeyEvents = ["connect", "room-message", "room-join", "disconnect"];

    // Retry attempts
    publishRetryAttempt = 0; 
    maxPublishRetries = 5;

    roomExitAttempt = 0; 
    roomExitRetries = 5; 

    setRemoteUserAttempts = 0;
    setRemoteUserRetries = 5; 

    // Retry attempts end

    reconnectFlag = false;

    constructor(api_key){
        this.api_key = api_key;
        this.namespace = ""; 
    }

    /*
    Initialized library with configuration options. Gets namespace from REST API
    */
    async init(staging, opts){
        /**
         * Method can take in 2 variables
         * @param{boolean} staging - Sets URL to staging or production URL
         * @param{Object} opts - Library configuration options
         */
        var len = arguments.length;

        if (len > 2){
            new Error("Method takes only 2 variables, " + len + " given");
        }

        if (len == 2){
            if(typeof arguments[0] == "boolean"){
                staging = arguments[0]; 
            }else{
                staging = false;
            }

            if(arguments[1] instanceof Object){
                opts = arguments[1];
            }else{
                opts = {};
            }
        }else if(len == 1){
            if(arguments[0] instanceof Object){
                opts = arguments[0];
                staging = false;
            }else{
                opts = {};
                staging = arguments[0];
                this.#log(staging)
            }
        }else{
            staging = false;
            opts = {};
        }

        this.staging = staging; 

        if (staging !== undefined || staging !== null){
            this.baseUrl = staging ? "http://127.0.0.1:3000" : "http://128.199.176.185:3000";
        }else{
            this.baseUrl = "http://128.199.176.185:3000";
        }

        this.#log(this.baseUrl);
        this.#log(opts);

        this.opts = opts;

        if (this.api_key !== null && this.api_key !== undefined){
            this.namespace = await this.#getNameSpace();
        }else{
            throw new Error("Undefined or null api key in constructor"); 
        }
    }

    /**
     * Gets the namespace of the user using a REST API
     * @returns {string} namespace value. Null if failed to retreive
     */
    async #getNameSpace() {
        var response = await axios.get(this.baseUrl + "/get-namespace",{
            headers: {
                "Authorization": `Bearer ${this.api_key}`
            }
        });

        var data = response.data

        if (data?.status === "SUCCESS"){
            return data.data.namespace;
        }else{
            return null;
        }
    }
    

    /**
     * Connects to the websocket server
     */
    connect(){
        this.SEVER_URL = `${this.baseUrl}/${this.namespace}`; 

        this.socket = io(this.SEVER_URL, {
            transports: [ "websocket", "polling" ], // Transport by priority
            reconnectionDelayMax: 500,
            reconnection: true,
            extraHeaders: {
                "api-key": this.api_key
            },
            parser: msgPackParser
        });

        this.socket.on("connect", async () => {
            this.#log(`Connect => ${this.socket.id}`);

            // Let's call the callback function if it exists
            if (CONNECTED in this.#event_func){
                if (this.#event_func[CONNECTED] !== null || this.#event_func[CONNECTED] !== undefined){
                    this.#event_func[CONNECTED]()
                }
            }

            // Set remote user
            await this.#retryTillSuccess(this.#setRemoteUser, 5, 1);
            
            // Subscribe to initialized topics
            await this.#subscribeToTopics();
        });
        
        /**
         * Listener to recieve messages from the server.
         * Executes callback function if initialized by the user
         */
        this.socket.on("room-message", async (data) => {
            this.#log(data)
            var room = data.room; 

            if (room in this.#event_func){
                if (this.#event_func[room] !== null || this.#event_func[room] !== undefined){
                    this.#event_func[room]({
                        "id": data.id,
                        "data": data.data
                    })
                }
            }

            await this.#sleep(2);
            await this.socket.emitWithAck("room-message-ack", data); 
        });

        /**
         * Listener to recieve events of user joining or leaving.
         * Executes callback function defined in on(), if initialized
         */
        this.socket.on("room-join", (data) => {
            var room = data.room; 
            var event = data.event;

            if (room in this.#event_func){
                this.#event_func[room](event);
            }
        });

        this.socket.io.on("ping", async (cb) => {
            this.#log("PING");
        });

        /**
         * Executes once reconnection is established.
         * Makes sure client joins all rooms it was previously
         * connected to.
         */
        this.socket.io.on("reconnect", async (attempt) => {
            this.#log("[RECONN] => Reconnected " + attempt);
            this.reconnectFlag = true; 

            // Set remote user data again
            await this.#retryTillSuccess(this.#setRemoteUser, 5, 1);

            // Join rooms again
            await this.#rejoinRoom(); 
        });

        /**
         * Fires when reconnection attempt is made
         */
        this.socket.io.on("reconnect_attempt", (attempt) => {
            this.#log("[RECON_ATTEMPT] => " + attempt);
        });

        /**
         * Fires when reconnection attempt failed
         */
        this.socket.io.on("reconnect_failed", () => {
            this.#log("[RECONN_FAIL] => Reconnection failed");
        });
        
        /**
         * Fires when socket is disconnected from server.
         * Also executes callback (if initialized) on user thread.
         */
        this.socket.on("disconnect", (reason, details) => {
            this.#log(reason, details);
            this.#log("Disconnected"); 
    
            // Removing all listeners
            // this.socket.removeAllListeners();

            // Let's call the callback function if it exists
            if (DISCONNECTED in this.#event_func){
                if (this.#event_func[DISCONNECTED] !== null || this.#event_func[DISCONNECTED] !== undefined){
                    this.#event_func[DISCONNECTED]()
                }
            }
        });
    }

    async #subscribeToTopics(){
        this.#topicMap.forEach(async (topic) => {
            this.#log(topic)
            // Are we connected to this room?
            var subscribed = await this.#createOrJoinRoom(topic);
    
            if (!subscribed){
                this.#event_func[topic]({
                    "status": "TOPIC_SUBSCRIBE",
                    "subscribed": false
                }); 
            }
        });
    }

    /**
     * Deletes reference to user defined event callback.
     * This will "stop listening to an event"
     * @param {string} topic 
     */
    async off(topic){
        await this.#retryTillSuccess(this.#off, 5, 1, topic); 
    }

    async #off(topic){
        var success = false; 
        var response = null; 

        try{
            if (this.#topicMap.includes(topic)){
                response = await this.socket.timeout(1000).emitWithAck("exit-room", {
                    "room": topic
                });
            }else{
                response = {
                    "status": "TOPIC_EXIT",
                    "exit": false
                }
            }

            this.#topicMap = this.#topicMap.filter(item => item !== topic);

            success = true; 
        }catch(err){
            this.#log(err);

            response = {
                "status": "TOPIC_EXIT",
                "exit": false
            }

            success = false;
        }

        return {
            success: success,
            output: response
        }
    }

    /**
     * Subscribes to a topic by joining a room
     * @param {string} topic - Name of the room
     * @param {function} func - Callback function to call on user thread
     * @returns {boolean} - To check if topic subscription was successful
     */
    async on(topic, func){
        if ((topic !== null || topic != undefined) && (func !== null || func !== undefined) && (typeof func == "function")){
            if(![CONNECTED, DISCONNECTED, ...this.roomKeyEvents].includes(topic)){
                this.#topicMap.push(topic);
                this.#event_func[topic] = func; 

                return true
            }else{

            }
        }else{
            return false;
        }
    }

    /**
     * A method to send a message to a topic.
     * Retry methods included
     * @param {string} topic - Name of the room
     * @param {object} data - Data to send
     * @returns 
     */
    async publish(topic, data){
        var retries = this.#getPublishRetry(); 
        await this.#retryTillSuccess(this.#publish, retries, 1, topic, data);
    }

    async #publish(topic, data){
        var subscribed = false;
        var success = false;

        try{
            if (topic !== null || topic !== undefined){
                if(!this.#topicMap.includes(topic)){
                    // Are we connected to this room?
                    subscribed = await this.#createOrJoinRoom(topic);
                }else{
                    subscribed = true;
                }

                if(subscribed){
                    var start = Date.now()
                    var relayResponse = await this.socket.timeout(1000).emitWithAck("relay-to-room", {
                        "id": crypto.randomUUID(),
                        "room": topic,
                        "message": data
                    });

                    // RELAY_FAILURE will set sent = false
                    relayResponse["sent"] = relayResponse["status"] == "ACK_SUCCESS"; 

                    var end = Date.now()
                    var latency = end - start;
                    this.#log(`LATENCY => ${latency} ms`);
                }else{
                    this.#log(`Unable to send message, topic not subscribed to`);

                    relayResponse = relayResponse = {
                        "status": "PUBLISH_FAIL_TO_SEND",
                        "sent": false
                    }
                }

                success = true;
            }
        }catch(err){
            this.#log(err);

            relayResponse = relayResponse = {
                "status": "PUBLISH_FAIL_TO_SEND",
                "sent": false
            }

            success = false;
        }

        return {
            success: success,
            output: relayResponse
        }
    }

    // Room functions

    /**
     * Creates a room or joins one. Does not join if
     * already part of one
     * @param {string} topic - Name of the room 
     * @returns {boolean} - True if joined successfully else false.
     */
    async #createOrJoinRoom(topic){
        var subscribed = false; 

        if (![CONNECTED, DISCONNECTED, ...this.roomKeyEvents].includes(topic)){
            // If not, connect and wait for an ack
            var response = await this.socket.emitWithAck("enter-room", {
                "room": topic
            });

            this.#log(response);

            if (response["status"] == "JOINED_ROOM" || response["status"] == "ROOM_CREATED"){
                this.#topicMap.push(topic);
                subscribed = true; 
            }else{
                subscribed = false; 
            }
        }else{
            subscribed = true; 
        }

        return subscribed; 
    }

    /**
     * Rejoins room on reconnection
     * @param {string} topic - Name of the room
     * @returns {boolean} - True if rejoined successfully else false.
     */
    async #rejoinRoom(){
        this.#topicMap.forEach(async (topic) => {
            var subscribed = false; 

            // If not, connect and wait for an ack
            var response = await this.socket.emitWithAck("enter-room", {
                "room": topic
            });

            this.#log(response);

            if (response["status"] == "JOINED_ROOM" || response["status"] == "ROOM_CREATED"){
                subscribed = true; 
            }else{
                subscribed = false; 
            }

            this.#event_func[topic]({
                "type": "RECONNECTION_STATUS",
                "initialized_topic": subscribed
            });
        });
    }

    // User functions
    setUser(user){
        this.user = user; 
    }

    getUser(){
        return this.user !== null && this.user !== undefined ? this.user : null;
    }

    async #setRemoteUser(){
        var userData = this.getUser();
        var success = false;

        try{
            if (userData !== null && userData !== undefined){
                await this.socket.timeout(1000).emitWithAck("set-user", {
                    user_data: userData
                });

                console.log("SET USER SUCCESS")
            }else{
                console.log("No user object found, skipping setting user");
            }

            success = true; 
        }catch(err){
            this.#log(err); 

            success = false; 
        }

        return {
            success: success,
            output: null
        }
    }

    // Utility functions
    #sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    #log(msg){
        if(this.opts?.debug){
            console.log(msg);
        }
    }

    #getPublishRetry(){
        if(this.opts !== null && this.opts !== undefined){
            if(this.opts.max_retries !== null && this.opts.max_retries !== undefined){
                return this.opts.max_retries;
            }else{
                return this.maxPublishRetries; 
            }
        }else{
            return this.maxPublishRetries; 
        }
    }

    /**
     * 
     * @param {function} func - Function to execute under retry
     * @param {int} count - Number of times to retry
     * @param {int} delay - Delay between each retry
     * @param  {...any} args - Args to pass to func
     * @returns {any} - Output of the func method
     */
    async #retryTillSuccess(func, count, delay, ...args){
        func = func.bind(this);

        var output = null;
        var success = false; 
        var methodDataOutput = null; 

        for(let i = 1; i <= count; i++){
            this.#log(`Attempt ${i} at executing ${func}()`)

            await this.#sleep(delay)

            output = await func(...args); 
            success = output.success; 
            this.#log(output);

            methodDataOutput = output.output; 

            if (success){
                this.#log(`Successfully called ${func}`)
                break;
            }
        }

        if(!success){
            this.#log(`${func} executed ${count} times BUT not a success`);
        }

        return methodDataOutput;
    }
}

export const CONNECTED = "CONNECTED";
export const DISCONNECTED = "DISCONNECTED";