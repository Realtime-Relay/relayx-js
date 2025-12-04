import { Realtime, CONNECTED, RECONNECT, DISCONNECTED, MESSAGE_RESEND } from "../realtime/realtime.js"
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var queue = null;

async function run(){
    var realtime = new Realtime({
        api_key: process.env.AUTH_JWT,
        secret: process.env.AUTH_SECRET
    });
    await realtime.init({
        staging: true, 
        opts: {
            max_retries: 2,
            debug: false
        }
    });

    queue = await realtime.initQueue("692adca3af5ed9d55e1b1ece");

    realtime.on(CONNECTED, async (connected) => {
        console.log(`[IMPL] => ${connected ? 'CONNECTED!' : "AUTH FAILURE"}`);

        if(!connected){
            return;
        }

        var kvStore = await realtime.initKVStore();
        console.log(`KV Store => ${kvStore}`)

        console.log("Put()")
        await kvStore.put("key1", {
            hey: "World!"
        })

        await kvStore.put("key2", [{
            hey: "World!"
        }])

        await kvStore.put("key3", [123, 123, 123])

        await kvStore.put("key4", "hey!")

        await kvStore.put("key5", ["hey", "heyb"])

        await kvStore.put("key6", 123)

        await kvStore.put("key6", null)

        await kvStore.put("key7", undefined)

        await kvStore.put("key8", true)

        await kvStore.put("key9", false)

        await kvStore.put("key10", 10.123)

        console.log()
        console.log("get()")
        console.log(await kvStore.get("key1"))

        console.log()
        console.log("keys()")
        var keys = await kvStore.keys()
        console.log(keys)

        for(const k of keys){
            console.log()
            console.log(`get(${k})`)
            console.log(await kvStore.get(k))
        }

        for(const k of keys){
            console.log()
            console.log(`delete(${k})`)
            await kvStore.delete(k)
        }
        
        console.log()
        console.log("keys()")
        var keys = await kvStore.keys()
        console.log(keys)

        queue = await realtime.initQueue("692adca3af5ed9d55e1b1ece");

        var config = {
            name: "Test434",
            group: "test-group",
            topic: "queue.>",
            // backoff: [2, 5, 10],
            "ack_wait": 2
        }

        var count = 0;

        queue.consume(config, (msg) => {
            console.log(`Queue: ${msg.message}`)
            
            msg.ack();
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
        }else if(input == "delete_consumer"){
            rl.question("Consumer name: ", async (name) => {
                var del = await queue.deleteConsumer(name);
                console.log(del)
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