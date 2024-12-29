import { Realtime, CONNECTED, RECONNECT, DISCONNECTED, MESSAGE_RESEND } from "../realtime/realtime.js"
import * as throttle from '@sitespeed.io/throttle'
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const options = {
    "3g": {up:768, down:1600, rtt:150},
    "3gfast": {up:768, down:1600, rtt:75},
    "3gslow": {up:400, down:400, rtt:200},
    "2g": {up:256, down:280, rtt:400},
    "cable": {up:1000, down:5000, rtt:14},
    "dsl": {up:384, down:1500, rtt:14},
    "3gem": {up:400, down:400, rtt:200},
    "4g": {up:9000, down:9000, rtt:85},
    "lte": {up:12000, down:12000, rtt:35},
    "edge": {up:200, down:240, rtt:35},
    "dial": {up:30, down:49, rtt:60},
    "fois": {up:5000, down:20000, rtt:2},
    "custom": {up:20, down:50, rtt:600}
};

async function run(){
    // await throttle.start(options["fois"]);

    var realtime = new Realtime("eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJhdWQiOiJOQVRTIiwibmFtZSI6InRlc3QgdXNlciIsInN1YiI6IlVEUUJZVlZJU0dIWDNQNjZUT1E2MjU0VUJVQVZVWEFZWEQzNUE0RE5RTlBPVDVHWE1RSjRDTE1JIiwibmF0cyI6eyJkYXRhIjotMSwicGF5bG9hZCI6LTEsInN1YnMiOi0xLCJwdWIiOnt9LCJzdWIiOnt9LCJpc3N1ZXJfYWNjb3VudCI6IkFESDVPTjVUUE1BNEhNNFMzNVNLVEJRUU41Wjc0SlJRVUNLNkhCSFZGTTdVNFlBRkhFTUo1MlI1IiwidHlwZSI6InVzZXIiLCJ2ZXJzaW9uIjoyfSwiaXNzIjoiQURINU9ONVRQTUE0SE00UzM1U0tUQlFRTjVaNzRKUlFVQ0s2SEJIVkZNN1U0WUFGSEVNSjUyUjUiLCJpYXQiOjE3MzU0NDYwNDEsImp0aSI6IklpR2N6U0hGTCtSdFl3Q0dOb09uenN1a3k4Wi9FaHVEekZOWU1HT0N6cE53b1dBL29PQ2IvWUpZQlVCZkMycmE5a09QL3ZJMWtkaWNWblI1OWYzYWlBPT0ifQ.FjTpTJWGmtKth2UFR_hRwvlHHkwZxoCKDH_aX4_IIRCDyR2UQonBDI3FE5TMJmR-V6IEJTEz0IGiy1C_4P01Aw");
    await realtime.init(true, {
        max_retries: 2,
        debug: true
    });

    realtime.setUser({
        "user": "test",
        "id": 123
    });

    realtime.on(CONNECTED, async () => {
        console.log("[IMPL] => CONNECTED!");
    });

    realtime.on(RECONNECT, (status) => {
        console.log(`[IMPL] RECONNECT => ${status}`)
    });

    realtime.on(DISCONNECTED, () => {
        console.log(`[IMPL] DISONNECT`)
    });

    await realtime.on("hello", (data) => {
        console.log("hello", data);
    });

    await realtime.on("hello1", (data) => {
        console.log("hello1", data);
    });

    realtime.on(MESSAGE_RESEND, (data) => {
        console.log(`[MSG RESEND] => ${data}`)
    });

    rl.on('line', async (input) => {
        console.log(`You entered: ${input}`);

        if(input == "exit"){
            var output = await realtime.off("hello"); 
            console.log(output);

            realtime.close();

            process.exit();
        }else if(input == "history"){
            var since = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago

            var history = await realtime.history.getMessagesSince("hello", since, 1, 1000);
            console.log(history);
        }else if(input == "off"){
            rl.question("topic to off(): ", async (topic) => {
                await realtime.off(topic);
                console.log("off() executed")
            })

            
        }else if(input == "close"){
            realtime.close();
            console.log("Connection closed");
        }else if(input == "on"){
            rl.question("topic: ", async (topic) => {
                await realtime.on(topic, (data) => {
                    console.log(topic, data);
                });
            })
        }else{
            rl.question("topic: ", async (topic) => {
                var output = await realtime.publish(topic, {
                    "data": input
                });
            })

            // var history = await realtime.history.getMessageById(output["message"]["id"]);
            // console.log(history);
        }
    });

    realtime.connect();

    process.on('SIGINT', async () => {
        console.log('Keyboard interrupt detected (Ctrl+C). Cleaning up...');
        // Perform any necessary cleanup here

        // await throttle.stop();
    
        // Exit the process
        process.exit();
    });
    
}

await run();