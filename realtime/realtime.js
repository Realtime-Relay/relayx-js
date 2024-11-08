import { io } from "socket.io-client";
import axios from 'axios';
import * as msgPackParser from 'socket.io-msgpack-parser';

export class Realtime {

    #event_func = {}; 
    #topicMap = []; 
    roomKeyEvents = ["connect", "room-message", "room-join", "disconnect"];

    publishRetryAttempt = 0; 
    maxPublishRetries = 5;

    constructor(api_key){
        this.api_key = api_key;
        this.namespace = ""; 
    }

    async init(opts){
        this.opts = opts;

        if (this.api_key !== null || this.api_key !== undefined){
            this.namespace = await this.#getNameSpace();
        }else{
            throw new Error("Undefined or null api key in constructor"); 
        }
    }

    async #getNameSpace() {
        var response = await axios.get("http://128.199.176.185:3000/get-namespace",{
            method: "GET",
            headers: {
                "Authorization": `Bearer ${this.api_key}`
            }
        });

        var data = response.data

        if (data.status === "SUCCESS"){
            return data.data.namespace;
        }else{
            return null;
        }
    }

    connect(){
        //128.199.176.185
        this.SEVER_URL = `http://128.199.176.185:3000/${this.namespace}`; 

        this.socket = io(this.SEVER_URL, {
            transports: [ "websocket", "polling" ],
            reconnectionDelayMax: 500,
            reconnection: true,
            extraHeaders: {
                "api-key": this.api_key
            },
            parser: msgPackParser
        });

        this.socket.on("connect", () => {
            console.log(`Connect => ${this.socket.id}`);

            // Let's call the callback function if it exists
            if (CONNECTED in this.#event_func){
                if (this.#event_func[CONNECTED] !== null || this.#event_func[CONNECTED] !== undefined){
                    this.#event_func[CONNECTED]()
                }
            }
        });
        
        this.socket.on("room-message", (data) => {
            var room = data.room; 

            if (room in this.#event_func){
                if (this.#event_func[room] !== null || this.#event_func[room] !== undefined){
                    this.#event_func[room](data.data)
                }
            }
        });

        this.socket.on("room-join", (data) => {
            var room = data.room; 
            var event = data.event;

            if (room in this.#event_func){
                this.#event_func[room](event);
            }
        });

        this.socket.io.on("ping", async (cb) => {
            console.log("PING");
        });

        this.socket.io.on("reconnect", (attempt) => {
            console.log("[RECONN] => Reconnected " + attempt);
        });

        this.socket.io.on("reconnect_attempt", (attempt) => {
            console.log("[RECON_ATTEMPT] => " + attempt);
        });

        this.socket.io.on("reconnect_failed", () => {
            console.log("[RECONN_FAIL] => Reconnection failed");
        });
        
        this.socket.on("disconnect", (reason, details) => {
            console.log(reason, details);
            console.log("Disconnected"); 
    
            // Removing all listeners
            this.socket.removeAllListeners();

            // Let's call the callback function if it exists
            if (DISCONNECTED in this.#event_func){
                if (this.#event_func[DISCONNECTED] !== null || this.#event_func[DISCONNECTED] !== undefined){
                    this.#event_func[DISCONNECTED]()
                }
            }
        });
    }

    off(topic){
        if (this.#topicMap.includes(topic)){
            this.#topicMap.delete(topic); 
        }
    }

    async on(topic, func){
        var subscribed = false; 

        if (![CONNECTED, PRESENCE, ...this.roomKeyEvents].includes(topic)){
            //Which means this is a topic and not an event
            if (topic !== null || topic !== undefined){
                // Are we connected to this room?
                if (!this.#topicMap.includes(topic)){
                    // If not, connect and wait for an ack
                    var response = await this.socket.emitWithAck("enter-room", {
                        "room": topic
                    })
        
                    if (response["status"] == "JOINED_ROOM" || response["status"] == "ROOM_CREATED"){
                        this.#topicMap.push(response.room)
                        subscribed = true; 
                    }else{
                        subscribed = false; 
                    }
                }else{
                    subscribed = false; 
                }
            }else{
                subscribed = false; 
            }

            if (subscribed){
                this.#event_func[topic] = func; 
            }
        }else{
            this.#event_func[topic] = func; 
        }
    }

    async publish(topic, data){
        if (topic !== null || topic !== undefined){
            await this.#sleep(1);

            // Are we connected to this room?
            if (!this.#topicMap.includes(topic)){
                // If not, connect and wait for an ack
                var response = await this.socket.emitWithAck("enter-room", {
                    "room": topic
                });
    
                console.log(response)
                if (response["status"] == "JOINED_ROOM" || response["status"] == "ROOM_CREATED"){
                    this.#topicMap.push(response.room)
                }
            }

            // We are now connected or we already were. Send message to room
            try{
                var start = Date.now()
                var relayResponse = await this.socket.timeout(1).emitWithAck("relay-to-room", {
                    "id": crypto.randomUUID(),
                    "room": topic,
                    "message": data
                });

                var end = Date.now()
                var latency = end - start;
                console.log(`LATENCY => ${latency} ms`);

                this.publishRetryAttempt = 0; 
            }catch(err){
                console.error(err);

                // Specifically to handle timeout errors
                if (err.message.includes("operation has timed out")){
                    ++this.publishRetryAttempt;

                    if(this.publishRetryAttempt < this.#getPublishRetry()){
                        console.log(`Retrying publish(${topic}, ${data})`);
                        await this.publish(topic, data);
                    }else{
                        console.log(topic, data); 
                        console.log(`Attempted to publish ${this.publishRetryAttempt} times and failed!`);

                        relayResponse = {
                            "status": "PUBLISH_FAIL_TO_SEND",
                            "data": {
                                "retry_attempts": this.publishRetryAttempt
                            }
                        }
    
                        this.publishRetryAttempt = 0; 
                    }
                }
            }

            console.log(relayResponse)

            return relayResponse;
        }else{
            return null;
        }
    }

    // Utility functions
    #sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
}

export const CONNECTED = "CONNECTED";
export const DISCONNECTED = "DISCONNECTED";
export const PRESENCE = "PRESENCE";