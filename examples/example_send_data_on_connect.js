import { Realtime, CONNECTED, RECONNECT, DISCONNECTED, MESSAGE_RESEND } from "../realtime/realtime.js"

async function run(){
    var realtime = new Realtime({
        api_key: "eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJhdWQiOiJOQVRTIiwibmFtZSI6bnVsbCwic3ViIjoiVUJQTFVOU0xBSUZONVRSWUhHVkVSSFpSM1EzWVZTT1VXSDVCS1dQQ1pOQ0U0V1Q1Q0JaUVdHRjUiLCJuYXRzIjp7ImRhdGEiOi0xLCJwYXlsb2FkIjotMSwic3VicyI6LTEsInB1YiI6eyJkZW55IjpbIj4iXX0sInN1YiI6eyJkZW55IjpbIj4iXX0sIm9yZ19kYXRhIjp7Im9yZ19pZCI6IjY5MWZmZWExNTZlMTExZGM3NmQ3YjdmMiIsIm9yZ19uYW1lIjoidmVsb2NpdHktc3BhY2UyIiwidmFsaWRpdHlfa2V5IjoiNDI3OTc1MDUtYjdiNS00OTlkLWJmYzUtYWY1YzdmNGY3NGUwIiwicm9sZSI6IndvcmtlciJ9LCJpc3N1ZXJfYWNjb3VudCI6IkFBWVhDQjVWR0dLQ0pUSkZGSUVGN1lTM1BWQTZNT0FUWEVUUUg3TDNIV09NUzVSU0hUUFhSQkhLIiwidHlwZSI6InVzZXIiLCJ2ZXJzaW9uIjoyfSwiaXNzIjoiQUFZWENCNVZHR0tDSlRKRkZJRUY3WVMzUFZBNk1PQVRYRVRRSDdMM0hXT01TNVJTSFRQWFJCSEsiLCJpYXQiOjE3NjM3MDQ0ODIsImp0aSI6IitXQnVyOW1xVUduTnNKVis2MTc1d1pvdlg4NXdaVmRGemZPQy9QM2FkeXJZbmFpSkR4WHoyVkptaFZqem44M3E5TTNVZWFUSTVnazV4UmZycUtZT1NBPT0ifQ.kU839dihZLZHR_4d2MVdG7pEDa2ATkrNL56YT2C-I3WHZoyYTYTLbfcC0PRE76_SVIbFQ8Njo9ArTVmtXEASCQ",
        secret: "SUAE7H5FUL44AE5G645YBAGG7U3TTQPEKNWIVOUPARAKVD3APGSKYQ7S44"
    });
    await realtime.init(true, {
        max_retries: 2,
        debug: true
    });

    realtime.on(CONNECTED, async () => {
        console.log("[IMPL] => CONNECTED!");

        for (let angle = 0; angle <= 18000; angle++){

            var value = Math.floor(Math.random() * (100 + 1))

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