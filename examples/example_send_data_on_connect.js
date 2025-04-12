import { Realtime, CONNECTED, RECONNECT, DISCONNECTED, MESSAGE_RESEND } from "../realtime/realtime.js"

async function run(){
    var realtime = new Realtime({
        api_key: "eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJhdWQiOiJOQVRTIiwibmFtZSI6IjY3ZmE0ZjVmM2U3Yjc5MjA2ZThmNWQ5YiIsInN1YiI6IlVCRERJVTJWNFFaTzNVM05MNENVVkpHUDRKRjZMN0JHM1RaT1BNRVk2T1ZNRTdINVBHSDVHWUpXIiwibmF0cyI6eyJkYXRhIjotMSwicGF5bG9hZCI6LTEsInN1YnMiOi0xLCJwdWIiOnsiZGVueSI6WyI-Il19LCJzdWIiOnsiZGVueSI6WyI-Il19LCJvcmdfZGF0YSI6eyJvcmdfaWQiOiI2N2Y4ZjJhZTRiMWM0ODFlZjRjMzI4NWYiLCJvcmdfbmFtZSI6IlNwYWNlWCIsInByb2plY3RfaWQiOiI2N2ZhNGY1ZjNlN2I3OTIwNmU4ZjVkOWIiLCJ2YWxpZGl0eV9rZXkiOiJjYzM0MmFhMy1jMTU4LTRjYTMtYmZlOC04NzEyMWVlZjcyNTIifSwiaXNzdWVyX2FjY291bnQiOiJBQjM3M0dCUlpFTDRISzVHV1pCTTRTVUxBS1VIWUk1TVBPVFlTSkFKQlVVTVNNSk9PV0RIRTI1WCIsInR5cGUiOiJ1c2VyIiwidmVyc2lvbiI6Mn0sImlzcyI6IkFCMzczR0JSWkVMNEhLNUdXWkJNNFNVTEFLVUhZSTVNUE9UWVNKQUpCVVVNU01KT09XREhFMjVYIiwiaWF0IjoxNzQ0NDU5NzMxLCJqdGkiOiJnNzdkT3lBalBSYitUZG5OQzI3ZnV2QVFRZGYyWlZ5WlBBT2F2QXNOaTUxZEdQVjR2YmFZbEtpWE8wdjJsYWdVbmdHSCthSThOSUJSUEtpdExJOFhKdz09In0.vY23TQ4aJ0tFKWv24CH78WTEssbYQltkrrUM5ERjYlIdB3sRAMmqu8JAlg3dl8ycf9LFTYXfRL4gq_N6Ld_7BA",
        secret: "SUAFFYMSGNXPFCUKCIX6F44ZXDLEJAGND6ARABKXU6WBIJ7VCLKBLAXMI4"
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