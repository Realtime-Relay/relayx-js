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
    var realtime = new Realtime("eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJhdWQiOiJOQVRTIiwibmFtZSI6InRlc3QgdXNlciIsInN1YiI6IlVEUUJZVlZJU0dIWDNQNjZUT1E2MjU0VUJVQVZVWEFZWEQzNUE0RE5RTlBPVDVHWE1RSjRDTE1JIiwibmF0cyI6eyJkYXRhIjotMSwicGF5bG9hZCI6LTEsInN1YnMiOi0xLCJwdWIiOnt9LCJzdWIiOnt9LCJpc3N1ZXJfYWNjb3VudCI6IkFESDVPTjVUUE1BNEhNNFMzNVNLVEJRUU41Wjc0SlJRVUNLNkhCSFZGTTdVNFlBRkhFTUo1MlI1IiwidHlwZSI6InVzZXIiLCJ2ZXJzaW9uIjoyfSwiaXNzIjoiQURINU9ONVRQTUE0SE00UzM1U0tUQlFRTjVaNzRKUlFVQ0s2SEJIVkZNN1U0WUFGSEVNSjUyUjUiLCJpYXQiOjE3MzU0NDYwNDEsImp0aSI6IklpR2N6U0hGTCtSdFl3Q0dOb09uenN1a3k4Wi9FaHVEekZOWU1HT0N6cE53b1dBL29PQ2IvWUpZQlVCZkMycmE5a09QL3ZJMWtkaWNWblI1OWYzYWlBPT0ifQ.FjTpTJWGmtKth2UFR_hRwvlHHkwZxoCKDH_aX4_IIRCDyR2UQonBDI3FE5TMJmR-V6IEJTEz0IGiy1C_4P01Aw");
    await realtime.init(false, {
        max_retries: 2,
        debug: true
    });

    realtime.setUser({
        "user": "test",
        "id": 123
    });

    realtime.on(CONNECTED, async () => {
        console.log("[IMPL] => CONNECTED!");

        for (let angle = 0; angle <= 18000; angle++){

            var value = Math.floor(Math.random() * (100 + 1))
            console.log(value)

            await realtime.publish("test-topic", {
                "value": value,
                "time": Date.now() + 2000
            })

            // await realtime.sleep(100)
        }
    });

    realtime.on(RECONNECT, (status) => {
        console.log(`[IMPL] RECONNECT => ${status}`)
    });

    realtime.on(DISCONNECTED, () => {
        console.log(`[IMPL] DISONNECT`)
    });

    realtime.on(MESSAGE_RESEND, (data) => {
        console.log(`[MSG RESEND] => ${data}`)
    });

    realtime.connect();
    
}

await run();