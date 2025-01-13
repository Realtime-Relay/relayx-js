import { Realtime, CONNECTED, RECONNECT, DISCONNECTED, MESSAGE_RESEND } from "../realtime/realtime.js"

async function run(){
    var realtime = new Realtime({
        api_key: process.env.user_key,
        secret: process.env.secret
    });
    await realtime.init(true, {
        max_retries: 2,
        // debug: true
    });

    realtime.on(CONNECTED, async () => {
        console.log("[IMPL] => CONNECTED!");

        for (let angle = 0; angle <= 18000; angle++){

            var value = Math.floor(Math.random() * (100 + 1))
            console.log(value)

            // await realtime.publish("test-power-1", {
            //     "value": value,
            //     "time": Date.now() + 2000
            // })

            var sent = await realtime.publish("power-telemetry", {
                "value": value,
                "time": Date.now()
            });

            console.log(`Message sent => ${sent}`);

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