import { History } from "./history.js";
import axios from 'axios';
import { connect, JSONCodec, Events, DebugEvents, AckPolicy, ReplayPolicy, credsAuthenticator } from "nats";
import { DeliverPolicy, jetstream, jetstreamManager } from "@nats-io/jetstream";
import { readFileSync } from "fs"

export class Realtime {

    #baseUrl = "";

    #natsClient = null; 
    #codec = JSONCodec();
    #jetstream = null;
    #jsManager = null;
    #streamTracker = []; 
    #consumerMap = {};

    #event_func = {}; 
    #topicMap = []; 

    #config = "CiAgICAgICAgLS0tLS1CRUdJTiBOQVRTIFVTRVIgSldULS0tLS0KICAgICAgICBKV1RfS0VZCiAgICAgICAgLS0tLS0tRU5EIE5BVFMgVVNFUiBKV1QtLS0tLS0KCiAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKiBJTVBPUlRBTlQgKioqKioqKioqKioqKioqKioqKioqKioqKgogICAgICAgIE5LRVkgU2VlZCBwcmludGVkIGJlbG93IGNhbiBiZSB1c2VkIHRvIHNpZ24gYW5kIHByb3ZlIGlkZW50aXR5LgogICAgICAgIE5LRVlzIGFyZSBzZW5zaXRpdmUgYW5kIHNob3VsZCBiZSB0cmVhdGVkIGFzIHNlY3JldHMuCgogICAgICAgIC0tLS0tQkVHSU4gVVNFUiBOS0VZIFNFRUQtLS0tLQogICAgICAgIFNFQ1JFVF9LRVkKICAgICAgICAtLS0tLS1FTkQgVVNFUiBOS0VZIFNFRUQtLS0tLS0KCiAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKgogICAgICAgIA=="

    // Status Codes
    #RECONNECTING = "RECONNECTING";
    #RECONNECTED = "RECONNECTED";
    #RECONN_FAIL = "RECONN_FAIL";

    setRemoteUserAttempts = 0;
    setRemoteUserRetries = 5; 

    // Retry attempts end
    reconnected = false;
    disconnected = true;
    reconnecting = false;
    connected = false;

    // Offline messages
    #offlineMessageBuffer = [];

    // History API
    history = null;

    // Test Variables
    #timeout = 1000;

    #maxPublishRetries = 5; 

