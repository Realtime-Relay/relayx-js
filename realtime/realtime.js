import { io } from "socket.io-client";
import axios from 'axios';
import * as msgPackParser from 'socket.io-msgpack-parser';

export class Realtime {

    #event_func = {}; 
    #topicMap = []; 
    #roomKeyEvents = ["connect", "room-message", "room-join", "disconnect",
        "ping", "reconnect_attempt", "reconnect_failed", "room-message-ack",
        "exit-room", "relay-to-room", "enter-room", "set-user"
    ];

    // Status Codes
    #RECONNECTING = "RECONNECTING";
    #RECONNECTED = "RECONNECTED";
    #RECONN_FAIL = "RECONN_FAIL";

    // Retry attempts
    publishRetryAttempt = 0; 
    maxPublishRetries = 5;

    roomExitAttempt = 0; 
    roomExitRetries = 5; 

    setRemoteUserAttempts = 0;
    setRemoteUserRetries = 5; 

    // Retry attempts end
    reconnected = false;

    // Test Variables
    #timeout = 1000;

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

            // Execute only on first time connection
            if(!this.reconnected){
                // Set remote user
                await this.#retryTillSuccess(this.#setRemoteUser, 5, 1);
                
                // Subscribe to initialized topics
                await this.#subscribeToTopics();
            }
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
            this.reconnected = true; 

            if(RECONNECT in this.#event_func){
                this.#event_func[RECONNECT](this.#RECONNECTED);   
            }

            // Set remote user data again
            await this.#retryTillSuccess(this.#setRemoteUser, 5, 1);

            this.#log(this.#topicMap);

            // Join rooms again
            await this.#rejoinRoom(); 
        });

        /**
         * Fires when reconnection attempt is made
         */
        this.socket.io.on("reconnect_attempt", (attempt) => {
            this.#log("[RECON_ATTEMPT] => " + attempt);

            if (attempt === 1){
                if(RECONNECT in this.#event_func){
                    this.#event_func[RECONNECT](this.#RECONNECTING);   
                }
            }
        });

        /**
         * Fires when reconnection attempt failed
         */
        this.socket.io.on("reconnect_failed", () => {
            this.#log("[RECONN_FAIL] => Reconnection failed");

            if(RECONNECT in this.#event_func){
                this.#event_func[RECONNECT](this.#RECONN_FAIL);   
            }
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

    /**
     * Closes connection
     */
    close(){
        if(this.socket !== null && this.socket !== undefined){
            this.reconnected = false;

            this.socket.disconnect();
        }else{
            this.#log("Null / undefined socket, cannot close connection");
        }
    }

    async #subscribeToTopics(){
        this.#topicMap.forEach(async (topic) => {
            this.#log(topic)
            // Are we connected to this room?
            var subscribed = await this.#retryTillSuccess(this.#createOrJoinRoom, 5, 1, topic);
    
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
        return await this.#retryTillSuccess(this.#off, 5, 1, topic); 
    }

    async #off(topic){
        var success = false; 
        var response = null; 
        var ackTimeout = this.#getAckTimeout()

        try{
            if (this.#topicMap.includes(topic)){
                response = await this.socket.timeout(ackTimeout).emitWithAck("exit-room", {
                    "room": topic
                });
            }else{
                response = {
                    "status": "TOPIC_EXIT",
                    "exit": true
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
        if ((typeof func !== "function")){
            throw new Error(`Expected $listener type -> function. Instead receieved -> ${typeof func}`);
        }
        
        if(typeof topic !== "string"){
            throw new Error(`Expected $topic type -> string. Instead receieved -> ${typeof func}`);
        }

        if ((topic !== null || topic != undefined) && (func !== null || func !== undefined)){
            if(!this.#roomKeyEvents.includes(topic)){
                this.#event_func[topic] = func; 

                if (![CONNECTED, DISCONNECTED, RECONNECT, this.#RECONNECTED,
                    this.#RECONNECTING, this.#RECONN_FAIL, ...this.#roomKeyEvents].includes(topic)){
                        this.#topicMap.push(topic);
                }

                return true
            }else{
                return false;
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
        return await this.#retryTillSuccess(this.#publish, retries, 1, topic, data);
    }

    async #publish(topic, data){
        var subscribed = false;
        var success = false;
        var ackTimeout = this.#getAckTimeout();

        try{
            if ((topic !== null && topic !== undefined) && (data !== null && data !== undefined)){
                if(!this.#topicMap.includes(topic)){
                    // Are we connected to this room?
                    subscribed = await this.#retryTillSuccess(this.#createOrJoinRoom, 5, 1, topic);
                }else{
                    subscribed = true;
                }

                if(subscribed){
                    var start = Date.now()
                    var relayResponse = await this.socket.timeout(ackTimeout).emitWithAck("relay-to-room", {
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
            }else{
                success = false; 
                relayResponse = {
                    "status": "PUBLISH_INPUT_ERR", 
                    "sent": false,
                    "message": `topic is ${topic} || data is ${data}`
                }
            }
        }catch(err){
            this.#log(err);

            relayResponse = {
                "status": "PUBLISH_FAIL_TO_SEND",
                "sent": false,
                "err": err.message
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
        var ackTimeout = this.#getAckTimeout();

        try{
            if (![CONNECTED, DISCONNECTED, ...this.#roomKeyEvents].includes(topic)){
                // If not, connect and wait for an ack
                var response = await this.socket.timeout(ackTimeout).emitWithAck("enter-room", {
                    "room": topic
                });
    
                this.#log(response);
    
                if (response["status"] == "JOINED_ROOM" || response["status"] == "ROOM_CREATED" ||
                    response["status"] == "ALREADY_IN_ROOM"){
                    subscribed = true; 
                }else{
                    subscribed = false; 
                }
            }else{
                throw new Error(`Reserved topic => '${topic}'. Do not use!`);
            }
        }catch(err){
            this.#log(err);

            subscribed = false;
        }

        return {
            success: subscribed,
            output: subscribed
        }; 
    }

    /**
     * Rejoins room on reconnection
     * @param {string} topic - Name of the room
     * @returns {boolean} - True if rejoined successfully else false.
     */
    async #rejoinRoom(){
        this.#topicMap.forEach(async (topic) => {
            // If not, connect and wait for an ack
            var subscribed = await this.#retryTillSuccess(this.#createOrJoinRoom, 5, 1, topic);

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
        var ackTimeout = this.#getAckTimeout();

        try{
            if (userData !== null && userData !== undefined){
                await this.socket.timeout(ackTimeout).emitWithAck("set-user", {
                    user_data: userData
                });
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
    isTopicValid(topic){
        if(topic !== null && topic !== undefined && (typeof topic) == "string"){
            return !this.#roomKeyEvents.includes(topic);
        }else{
            return false;
        }
    }

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
                if (this.opts.max_retries <= 0){
                    return this.maxPublishRetries; 
                }else{
                    return this.opts.max_retries;
                }
            }else{
                return this.maxPublishRetries; 
            }
        }else{
            return this.maxPublishRetries; 
        }
    }

    #getAckTimeout(){
        if(process.env.NODE_ENV == "test"){
            this.#log(`TIMEOUT -> ${this.#timeout}`)
            return this.#timeout;
        }else{
            this.#timeout = 1000;
            return 1000;
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
            this.#log(`Attempt ${i} at executing ${func.name}()`)

            await this.#sleep(delay)

            output = await func(...args); 
            success = output.success; 
            this.#log(output);

            methodDataOutput = output.output; 

            if (success){
                this.#log(`Successfully called ${func.name}`)
                break;
            }
        }

        if(!success){
            this.#log(`${func.name} executed ${count} times BUT not a success`);
        }

        return methodDataOutput;
    }

    // Exposure for tests
    testRetryTillSuccess(){
        if(process.env.NODE_ENV == "test"){
            return this.#retryTillSuccess.bind(this);
        }else{
            return null; 
        }
    }

    testGetPublishRetry(){
        if(process.env.NODE_ENV == "test"){
            return this.#getPublishRetry.bind(this);
        }else{
            return null; 
        }
    }

    testCreateOrJoinRoom(){
        if(process.env.NODE_ENV == "test"){
            return this.#createOrJoinRoom.bind(this);
        }else{
            return null;
        }
    }

    testSetRemoteUser(){
        if(process.env.NODE_ENV == "test"){
            return this.#setRemoteUser.bind(this);
        }else{
            return null;
        }
    }
}

export const CONNECTED = "CONNECTED";
export const RECONNECT = "RECONNECT";
export const DISCONNECTED = "DISCONNECTED";