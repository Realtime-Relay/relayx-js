import { Realtime, CONNECTED, RECONNECT, DISCONNECTED, MESSAGE_RESEND } from "../realtime/realtime.js"
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var queue = null;

async function run(){
    var realtime = new Realtime({
        api_key: "eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJhdWQiOiJOQVRTIiwibmFtZSI6IjY5MmFkY2JkYWY1ZWQ5ZDU1ZTFiMWVjZiIsInN1YiI6IlVBM0JERzc0QVhUVEVMNlZONlhSNUpWMkNMWE8yVUFHSTVLNlNWVkJXU1NES0c2T1dIN1FRN0syIiwibmF0cyI6eyJkYXRhIjotMSwicGF5bG9hZCI6LTEsInN1YnMiOi0xLCJwdWIiOnsiZGVueSI6WyI-Il19LCJzdWIiOnsiZGVueSI6WyI-Il19LCJvcmdfZGF0YSI6eyJvcmdfaWQiOiI2OTI1ZTAzMTFiNjFkNDljZGVjMDMyNzgiLCJ2YWxpZGl0eV9rZXkiOiI4NTQ1NzY1Mi0wMWNiLTRlYWEtOGZkMi05MWRmZmE2NTJiZDciLCJyb2xlIjoidXNlciIsImFwaV9rZXlfaWQiOiI2OTJhZGNiZGFmNWVkOWQ1NWUxYjFlY2YiLCJlbnYiOiJ0ZXN0In0sImlzc3Vlcl9hY2NvdW50IjoiQUFZWENCNVZHR0tDSlRKRkZJRUY3WVMzUFZBNk1PQVRYRVRRSDdMM0hXT01TNVJTSFRQWFJCSEsiLCJ0eXBlIjoidXNlciIsInZlcnNpb24iOjJ9LCJpc3MiOiJBQVlYQ0I1VkdHS0NKVEpGRklFRjdZUzNQVkE2TU9BVFhFVFFIN0wzSFdPTVM1UlNIVFBYUkJISyIsImlhdCI6MTc2NDQxNjcwMiwianRpIjoiaU5hLzBhek9GN3hZak9aUmpYbEE5RE1jQ3JVL2FEQ0YxWmU1YlRibXk4L2pVYUpEanFBRGpTd2hGRmREcVlXS2VjeWZ4Z1VIWlhiWnJKYW1kWGRkSnc9PSJ9.PkbEkqW_rQ4iMX_BJPH6Qio3AluAo0c-VYwnobnybiCUc7PKn1bOWDuUbmIrhNr8v_fwcWmMGS2v_Na7u8SpCA",
        secret: "SUAFR63MY4H7HB7YGHJJHE6HKCAGPAXKSSY4IGGIZHQ4A4WGXV7XSKMQ2Y"
    });
    await realtime.init(true, {
        max_retries: 2,
        debug: true
    });

    realtime.on(CONNECTED, async () => {
        console.log("[IMPL] => CONNECTED!");

        queue = await realtime.initQueue("692adca3af5ed9d55e1b1ece");

        var config = {
            name: "Test434",
            group: "test-group",
            topic: "queue.>",
            backoff: [10, 20, 30],
        }

        var count = 0;

        queue.consume(config, (msg) => {
            console.log(msg.message)
            
            msg.ack();

            ++count;

            if(count == 2){
                queue.detachConsumer("queue.>")
            }
        })
    });

    realtime.on(RECONNECT, (status) => {
        console.log(`[IMPL] RECONNECT => ${status}`)
    });

    realtime.on(DISCONNECTED, () => {
        console.log(`[IMPL] DISCONNECT`)
    });

    await realtime.on("power-telemetry", (data) => {
        console.log("power-telemetry", data);
    });

    // await realtime.on("hello.*", (data) => {
    //     console.log("hello.*", data);
    // });

    await realtime.on("hello.>", async (data) => {
        console.log("hello.>", data);
    });

    // await realtime.on("hello.hey.*", (data) => {
    //     console.log("hell.hey.*", data);
    // });`

    // await realtime.on("hello.hey.>", (data) => {
    //     console.log("hello.hey.>", data);
    // });

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
                var past = start.setDate(start.getDate() - 1)
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
                var output = await queue.publish(topic, input);
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