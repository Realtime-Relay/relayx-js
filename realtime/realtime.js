import { io } from "socket.io-client";
import axios from 'axios';

export class Realtime {

    #event_func = {}; 
    #topicMap = []; 
    roomKeyEvents = ["connect", "room-message", "room-join", "disconnect"]

    constructor(api_key){
        this.api_key = api_key;
        this.namespace = ""; 
    }

    async init(){
        if (this.api_key !== null || this.api_key !== undefined){
            this.namespace = await this.#getNameSpace();
        }else{
            throw new Error("Undefined or null api key in constructor"); 
        }
    }

    async #getNameSpace() {
        var response = await axios.get("http://127.0.0.1:3000/get-namespace",{
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
        this.SEVER_URL = `http://127.0.0.1:3000/${this.namespace}`; 

        this.socket = io(this.SEVER_URL, {
            transports: [ "websocket", "polling" ],
            extraHeaders: {
                "api-key": this.api_key
            }
        });

        this.socket.on("connect", () => {
            console.log(`Connect => ${this.socket.id}`);

            // Let's call the callback function if it exists
            if (CONNECTED in this.#event_func){
                this.#event_func[CONNECTED]()
            }
        });
        
        this.socket.on("room-message", (data) => {
            var room = data.room; 

            if (room in this.#event_func){
                this.#event_func[room](data.data)
            }
        });

        this.socket.on("room-join", (data) => {
            var room = data.room; 
            var event = data.event;

            if (room in this.#event_func){
                this.#event_func[room](event);
            }
        });
        
        this.socket.on("disconnect", (reason, details) => {
            if (this.socket.active) {
                // temporary disconnection, the socket will automatically try to reconnect
                console.log("Disconnected, will reconnect"); 
            } else {
                // the connection was forcefully closed by the server or the client itself
                // in that case, `socket.connect()` must be manually called in order to reconnect
                console.log(reason, details);
                console.log("Disconnected"); 
        
                // Removing all listeners
                socket.removeAllListeners();
            }
        });
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
            // Are we connected to this room?
            if (!this.#topicMap.includes(topic)){
                // If not, connect and wait for an ack
                var response = await this.socket.emitWithAck("enter-room", {
                    "room": topic
                })
    
                if (response["status"] == "JOINED_ROOM" || response["status"] == "ROOM_CREATED"){
                    this.#topicMap.push(response.room)
                }
            }

            // We are now connected or we already were. Send message to room
            var relayResponse = await this.socket.emit("relay-to-room", {
                "room": topic,
                "message": data
            });

            return relayResponse;
            
        }else{
            return null;
        }
    }
}

export const CONNECTED = "CONNECTED";
export const PRESENCE = "PRESENCE";