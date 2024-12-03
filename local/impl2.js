import { Realtime, CONNECTED } from "../realtime/realtime.js"
import * as throttle from '@sitespeed.io/throttle'

const options = {
    "3g": {up:768, down:1600, rtt:150},
    "3gfast": {up:768, down:1600, rtt:75},
    "3gslow": {up:400, down:400, rtt:200},
    "2g": {up:256, down:280, rtt:400},
    "cable": {up:1000, down:5000, rtt:14},
    "dsl": {up:384, down:1500, rtt:14},
    "3gem": {up:400, down:400, rtt:200},
    "4g": {up:9000, down:9000, rtt:85},
    "lte": {up:12000, down:12000, rtt:35},
    "edge": {up:200, down:240, rtt:35},
    "dial": {up:30, down:49, rtt:60},
    "fois": {up:5000, down:20000, rtt:2}
};

async function run(){
    // await throttle.start(options["2g"]);

    console.log(typeof {max_retries: 2})

    var realtime = new Realtime("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiQXJqdW4iLCJwcm9qZWN0X2lkIjoidGVzdF9wcm9qZWN0Iiwib3JnYW5pemF0aW9uIjoiYmV5b25kX3JvYml0aWNzIiwiaXNfdmFsaWQiOnRydWUsImlhdCI6MTczMDczNTUzOX0.AMkp492uQC0BgPjcA3cy8FId9gGw8nHyZHDK5o3MyMk")
    await realtime.init();

    // realtime.on(CONNECTED, async () => {
    //     console.log("[IMPL] => CONNECTED!");

    //     realtime.on("hello", (data) => {
    //         console.log("HELLO => ", data);
    //     });

    //     console.log("DONE");
    // });

    // realtime.connect();

    process.on('SIGINT', async () => {
        console.log('Keyboard interrupt detected (Ctrl+C). Cleaning up...');
        // Perform any necessary cleanup here

        // await throttle.stop();
    
        // Exit the process
        process.exit();
    });
    
}

run();