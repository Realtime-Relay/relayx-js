import { Realtime, CONNECTED, RECONNECT, DISCONNECTED, MESSAGE_RESEND } from "../realtime/realtime.js"
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function run(){
    // await throttle.start(options["fois"]);

    var realtime = new Realtime({
        api_key: "eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJhdWQiOiJOQVRTIiwibmFtZSI6IkRyYWdvbiBQcm9ncmFtIiwic3ViIjoiVURZVTJTNUtPUDRNNzNCWkJHNFVYSE1GUVQzVTRNUVpCWlA0TjNXQkI3UTJLRlZBUkpaTzdNMjciLCJuYXRzIjp7ImRhdGEiOi0xLCJwYXlsb2FkIjotMSwic3VicyI6LTEsInB1YiI6eyJkZW55IjpbIj4iXX0sInN1YiI6eyJkZW55IjpbIj4iXX0sIm9yZ19kYXRhIjp7Im9yZ2FuaXphdGlvbiI6InNwYWNleCIsInByb2plY3QiOiJEcmFnb24gUHJvZ3JhbSJ9LCJpc3N1ZXJfYWNjb3VudCI6IkFDWklKWkNJWFNTVVU1NVlFR01QMjM2TUpJMkNSSVJGRkdJRDRKVlE2V1FZWlVXS08yVTdZNEJCIiwidHlwZSI6InVzZXIiLCJ2ZXJzaW9uIjoyfSwiaXNzIjoiQUNaSUpaQ0lYU1NVVTU1WUVHTVAyMzZNSkkyQ1JJUkZGR0lENEpWUTZXUVlaVVdLTzJVN1k0QkIiLCJpYXQiOjE3MzYzNDM0NjcsImp0aSI6ImxPU2lNS1Y5TjRkMVJHYzlqMjFmSlZLc2Vsb3R5VHRiZzNwQmVIcWh5eS9mQ2FBVVF3Z2QwUTNPWWZLTjlDWEtMSXpiNld5VlFwZFUvdHlhTktVTStnPT0ifQ.D47HdbXzUrq0mtua7TZtbjSMYnfvPdf69Lk7WlwHMqDp3L2sAG6lvZxwsCWZa6rdnaRSoAJ5NNxQ8gXqa6TzAA",
        secret: "SUANMWHWAH65EJO4P7J74YDZHIB2IVXETDFZT5T2XT275AMJF5GMUUIUZI"
    });
    await realtime.init({
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