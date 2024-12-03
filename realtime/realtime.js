import { io } from "socket.io-client";
import { History } from "./history.js";
import axios from 'axios';
import * as msgPackParser from 'socket.io-msgpack-parser';

export class Realtime {

    #baseUrl = "";

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
    disconnected = true;

    // Offline messages
    #offlineMessageBuffer = [];

    // History API
    history = null;

    // Test Variables
    #timeout = 1000;

    constructor(api_key){
        this.api_key = api_key;
        this.namespace = ""; 

        // Init History API
        this.history = new History(api_key);
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
            this.#baseUrl = staging ? "http://localhost:3000" : "http://128.199.176.185:3000";
        }else{
            this.#baseUrl = "http://128.199.176.185:3000";
        }

        this.#log(this.#baseUrl);
        this.#log(opts);

        this.opts = opts;

        // Init History
        this.history.init(staging, opts?.debug);

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
        var startTime = Date.now();
        var urlPart = "/get-namespace"

       try{
            var response = await axios.get(this.#baseUrl + urlPart,{
                headers: {
                    "Authorization": `Bearer ${this.api_key}`
                }
            });

            var data = response.data

            this.#log(data)

            this.#logRESTResponseTime(startTime, urlPart);

            if (data?.status === "SUCCESS"){
                return data.data.namespace;
            }else{
                return null;
            }
       }catch(err){
            console.log(err.message)
            throw new Error(err.message);
       }
    }
    

    /**
     * Connects to the websocket server
     */
    async connect(){
        this.SEVER_URL = `${this.#baseUrl}/${this.namespace}`; 

        this.socket = io(this.SEVER_URL, {
            transports: [ "websocket", "polling" ], // Transport by priority
            reconnectionDelayMax: 500,
            reconnectionAttempts: 240, // Basically try for 2 mins -> 120,000/500 = 240
            reconnection: true,
            cors: {
                origin: "*"
            },
            auth: {
                "api-key": this.api_key
            },
            parser: msgPackParser
        });

        this.socket.on("connect", async () => {
            this.#log(`Connect => ${this.socket.id}`);
            this.disconnected = false;

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

            // await this.sleep(2);
            // await this.socket.emitWithAck("room-message-ack", data); 
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
            this.disconnected = false;

            if(RECONNECT in this.#event_func){
                this.#event_func[RECONNECT](this.#RECONNECTED);   
            }

            // Set remote user data again
            await this.#retryTillSuccess(this.#setRemoteUser, 5, 1);

            this.#log(this.#topicMap);

            // Join rooms again
            await this.#rejoinRoom(); 

            // Resend messages that couldn't be sent
            var output = await this.#publishMessagesOnReconnect();

            // Let the user know that the messages were sent
            if(output.length > 0){
                if(MESSAGE_RESEND in this.#event_func){
                    this.#event_func[MESSAGE_RESEND](output);   
                }
            }
        });

        /**
         * Fires when reconnection attempt is made
         */
        this.socket.io.on("reconnect_attempt", (attempt) => {
            this.#log("[RECON_ATTEMPT] => " + attempt);

            this.reconnected = false;

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

            // Clearing out offline messages on failure to reconnect
            this.#offlineMessageBuffer.length = 0;
        });
        
        /**
         * Fires when socket is disconnected from server.
         * Also executes callback (if initialized) on user thread.
         */
        this.socket.on("disconnect", (reason, details) => {
            this.#log(reason, details);
            this.#log("Disconnected"); 

            this.disconnected = true;
    
            // Removing all listeners
            // this.socket.removeAllListeners();

            var status = "";

            if (reason == "io server disconnect"){
                status = "SERVER_FORCEFULLY_DISCONNECTED_THIS_USER";
            }else if(reason == "io client disconnect"){
                status = "MANUAL_CONNECTION_CLOSE_BY_USER";
            }else if(reason == "ping timeout"){
                status = "HEARTBEAT_TIMEOUT";
            }else if(reason == "transport close"){
                status = "SERVER_DISCONNECTED_THIS_USER";
            }else if(reason == "transport error"){
                status = "CONNECTION_ERROR";
            }

            // Let's call the callback function if it exists
            if (DISCONNECTED in this.#event_func){
                if (this.#event_func[DISCONNECTED] !== null || this.#event_func[DISCONNECTED] !== undefined){
                    this.#event_func[DISCONNECTED](status)
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
            this.disconnected = true;

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

        var startTime = Date.now();

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

        this.#logSocketResponseTime(startTime, {
            "type": "topic_unsubscribe", // TODO: Document
            "status": response["status"],
            "room": topic
        })

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
                    this.#RECONNECTING, this.#RECONN_FAIL, MESSAGE_RESEND, ...this.#roomKeyEvents].includes(topic)){
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
     * Retry methods included. Stores messages in an array if offline.
     * @param {string} topic - Name of the room
     * @param {object} data - Data to send
     * @returns 
     */
    async publish(topic, data, callback){
        var messageId = crypto.randomUUID();

        this.#log(`SOCKET CONNECTED => ${this.socket.connected}`);

        if(this.socket.connected){
            var retries = this.#getPublishRetry(); 
            return await this.#retryTillSuccess(this.#publish, retries, 1, messageId, topic, data, callback);
        }else{
            this.#offlineMessageBuffer.push({
                "id": messageId,
                "room": topic,
                "data": data
            });

            return {
                "message": {
                    "id": messageId,
                    "topic": topic,
                    "message": data
                },
                "status": "PUBLISH_FAIL_TO_SEND",
                "sent": false,
                "connected": this.socket.connected,
                "err": "Not connected to server"
            };
        }
    }

    async #publish(id, topic, data, callback){
        var subscribed = false;
        var success = false;
        var ackTimeout = this.#getAckTimeout();

        var relayResponse = null;
        
        var processStart = Date.now();

        try{
            if ((topic !== null && topic !== undefined) && (data !== null && data !== undefined)){
                if(!this.#topicMap.includes(topic)){
                    // Are we connected to this room?
                    subscribed = await this.#retryTillSuccess(this.#createOrJoinRoom, 5, 1, topic);
                }else{
                    subscribed = true;
                }

                this.#logSocketResponseTime(processStart, {
                    "type": "topic_subscribe_only" // TODO: Document
                })

                if(subscribed){
                    var start = Date.now();

                    relayResponse = await this.socket.timeout(ackTimeout).emitWithAck("relay-to-room", {
                        "id": id,
                        "room": topic,
                        "message": data
                    });

                    // RELAY_FAILURE will set sent = false
                    relayResponse["message"] = {
                        "id": id,
                        "topic": topic,
                        "message": data
                    };
                    relayResponse["sent"] = relayResponse["status"] == "ACK_SUCCESS"; 
                    relayResponse["connected"] = this.socket.connected;

                    var end = Date.now()
                    var latency = end - start;
                    this.#log(`LATENCY => ${latency} ms`);

                    if(callback !== null && callback !== undefined){
                        callback(latency);
                    }

                    // Log the metrics
                    this.#logSocketResponseTime(start, {
                        "type": "publish_only" // TODO: Document
                    });


                }else{
                    this.#log(`Unable to send message, topic not subscribed to`);

                    relayResponse = {
                        "message": {
                            "id": id,
                            "topic": topic,
                            "message": data
                        },
                        "status": "PUBLISH_FAIL_TO_SEND",
                        "sent": false,
                        "connected": this.socket.connected,
                        "message": `Unable to subscribe to topic ${topic}`
                    }
                }

                success = true;
            }else{
                success = false; 
                relayResponse = {
                    "status": "PUBLISH_INPUT_ERR", 
                    "sent": false,
                    "connected": this.socket.connected,
                    "message": `topic is ${topic} || data is ${data}`
                }
            }
        }catch(err){
            this.#log(err);

            relayResponse = {
                "message": {
                    "id": id,
                    "topic": topic,
                    "message": data
                },
                "status": "PUBLISH_FAIL_TO_SEND",
                "sent": false,
                "connected": this.socket.connected,
                "err": err.message
            }

            success = false;
        }

        this.#logSocketResponseTime(processStart, {
            "type": "publish_full", // TODO: Document
            "status": relayResponse["status"],
            "sent": relayResponse["sent"],
            "connected": relayResponse["connected"],
            "err": relayResponse["err"]
        })

        return {
            success: success,
            output: relayResponse
        }
    }

    /**
     * Method resends messages when the client successfully connects to the
     * server again
     * @returns - Array of success and failure messages
     */
    async #publishMessagesOnReconnect(){
        var messageSentStatus = [];

        for(let i = 0; i < this.#offlineMessageBuffer.length; i++){
            let message = this.#offlineMessageBuffer[i];
            
            var id = message.id;
            var topic = message.room;
            var data = message.data;

            // Metrics logging
            var startTime = Date.now();

            var retries = this.#getPublishRetry(); 
            var output = await this.#retryTillSuccess(this.#publish, retries, 1, id, topic, data);

            // Log the metrics
            this.#logSocketResponseTime(startTime, {
                "type": "publish_retry_on_connect" // TODO: Document
            });

            messageSentStatus.push(output);
        }

        // Clearing out offline messages
        this.#offlineMessageBuffer.length = 0;

        return messageSentStatus;
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

        var response = null;

        var startTime = Date.now();

        try{
            if (this.isTopicValid(topic)){
                // If not, connect and wait for an ack
                response = await this.socket.timeout(ackTimeout).emitWithAck("enter-room", {
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

            response = {
                "status": "ROOM_JOIN_ERR",
                "err": err.message
            }

            subscribed = false;
        }

        this.#logSocketResponseTime(startTime, {
            "type": "create_or_join_room", // TODO: Document
            "status": response["status"],
            "err": response["err"]
        });

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
            var startTime = Date.now();

            // If not, connect and wait for an ack
            var subscribed = await this.#retryTillSuccess(this.#createOrJoinRoom, 5, 1, topic);

            this.#event_func[topic]({
                "type": "RECONNECTION_STATUS",
                "initialized_topic": subscribed
            });

            this.#logSocketResponseTime(startTime, {
                "type": "rejoin_room", // TODO: Document
                "room": topic,
                "subscribed": subscribed
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

    /**
     * Checks if a topic can be used to send messages to.
     * @param {string} topic 
     * @returns 
     */
    isTopicValid(topic){
        if(topic !== null && topic !== undefined && (typeof topic) == "string"){
            return ![CONNECTED, DISCONNECTED, RECONNECT, this.#RECONNECTED,
                this.#RECONNECTING, this.#RECONN_FAIL, MESSAGE_RESEND,...this.#roomKeyEvents].includes(topic);
        }else{
            return false;
        }
    }

    sleep(ms) {
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

            await this.sleep(delay)

            output = await func(...args); 
            success = output.success; 
            // this.#log(output);

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

    /**
     * Logs client side REST API response time and sends
     * it to the server for logging
     * @param {unix timestamp} startTime 
     * @param {string} url 
     */
    async #logRESTResponseTime(startTime, url){
        var responseTime = Date.now() - startTime;

        var data = {
            "url": url,
            "response_time": responseTime
        }

        await axios.post(this.#baseUrl + "/metrics/log", data, {
            headers: {
                "Authorization": `Bearer ${this.api_key}`
            }
        });
    }

    /**
     * Logs client side Socket API response time and sends
     * it to the server for logging
     * @param {unix timestamp} startTime 
     * @param {JSON} data 
     */
    async #logSocketResponseTime(startTime, data){
        var responseTime = Date.now() - startTime;

        var data = {
            "data": data,
            "response_time": responseTime
        }

        await axios.post(this.#baseUrl + "/metrics/socket_log", data, {
            headers: {
                "Authorization": `Bearer ${this.api_key}`
            }
        });
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
export const MESSAGE_RESEND = "MESSAGE_RESEND";
export const DISCONNECTED = "DISCONNECTED";