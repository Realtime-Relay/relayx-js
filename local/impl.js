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

    var realtime = new Realtime({
        api_key: "eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJhdWQiOiJOQVRTIiwibmFtZSI6InRlc3QgdXNlciIsInN1YiI6IlVCSE1SVVNUTkVLV0RaTTZJTURGMlNCU1RaMlFNR0RZRU5TTVZBU01RQjdPVTRTVllaQlBEWjRIIiwibmF0cyI6eyJkYXRhIjotMSwicGF5bG9hZCI6LTEsInN1YnMiOi0xLCJwdWIiOnsiZGVueSI6WyI-Il19LCJzdWIiOnsiZGVueSI6WyI-Il19LCJvcmdfZGF0YSI6eyJvcmdhbml6YXRpb24iOiJzcGFjZXgiLCJwcm9qZWN0IjoidGVzdCB1c2VyIn0sImlzc3Vlcl9hY2NvdW50IjoiQUNaSUpaQ0lYU1NVVTU1WUVHTVAyMzZNSkkyQ1JJUkZGR0lENEpWUTZXUVlaVVdLTzJVN1k0QkIiLCJ0eXBlIjoidXNlciIsInZlcnNpb24iOjJ9LCJpc3MiOiJBQ1pJSlpDSVhTU1VVNTVZRUdNUDIzNk1KSTJDUklSRkZHSUQ0SlZRNldRWVpVV0tPMlU3WTRCQiIsImlhdCI6MTczNTgxMDU5NCwianRpIjoiRVZVUWZiZVIrMmFvdVk5dmxOQXQ1R3FqTS9JWjhxS2FpYWJVU0ZVNVdQOGpma3JTZjJ4TzhtWUVxL0t1b040Rnh0dnhINFNSOTdlMFhIdjUxREg2dWc9PSJ9.pRgu2yjyItcq4Yd7JVoivYJkMyYBtcHwsaqmX53VSCFSsKG_Dc5VTJeni4PaUZVtgqXHJbUZAH2Lve0GMDzmDQ",
        secret: "SUAOSY5NMHDVHT3NAWM5IYLHAYIRRKNGF2PLTPVKYL5YD5TSG6E3QAYN2I"
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