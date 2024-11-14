import axios from 'axios';

/**
 * Class responsible for getting messages stored in the DB
 */
export class History{
    
    #api_key = null;
    #staging = null;
    #baseUrl = null;
    #debug = null;

    constructor(api_key){
        this.#api_key = api_key;
    }

    init(staging, debug){
        this.#staging = staging;
        this.#debug = debug;

        this.#setBaseUrl();
    }

    /**
     * Get message from DB since a $timestamp
     * @param {number} timestamp - unix timestamp
     * @param {number} page - page number of pagination
     * @param {number} limit - limit per page
     * @returns - Message array
     */
    async getMessagesSince(timestamp, page, limit){
        if(timestamp == null || timestamp == undefined){
            throw new Error("$timestamp variable missing in getMessagesSince()");
        }else{
            if(!Number.isInteger(timestamp) || !Number.isNaN(timestamp)){
                throw new Error("$timestamp is either NaN or not an invalid integer");
            }
        }

        if(page == null || page == undefined){
            throw new Error("$page variable missing in getMessagesSince()");
        }else{
            if(!Number.isInteger(page) || !Number.isNaN(page)){
                throw new Error("$page is either NaN or not an invalid integer");
            }
        }

        if(limit == null || limit == undefined){
            throw new Error("$limit variable missing in getMessagesSince()");
        }else{
            if(!Number.isInteger(limit) || !Number.isNaN(limit)){
                throw new Error("$limit is either NaN or not an invalid integer");
            }
        }

        try{
            var response = await axios.get(this.#baseUrl + `/history/since?timestamp=${timestamp}&page=${page}&limit=${limit}`,{
                headers: {
                    "Authorization": `Bearer ${this.#api_key}`
                }
            });

            var data = response.data
            this.#log(data);

            if (data?.status === "SUCCESS"){
                return data.data;
            }else{
                return null;
            }
       }catch(err){
            throw new Error(err.message);
       }
    }

    /**
     * Get message from DB by ID
     * @param {string} id - ID of the message
     * @returns - Message object
     */
    async getMessageById(id){
        if(id !== null && id !== undefined){
            try{
                var response = await axios.get(this.#baseUrl + `/history/message-by-id?id=${id}`,{
                    headers: {
                        "Authorization": `Bearer ${this.#api_key}`
                    }
                });
    
                var data = response.data
                this.#log(data);
    
                if (data?.status === "SUCCESS"){
                    return data.data;
                }else{
                    return null;
                }
           }catch(err){
                throw new Error(err.message);
           }
        }else{
            return null;
        }
    }

    // Utility Functions
    /**
     * Constructs base url based on staging flag
     */
    #setBaseUrl(){
        if (this.#staging !== undefined || this.#staging !== null){
            this.#baseUrl = this.#staging ? "http://127.0.0.1:3000" : "http://128.199.176.185:3000";
        }else{
            this.#baseUrl = "http://128.199.176.185:3000";
        }
    }

    #log(msg){
        if(this.#debug !== null && this.#debug !== undefined && (typeof this.#debug == "boolean")){
            if(this.#debug){
                console.log(msg);
            }
        }
    }

}