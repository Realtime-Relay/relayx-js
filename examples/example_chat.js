import { Realtime, CONNECTED, RECONNECT, DISCONNECTED, MESSAGE_RESEND } from "../realtime/realtime.js"
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function run(){
    var realtime = new Realtime({
        api_key: "eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJhdWQiOiJOQVRTIiwibmFtZSI6IjY3ZmE0ZjVmM2U3Yjc5MjA2ZThmNWQ5YiIsInN1YiI6IlVESElCRFY2UkdIREdDSEdZWjM3QU5FUlY3STI3U0VMN0dBWlpNRUxPSjNVUFZWRVVDUjJLRExVIiwibmF0cyI6eyJkYXRhIjotMSwicGF5bG9hZCI6LTEsInN1YnMiOi0xLCJwdWIiOnsiZGVueSI6WyI-Il19LCJzdWIiOnsiZGVueSI6WyI-Il19LCJvcmdfZGF0YSI6eyJvcmdfaWQiOiI2N2Y4ZjJhZTRiMWM0ODFlZjRjMzI4NWYiLCJvcmdfbmFtZSI6IlNwYWNlWCIsInByb2plY3RfaWQiOiI2N2ZhNGY1ZjNlN2I3OTIwNmU4ZjVkOWIiLCJ2YWxpZGl0eV9rZXkiOiJiNTU3ODY0OC05OWVjLTRmMjEtYjI5Ni1kNzkyYjFlN2M4NjgifSwiaXNzdWVyX2FjY291bnQiOiJBQjM3M0dCUlpFTDRISzVHV1pCTTRTVUxBS1VIWUk1TVBPVFlTSkFKQlVVTVNNSk9PV0RIRTI1WCIsInR5cGUiOiJ1c2VyIiwidmVyc2lvbiI6Mn0sImlzcyI6IkFCMzczR0JSWkVMNEhLNUdXWkJNNFNVTEFLVUhZSTVNUE9UWVNKQUpCVVVNU01KT09XREhFMjVYIiwiaWF0IjoxNzQ0NDU3NjQxLCJqdGkiOiJPTzdVQ2ZHZlAwNFptZUVxcFY3eDdjdzNWdit2bXQ4Mi9Wd0w1SEpIN0Q4MkhQQ05MKzNXSWxVcFcvcmtlK00zRDRxenB5cnp6SSsvSVM5NWFTZ3NiQT09In0.Nb416uR9SfBXOjYtPsGyKsectrvfjQiZ-7ICQUNITBX6y_QHS-0NqaS8wLKnN8tQHEMbOou0CCPea5ztwdgIDg",
        secret: "SUANTWZ3SXBXY3I6RC32U3T6GM2BSP7DADXZVL6JCKPP7IUWEXIRWB7Z5Q"
    });
    await realtime.init(true, {
        max_retries: 2,
        debug: true
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
            rl.question("topic: ", async (topic) => {
                var start = new Date();
                var past = start.setDate(start.getDate() - 4)
                var pastDate = new Date(past)

                var end = new Date();
                var past = end.setDate(end.getDate() - 2)
                var endDate = new Date(past)

                var history = await realtime.history(topic, pastDate, endDate)
                // console.log(history)
            })
        }else if(input == "off"){
            rl.question("topic to off(): ", async (topic) => {
                await realtime.off(topic);
                console.log("off() executed")
            })

            
        }else if(input == "close"){
            realtime.close();
            console.log("Connection closed");
        }else if(input == "init"){
            await realtime.connect()
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
        }
    });

    realtime.connect();

    process.on('SIGINT', async () => {
        console.log('Keyboard interrupt detected (Ctrl+C). Cleaning up...');
        // Perform any necessary cleanup here
    
        // Exit the process
        process.exit();
    });
    
}

await run();