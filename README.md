# Relay NodeJS Library
![License](https://img.shields.io/badge/MIT-green?label=License)<br>
A powerful library for integrating real-time communication into your software stack, powered by the Relay Network.

## Features
1. Real-time communication made easy—connect, publish, and subscribe with minimal effort.
2. Automatic reconnection built-in, with a 2-minute retry window for network disruptions.
3. Message persistence during reconnection ensures no data loss when the client reconnects.

## Installation
Install the relay library by running the command below in your terminal<br>
`npm install relay`

## Usage
### Prerequisites
1. Obtain API key and Secret key
2. Initialize the library
    ```javascript
    import { Realtime, CONNECTED, RECONNECT, DISCONNECTED } from "relay"

    var realtime = new Realtime({
        api_key: process.env.api_key,
        secret: process.env.secret,
    });
    realtime.init();
    ```

### Usage
1. <b>Publish</b><br>
Send a message to a topic:<br>
    ```javascript
    var sent = await realtime.publish("power_telemetry", {
        "voltage_V": 5,
        "current_mA": 400,
        "power_W": 2 
    });

    if(sent){
        console.log("Message was successfully sent to topic => power_telemetry")
    }else{
        console.log("Message was not sent to topic => power_telemetry")
    }
    ```
2. <b>Listen</b><br>
Subscribe to a topic to receive messages:<br>
    ```javascript
    await realtime.on("power_telemetry", (data) => {
        console.log(data);
    });
    ```
3. <b>Turn off listener</b><br>
Unsubscribe from a topic:<br>
    ```javascript
    var unsubscribed = await realtime.off("power_telemetry");

    if(unsubscribed){
        console.log("Successfully unsubscribed from power_telemetry")
    }else{
        console.log("Unable to unsubscribe from power_telemetry")
    }
    ```
4. <b>Valid topic check</b><br>
Utility function to check if a particular topic is valid
    ```javascript
    var isValid = realtime.isTopicValid("topic")

    console.log(`Topic Valid => ${isValid}`)
    ```
5. <b>Sleep example</b><br>
Utility async function to delay code execution
    ```javascript
    console.log("Starting code execution...")
    await realtime.sleep(2000) // arg is in ms
    console.log("This line executed after 2 seconds")
    ```

## API Reference
1. Init method definiton
2. connect() method definition
3. close() method definition
3. on() method definition
3. off() method definition
4. isTopicValid() definition
5. sleep() method definition

## System Events
1. CONNECTED
2. RECONNECT
3. DISCONNECTED
4. MESSAGE_RESEND