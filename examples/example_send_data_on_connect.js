import { Realtime, CONNECTED, RECONNECT, DISCONNECTED, MESSAGE_RESEND } from "../realtime/realtime.js"

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

        for (let angle = 0; angle <= 18000; angle++){

            var value = Math.floor(Math.random() * (100 + 1))
            // console.log(value)

            // await realtime.publish("test-power", {
            //     "value": value,
            //     "time": Date.now() + 2000
            // })

            var sent = await realtime.publish("power-telemetry", {
                "value": value,
                "time": Date.now()
            });

            // console.log(`Message sent => ${sent}`);

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