    constructor(config){
        if(typeof config != "object"){
            throw new Error("Realtime($config). $config not object => {}")
        }

        if(config != null && config != undefined){
            this.api_key = config.api_key != undefined ? config.api_key : null;
            this.secret = config.secret != undefined ? config.secret : null;

            if(this.api_key == null){
                throw new Error("api_key value null")
            }

            if(this.secret == null){
                throw new Error("secret value null")
            }
        }else{
            throw new Error("{api_key: <value>, secret: <value>} not passed in constructor")
        }

        this.namespace = null;
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
            this.#baseUrl = staging ? [
                "nats://0.0.0.0:4221",
                "nats://0.0.0.0:4222",
                "nats://0.0.0.0:4223",
                "nats://0.0.0.0:4224",
                "nats://0.0.0.0:4225",
                "nats://0.0.0.0:4226"] : 
                [
                    "nats://api.relay-x.io:4221",
                    "nats://api.relay-x.io:4222",
                    "nats://api.relay-x.io:4223",
                    "nats://api.relay-x.io:4224",
                    "nats://api.relay-x.io:4225",
                    "nats://api.relay-x.io:4226",
                ];
        }else{
            this.#baseUrl = [
                "nats://api.relay-x.io:4221",
                "nats://api.relay-x.io:4222",
                "nats://api.relay-x.io:4223",
                "nats://api.relay-x.io:4224",
                "nats://api.relay-x.io:4225",
                "nats://api.relay-x.io:4226",
            ];
        }

        this.#log(this.#baseUrl);
        this.#log(opts);

        this.opts = opts;
    }

    /**
     * Gets the namespace of the user using a REST API
     * @returns {string} namespace value. Null if failed to retreive
     */
    async #getNameSpace() {
        var res = await this.#natsClient.request("accounts.user.get_namespace", 
            this.#codec.encode({
                "api_key": this.api_key
            }),
            {
                timeout: 5000
            }
        )

        var data = res.json()

        this.#log(data)

        if(data["status"] == "NAMESPACE_RETRIEVE_SUCCESS"){
            this.namespace = data["data"]["namespace"]
        }else{
            this.namespace = null;
            return
        }
    }
    

    /**
     * Connects to the websocket server
     */
    async connect(){
        this.SEVER_URL = this.#baseUrl;

        var credsFile = this.#getUserCreds(this.api_key, this.secret)
        credsFile = new TextEncoder().encode(credsFile);
        var credsAuth = credsAuthenticator(credsFile);

        try{
            this.#natsClient = await connect({ 
                servers: this.SEVER_URL,
                noEcho: true,
                maxReconnectAttempts: 1200,
                reconnect: true,
                reconnectTimeWait: 1000,
                authenticator: credsAuth,
                token: this.api_key
            });

            this.#jsManager = await jetstreamManager(this.#natsClient);
            this.#jetstream = await jetstream(this.#natsClient);

            await this.#getNameSpace()

            this.connected = true;
        }catch(err){
            this.#log("ERR")
            this.#log(err);

            this.connected = false;
        }

        if (this.connected == true){
            this.#log("Connected to server!");

            // Callback on client side
            if (CONNECTED in this.#event_func){
                if (this.#event_func[CONNECTED] !== null || this.#event_func[CONNECTED] !== undefined){
                    this.#event_func[CONNECTED]()
                }
            }

            this.#natsClient.closed().then(() => {
                this.#log("the connection closed!");
            });
            
            (async () => {
                for await (const s of this.#natsClient.status()) {
                this.#log(s.type)

                switch (s.type) {
                    case Events.Disconnect:
                        this.#log(`client disconnected - ${s.data}`);

                        this.connected = false;
                        this.#streamTracker = []; 
                        this.#consumerMap = {};

                        if (DISCONNECTED in this.#event_func){
                            if (this.#event_func[DISCONNECTED] !== null || this.#event_func[DISCONNECTED] !== undefined){
                                this.#event_func[DISCONNECTED]()
                            }
                        }
                    break;
                    case Events.LDM:
                        this.#log("client has been requested to reconnect");
                    break;
                    case Events.Update:
                        this.#log(`client received a cluster update - `);
                        this.#log(s.data)
                    break;
                    case Events.Reconnect:
                        this.#log(`client reconnected -`);
                        this.#log(s.data)

                        this.reconnecting = false;
                        this.connected = true;

                        this.#subscribeToTopics();

                        if(RECONNECT in this.#event_func){
                            this.#event_func[RECONNECT](this.#RECONNECTED);   
                        }

                        // Resend any messages sent while client was offline
                        this.#publishMessagesOnReconnect();
                    break;
                    case Events.Error:
                        this.#log("client got a permissions error");
                    break;
                    case DebugEvents.Reconnecting:
                        this.#log("client is attempting to reconnect");

                        this.reconnecting = true;

                        if(RECONNECT in this.#event_func && this.reconnecting){
                            this.#event_func[RECONNECT](this.#RECONNECTING);   
                        }
                    break;
                    case DebugEvents.StaleConnection:
                        this.#log("client has a stale connection");
                    break;
                    default:
                        this.#log(`got an unknown status ${s.type}`);
                }
                }
            })().then();

            // Subscribe to topics
            this.#subscribeToTopics();
        }
    }

    /**
     * Closes connection
     */
    close(){
        if(this.#natsClient !== null){
            this.reconnected = false;
            this.disconnected = true;

            this.#natsClient.close();
        }else{
            this.#log("Null / undefined socket, cannot close connection");
        }
    }

    /**
     * Start consumers for topics initialized by user
     */
    async #subscribeToTopics(){
        this.#topicMap.forEach(async (topic) => {
            // Subscribe to stream
            await this.#startConsumer(topic); 
        });
    }

    /**
     * Deletes reference to user defined event callback.
     * This will "stop listening to an event"
     * @param {string} topic 
     */
    async off(topic){
        if(topic == null || topic == undefined){
            throw new Error("$topic is null / undefined")
        }

        if(typeof topic !== "string"){
            throw new Error(`Expected $topic type -> string. Instead receieved -> ${typeof topic}`);
        }

        this.#topicMap = this.#topicMap.filter(item => item !== topic);

        delete this.#event_func[topic];

        return await this.#deleteConsumer(topic);
    }

    /**
     * Subscribes to a topic by joining a room
     * @param {string} topic - Name of the room
     * @param {function} func - Callback function to call on user thread
     * @returns {boolean} - To check if topic subscription was successful
     */
    async on(topic, func){
        if(topic == null || topic == undefined){
            throw new Error("$topic is null / undefined")
        }

        if(func == null || func == undefined){
            throw new Error("$func is null / undefined")
        }

        if ((typeof func !== "function")){
            throw new Error(`Expected $listener type -> function. Instead receieved -> ${typeof func}`);
        }
        
        if(typeof topic !== "string"){
            throw new Error(`Expected $topic type -> string. Instead receieved -> ${typeof topic}`);
        }

        if(!(topic in this.#event_func)){
            this.#event_func[topic] = func; 
        }

        if (![CONNECTED, DISCONNECTED, RECONNECT, this.#RECONNECTED,
            this.#RECONNECTING, this.#RECONN_FAIL, MESSAGE_RESEND].includes(topic)){
                if(!this.#topicMap.includes(topic)){
                    this.#topicMap.push(topic);
                }

            if(this.connected){
                // Connected we need to create a topic in a stream
                await this.#startConsumer(topic);
            }
        }
    }

    /**
     * A method to send a message to a topic.
     * Retry methods included. Stores messages in an array if offline.
     * @param {string} topic - Name of the room
     * @param {object} data - Data to send
     * @returns 
     */
    async publish(topic, data){
        if(topic == null || topic == undefined){
            throw new Error("$topic is null or undefined");
        }

        if(topic == ""){
            throw new Error("$topic cannot be an empty string")
        }

        if(typeof topic !== "string"){
            throw new Error(`Expected $topic type -> string. Instead receieved -> ${typeof topic}`);
        }

        if(!this.isTopicValid(topic)){
            throw new Error("Invalid topic, use isTopicValid($topic) to validate topic")
        }

        var start = Date.now()
        var messageId = crypto.randomUUID();

        var message = {
            "client_id": this.#getClientId(),
            "id": messageId,
            "room": topic,
            "message": data,
            "start": Date.now()
        }

        var encodedMessage = this.#codec.encode(message)

        if(this.connected){
            if(!this.#topicMap.includes(topic)){
                this.#topicMap.push(topic);

                await this.#createOrGetStream();
            }else{
                this.#log(`${topic} exists locally, moving on...`)
            }

            this.#log(`Publishing to topic => ${this.#getStreamTopic(topic)}`)
    
            const ack = await this.#jetstream.publish(this.#getStreamTopic(topic), encodedMessage);
            this.#log(`Publish Ack =>`)
            this.#log(ack)
    
            var latency = Date.now() - start;
            this.#log(`Latency => ${latency} ms`);

            return ack !== null && ack !== undefined;
        }else{
            this.#offlineMessageBuffer.push({
                topic: topic, 
                message: data
            });

            return false;
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
            let data = this.#offlineMessageBuffer[i];
            
            const topic = data.topic;
            const message = data.message;

            const output = await this.publish(topic, message);

            messageSentStatus.push({
                topic: topic,
                message: message,
                resent: output
            });
        }

        // Clearing out offline messages
        this.#offlineMessageBuffer.length = 0;

        // Send to client
        if(MESSAGE_RESEND in this.#event_func && messageSentStatus.length > 0){
            this.#event_func[MESSAGE_RESEND](messageSentStatus);
        }
    }

    // Room functions
    /**
     * Starts consumer for particular topic if stream exists
     * @param {string} topic 
     */
    async #startConsumer(topic){
        await this.#createOrGetStream();

        var opts = { 
            name: topic,
            filter_subjects: [this.#getStreamTopic(topic), this.#getStreamTopic(topic) + "_presence"],
            replay_policy: ReplayPolicy.Instant,
            opt_start_time: new Date(),
        }

        const consumer = await this.#jetstream.consumers.get(this.#getStreamName(), opts);
        this.#log(this.#topicMap)
        this.#log("Consumer is consuming");

        this.#consumerMap[topic] = consumer;

        await consumer.consume({
            callback: (msg) => {

                msg.ack();

                try{
                    var data = this.#codec.decode(msg.data);
                    var room = data.room;

                    this.#log(data);
                    const latency = Date.now() - data.start
                    this.#log(`Latency => ${latency}`)

                    // Push topic message to main thread
                    if (room in this.#event_func && data.client_id != this.#getClientId()){
                        this.#event_func[room]({
                            "id": data.id,
                            "data": data.message
                        });
                    }
                }catch(err){
                    this.#log("Consumer err " + err);
                    msg.nack();
                }
            }
        });
    }

    /**
     * Deletes consumer
     * @param {string} topic 
     */
    async #deleteConsumer(topic){
        const consumer = this.#consumerMap[topic]

        var del = false;

        if (consumer != null && consumer != undefined){
            del = await consumer.delete();
        }else{
            del = true
        }

        delete this.#consumerMap[topic];

        return del;
    }

    /**
     * Gets stream if it exists or creates one
     * @param {string} streamName 
     */
    async #createOrGetStream(){
        const streamName = this.#getStreamName();
        var stream = null;
        
        try{
            stream = await this.#jsManager.streams.info(streamName);
        }catch(err){
            stream = null;
        }

        this.#log(`STREAM => ${stream}`)

        if (stream == null){
            // Stream does not exist, create one
            await this.#jsManager.streams.add({
                name: streamName,
                subjects: [...this.#getStreamTopicList(), ...this.#getPresenceTopics()],
                ack_policy: AckPolicy.Explicit,
                delivery_policy: DeliverPolicy.New
            });

            this.#log(`${streamName} created`);
        }else{
            stream.config.subjects = [...this.#getStreamTopicList(), ...this.#getPresenceTopics()];
            await this.#jsManager.streams.update(streamName, stream.config);

            this.#log(`${streamName} exists, updating and moving on...`);
        }
    }

    // Utility functions
    #getClientId(){
        return this.#natsClient?.info?.client_id
    }

    /**
     * Checks if a topic can be used to send messages to.
     * @param {string} topic 
     * @returns 
     */
    isTopicValid(topic){
        if(topic !== null && topic !== undefined && (typeof topic) == "string"){
            return ![CONNECTED, DISCONNECTED, RECONNECT, this.#RECONNECTED,
                this.#RECONNECTING, this.#RECONN_FAIL, MESSAGE_RESEND].includes(topic);
        }else{
            return false;
        }
    }

    #getStreamName(){
        if(this.namespace != null){
            return this.namespace + "_stream"
        }else{
            this.close();
            throw new Error("$namespace is null. Cannot initialize program with null $namespace")
        }
    }

    #getStreamTopic(topic){
        if(this.namespace != null){
            return this.namespace + "_stream_" + topic;
        }else{
            this.close();
            throw new Error("$namespace is null. Cannot initialize program with null $namespace")
        }
    }

    #getStreamTopicList(){
        var topics = [];

        this.#topicMap.forEach((topic) => {
            topics.push(this.#getStreamTopic(topic))
        })

        return topics
    }

    #getPresenceTopics(){
        var presence = [];

        this.#topicMap.forEach((topic) => {
            presence.push(this.#getStreamTopic(topic) + "_presence")
        })

        return presence
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
        this.#log(this.opts)
        if(this.opts !== null && this.opts !== undefined){
            if(this.opts.max_retries !== null && this.opts.max_retries !== undefined){
                if (this.opts.max_retries <= 0){
                    return this.#maxPublishRetries; 
                }else{
                    return this.opts.max_retries;
                }
            }else{
                return this.#maxPublishRetries; 
            }
        }else{
            return this.#maxPublishRetries; 
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

    #getUserCreds(jwt, secret){
        var template = Buffer.from(this.#config, "base64").toString("utf8")

        var creds = template.replace("JWT_KEY", jwt);
        creds = creds.replace("SECRET_KEY", secret)

        return creds
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

    testGetStreamName(){
        if(process.env.NODE_ENV == "test"){
            return this.#getStreamName.bind(this);
        }else{
            return null; 
        }
    }

    testGetStreamTopic(){
        if(process.env.NODE_ENV == "test"){
            return this.#getStreamTopic.bind(this);
        }else{
            return null; 
        }
    }

    testGetTopicMap(){
        if(process.env.NODE_ENV == "test"){
            return this.#topicMap
        }else{
            return null; 
        }
    }

    testGetEventMap(){
        if(process.env.NODE_ENV == "test"){
            return this.#event_func
        }else{
            return null; 
        }
    }

    testGetConsumerMap(){
        if(process.env.NODE_ENV == "test"){
            return this.#consumerMap
        }else{
            return null; 
        }
    }
}

export const CONNECTED = "CONNECTED";
export const RECONNECT = "RECONNECT";
export const MESSAGE_RESEND = "MESSAGE_RESEND";
export const DISCONNECTED = "DISCONNECTED";