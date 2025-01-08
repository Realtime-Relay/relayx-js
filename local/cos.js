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
    var realtime = new Realtime({
        api_key: "eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJhdWQiOiJOQVRTIiwibmFtZSI6InRlc3QgdXNlciIsInN1YiI6IlVEWUxXT01GVDNKSE9TQkdCQkRCUDZJWlQzSDNDRFVYNUJUUFJUWEVGWU1RUTZRVU1WMlQ0VUdGIiwibmF0cyI6eyJkYXRhIjotMSwicGF5bG9hZCI6LTEsInN1YnMiOi0xLCJwdWIiOnsiZGVueSI6WyI-Il19LCJzdWIiOnsiZGVueSI6WyI-Il19LCJvcmdfZGF0YSI6eyJvcmdhbml6YXRpb24iOiJzcGFjZXgiLCJwcm9qZWN0IjoidGVzdCB1c2VyIn0sImlzc3Vlcl9hY2NvdW50IjoiQUNaSUpaQ0lYU1NVVTU1WUVHTVAyMzZNSkkyQ1JJUkZGR0lENEpWUTZXUVlaVVdLTzJVN1k0QkIiLCJ0eXBlIjoidXNlciIsInZlcnNpb24iOjJ9LCJpc3MiOiJBQ1pJSlpDSVhTU1VVNTVZRUdNUDIzNk1KSTJDUklSRkZHSUQ0SlZRNldRWVpVV0tPMlU3WTRCQiIsImlhdCI6MTczNTgyOTQzOSwianRpIjoicG5TVitjaU5RYlFnaTBiWmVyOG5OZ0lBT25CR2tWdHFqZnFwQ3FmK0xVa0RIR3dXTmpyTnpjdENqejhSbU1HSWQybkxrZnFUbEl6RXI4N3NQZUludWc9PSJ9.RbrFrw0N28mRJF8t8wg-wHrdmLUT6_B1YYlBSi5n2rrA7GUhqQZpH52v0VZ_wTYan81c9qU9LlCRK9ZL5f6hAw",
        secret: "SUAPIZLO2JP35DEALLKOIJ4U4IEA4XCJKZCHN2SXJR35H737H2RAZFXHYA"
    });
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

        for (let angle = 0; angle <= 18000; angle++){

            var value = Math.floor(Math.random() * (100 + 1))
            console.log(value)

            await realtime.publish("test-topic", {
                "value": value,
                "time": Date.now() + 2000
            })

            await realtime.sleep(100)
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