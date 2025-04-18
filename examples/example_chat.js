import { Realtime, CONNECTED, RECONNECT, DISCONNECTED, MESSAGE_RESEND } from "../realtime/realtime.js"
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function run(){
    var realtime = new Realtime({
        api_key: "eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJhdWQiOiJOQVRTIiwibmFtZSI6IjY4MDI2NzhlZWEyMDE2OGY3MmQxZTkzMiIsInN1YiI6IlVCUVhVRlhSTzQ0MzRJV0tBSlJURlJWUEFNUzNIRFdTTlVTWElWN1pGTUNPUFpIMlU3Vk9LM0NLIiwibmF0cyI6eyJkYXRhIjotMSwicGF5bG9hZCI6LTEsInN1YnMiOi0xLCJwdWIiOnsiZGVueSI6WyI-Il19LCJzdWIiOnsiZGVueSI6WyI-Il19LCJvcmdfZGF0YSI6eyJvcmdfaWQiOiI2ODAyNGJiNTMwMmYxMjY2Y2RjODFhMDUiLCJvcmdfbmFtZSI6IlNwYWNlWCIsInZhbGlkaXR5X2tleSI6IjA4M2NhNDc1LTg2YzktNDFhMC1iYTg1LTk4MTE2NmMwNzk0MiIsInJvbGUiOiJ1c2VyIiwicHJvamVjdF9pZCI6IjY4MDI2NzhlZWEyMDE2OGY3MmQxZTkzMiJ9LCJpc3N1ZXJfYWNjb3VudCI6IkFCMzczR0JSWkVMNEhLNUdXWkJNNFNVTEFLVUhZSTVNUE9UWVNKQUpCVVVNU01KT09XREhFMjVYIiwidHlwZSI6InVzZXIiLCJ2ZXJzaW9uIjoyfSwiaXNzIjoiQUIzNzNHQlJaRUw0SEs1R1daQk00U1VMQUtVSFlJNU1QT1RZU0pBSkJVVU1TTUpPT1dESEUyNVgiLCJpYXQiOjE3NDQ5OTE3MDYsImp0aSI6ImZRUlJhbmJUMkpHL2l2bGFYMkg4QTF6YlZvRm1yZFlxMHVZNzVUOTZ5aGVLUUVFUDNDY2Fqd1hkL0hmL08wK3dTVDBlZXppTWlxaEFUaFNLTE1EWGFBPT0ifQ.Lu9QjgEZiMNYWUolWAHMx0yx4BL0pn3YT2o2zrBTbhuHtbqtLiFsnnWga_4Y5rLi4btsBodWkByXynB3KYsXDA",
        secret: "SUANCRBG4Q2BZLIHNBQXHJLK557LFCWJBSZ2DBJRRNQELPVMF4PTT2BHOM"
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

    await realtime.on("power-telemetry", (data) => {
        console.log("power-telemetry", data);
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
                var past = end.setDate(end.getDate())
                var endDate = new Date(past)

                var history = await realtime.history(topic, pastDate)
                console.log(history)
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