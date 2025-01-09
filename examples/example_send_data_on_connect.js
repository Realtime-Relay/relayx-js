import { Realtime, CONNECTED, RECONNECT, DISCONNECTED, MESSAGE_RESEND } from "../realtime/realtime.js"

async function run(){
    var realtime = new Realtime({
        api_key: "eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJhdWQiOiJOQVRTIiwibmFtZSI6InRlc3QgdXNlciIsInN1YiI6IlVEWUxXT01GVDNKSE9TQkdCQkRCUDZJWlQzSDNDRFVYNUJUUFJUWEVGWU1RUTZRVU1WMlQ0VUdGIiwibmF0cyI6eyJkYXRhIjotMSwicGF5bG9hZCI6LTEsInN1YnMiOi0xLCJwdWIiOnsiZGVueSI6WyI-Il19LCJzdWIiOnsiZGVueSI6WyI-Il19LCJvcmdfZGF0YSI6eyJvcmdhbml6YXRpb24iOiJzcGFjZXgiLCJwcm9qZWN0IjoidGVzdCB1c2VyIn0sImlzc3Vlcl9hY2NvdW50IjoiQUNaSUpaQ0lYU1NVVTU1WUVHTVAyMzZNSkkyQ1JJUkZGR0lENEpWUTZXUVlaVVdLTzJVN1k0QkIiLCJ0eXBlIjoidXNlciIsInZlcnNpb24iOjJ9LCJpc3MiOiJBQ1pJSlpDSVhTU1VVNTVZRUdNUDIzNk1KSTJDUklSRkZHSUQ0SlZRNldRWVpVV0tPMlU3WTRCQiIsImlhdCI6MTczNTgyOTQzOSwianRpIjoicG5TVitjaU5RYlFnaTBiWmVyOG5OZ0lBT25CR2tWdHFqZnFwQ3FmK0xVa0RIR3dXTmpyTnpjdENqejhSbU1HSWQybkxrZnFUbEl6RXI4N3NQZUludWc9PSJ9.RbrFrw0N28mRJF8t8wg-wHrdmLUT6_B1YYlBSi5n2rrA7GUhqQZpH52v0VZ_wTYan81c9qU9LlCRK9ZL5f6hAw",
        secret: "SUAPIZLO2JP35DEALLKOIJ4U4IEA4XCJKZCHN2SXJR35H737H2RAZFXHYA"
    });
    await realtime.init(true, {
        max_retries: 2,
        debug: true
    });

    realtime.on(CONNECTED, async () => {
        console.log("[IMPL] => CONNECTED!");

        for (let angle = 0; angle <= 18000; angle++){

            var value = Math.floor(Math.random() * (100 + 1))
            console.log(value)

            await realtime.publish("test-topic", {
                "value": value,
                "time": Date.now() + 2000
            })

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