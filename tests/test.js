import { Realtime } from "../realtime/realtime";
import axios from "axios";

let realTimeEnabled;

jest.mock('axios');

beforeAll(async () => {
    const successData = {
        "status": "SUCCESS", 
        "data": {
            "msg": "Successfully fetched namespace",
            "namespace": "test-namespace"
        }
    };

    axios.get.mockResolvedValue({
        data: successData
    });

    // Start server for testing. Run local server!!
    realTimeEnabled = new Realtime(process.env.user_key);
    await realTimeEnabled.init(true, {
        debug: true
    });
    realTimeEnabled.setUser({
        "user": "test-user",
        "id": 123 
    })
    realTimeEnabled.connect();
});

afterAll(() => {
    realTimeEnabled.close();
});

test("No API key in constructor", async () => {
    var realtime = new Realtime(null);

    expect(realtime.api_key).toBeNull();
    await expect(realtime.init(true)).rejects.toThrow("Undefined or null api key in constructor");

});

test('init() function test', async () => {
    const successData = {
        "status": "SUCCESS", 
        "data": {
            "msg": "Successfully fetched namespace",
            "namespace": "test-namespace"
        }
    };

    axios.get.mockResolvedValue({
        data: successData
    });

    var realtime = new Realtime("<KEY>");
    await realtime.init(true);

    expect(realtime.staging).toBe(true);
    expect(realtime.opts).toStrictEqual({});

    await realtime.init({
        debug: true,
        max_retries: 2
    });

    expect(realtime.staging).toBe(false);
    expect(realtime.opts).toStrictEqual({
        debug: true,
        max_retries: 2
    })
    expect(realtime.opts.debug).toBeTruthy();
    expect(realtime.opts.max_retries).toBe(2);

    await realtime.init(true, {
        debug: false,
        max_retries: 2
    });

    expect(realtime.staging).toBe(true);
    expect(realtime.opts).toStrictEqual({
        debug: false,
        max_retries: 2
    })
    expect(realtime.opts.debug).toBeFalsy();
    expect(realtime.opts.max_retries).toBe(2);

    await realtime.init(false);

    expect(realtime.staging).toBe(false);
    expect(realtime.opts).toStrictEqual({})

    expect(realtime.opts.debug).toBeUndefined();
    expect(realtime.opts.max_retries).toBeUndefined();

    await realtime.init();

    expect(realtime.staging).toBe(false);
    expect(realtime.opts).toStrictEqual({})

    expect(realtime.opts.debug).toBeUndefined();
    expect(realtime.opts.max_retries).toBeUndefined();
});

test("/get-namespace test", async () => {
    const successData = {
        "status": "SUCCESS", 
        "data": {
            "msg": "Successfully fetched namespace",
            "namespace": "test-namespace"
        }
    };

    axios.get.mockResolvedValue({
        data: successData
    });

    var realtime = new Realtime("<KEY>");
    await realtime.init(); 

    expect(realtime.namespace).toBe("test-namespace");

    // Fail Condition
    const failData = {
        "status": "FAIL", 
        "data": {
            "msg": "Unable to get namespace, missing data"
        }
    };

    axios.get.mockResolvedValue({
        data: failData
    });

    await realtime.init(); 

    expect(realtime.namespace).toBe(null);
});

test("Retry method test", async () => {
    var retryMethod = realTimeEnabled.testRetryTillSuccess(); 

    expect(retryMethod).not.toBeNull();

    function testMethod1(arg){
        return {
            success: true, 
            output: arg
        }
    }

    var output = await retryMethod(testMethod1, 5, 1, "test_output")

    expect(output).toBe("test_output");

    function testMethod2(){
        return {
            success: false,
            output: null
        }
    }

    output = await retryMethod(testMethod2, 5, 1);
    expect(output).toBeNull();
});

test("get publish retry count test based in init()", async () => {
    realTimeEnabled.init({
        max_retries: 2
    });

    var publishRetryMethod = realTimeEnabled.testGetPublishRetry();
    expect(publishRetryMethod).not.toBeNull();

    var attempts = await publishRetryMethod();
    expect(attempts).toBe(2);

    realTimeEnabled.init({
        max_retries: 0
    })

    attempts = publishRetryMethod();
    expect(attempts).toBe(5);

    realTimeEnabled.init({
        max_retries: -4
    })

    attempts = publishRetryMethod();
    expect(attempts).toBe(5);

    realTimeEnabled.init({
        max_retries: 9
    })

    attempts = publishRetryMethod();
    expect(attempts).toBe(9);
});

test("Testing publish(topic, data) method", async () => {
    // Successful publish
    var response = await realTimeEnabled.publish("hello", {
        message: "Hello World!"
    });

    expect(response["message"]).not.toBeUndefined();
    expect(response["message"]).not.toBeNull();

    expect(response["message"]["id"]).not.toBeUndefined();
    expect(response["message"]["id"]).not.toBeNull();

    expect(response["message"]["message"]).toStrictEqual({
        "message": "Hello World!",
    });

    expect(response["message"]["topic"]).toBe("hello");

    expect(response["sent"]).toBeTruthy();
    expect(response["status"]).toBe("ACK_SUCCESS");

    expect(response["connected"]).toBeTruthy();
});

test("Testing publish(topic, data) with invalid inputs", async () => {
    var data = {
        message: "Hello World!"
    }; 
    var response = await realTimeEnabled.publish(null, data);

    expect(response).toStrictEqual({
        "status": "PUBLISH_INPUT_ERR",
        "sent": false,
        "connected": true,
        "message": `topic is null || data is ${data}`
    });

    response = await realTimeEnabled.publish(undefined, data);

    expect(response).toStrictEqual({
        "status": "PUBLISH_INPUT_ERR",
        "sent": false,
        "connected": true,
        "message": `topic is undefined || data is ${data}`
    });

    response = await realTimeEnabled.publish("test-topic", null);

    expect(response).toStrictEqual({
        "status": "PUBLISH_INPUT_ERR",
        "sent": false,
        "connected": true,
        "message": `topic is test-topic || data is null`
    });

    response = await realTimeEnabled.publish("test-topic", undefined);

    expect(response).toStrictEqual({
        "status": "PUBLISH_INPUT_ERR",
        "sent": false,
        "connected": true,
        "message": `topic is test-topic || data is undefined`
    });

    response = await realTimeEnabled.publish(null, undefined);

    expect(response).toStrictEqual({
        "status": "PUBLISH_INPUT_ERR",
        "sent": false,
        "connected": true,
        "message": `topic is null || data is undefined`
    });

    response = await realTimeEnabled.publish(null, null);

    expect(response).toStrictEqual({
        "status": "PUBLISH_INPUT_ERR",
        "sent": false,
        "connected": true,
        "message": `topic is null || data is null`
    });

    response = await realTimeEnabled.publish(undefined, undefined);

    expect(response).toStrictEqual({
        "status": "PUBLISH_INPUT_ERR",
        "sent": false,
        "connected": true,
        "message": `topic is undefined || data is undefined`
    });

    response = await realTimeEnabled.publish(undefined, null);

    expect(response).toStrictEqual({
        "status": "PUBLISH_INPUT_ERR",
        "sent": false,
        "connected": true,
        "message": `topic is undefined || data is null`
    });
});

test("Testing create or join room functionality", async () => {
    var method = realTimeEnabled.testCreateOrJoinRoom();
    expect(method).not.toBeNull();

    var reservedEvents = ["CONNECTED", "DISCONNECTED", "connect", "room-message", "room-join", "disconnect"];

    for(let i = 0; i < reservedEvents.length; i++){
        var response = await method(reservedEvents[i]);
        expect(response.success).toBeFalsy();
        expect(response.output).toBeFalsy();
    }

    var response = await method("test-topic");
    expect(response.success).toBeTruthy();
    expect(response.output).toBeTruthy();
});

test("Testing create or join room with retry", async () => {
    var createRoomMethod = realTimeEnabled.testCreateOrJoinRoom();
    expect(createRoomMethod).not.toBeNull();

    var retryMethod = realTimeEnabled.testRetryTillSuccess();
    expect(retryMethod).not.toBeNull();

    // Invalid topics
    var reservedEvents = ["CONNECTED", "DISCONNECTED", "connect", "room-message", "room-join", "disconnect"];

    for(let i = 0; i < reservedEvents.length; i++){
        var response = await retryMethod(createRoomMethod, 5, 1, reservedEvents[i]);
        expect(response).toBeFalsy();
    }

    // Valid topic
    var response = await retryMethod(createRoomMethod, 5, 1, "test-topic");
    expect(response).toBeTruthy();
});

test("Testing setting remote user", async () => {
    var retryMethod = realTimeEnabled.testRetryTillSuccess();
    expect(retryMethod).not.toBeNull();

    var setRemoteUser = realTimeEnabled.testSetRemoteUser();
    expect(setRemoteUser).not.toBeNull();

    var response = await setRemoteUser();
    expect(response.success).toBeTruthy();
    expect(response.output).toBeNull();

    // With retry
    response = await retryMethod(setRemoteUser, 5, 1);
    expect(response).toBeNull();
});

test("Test isTopicValidMethod()", () => {
    var reservedTopics = ["connect", "room-message", "room-join", "disconnect",
        "ping", "reconnect_attempt", "reconnect_failed", "room-message-ack",
        "exit-room", "relay-to-room", "enter-room", "set-user", "CONNECTED", "DISCONNECTED",
        "RECONNECT", "RECONNECTED", "RECONNECTING", "RECONN_FAIL", "MESSAGE_RESEND"
    ];

    reservedTopics.forEach(topic => {
        var valid = realTimeEnabled.isTopicValid(topic);
        expect(valid).toBeFalsy();
    });

    var unreservedInvalidTopics = [null, undefined, 1234, 
        () => {console.log("hello")},
        12.2, false, true, [], [1,2,3],
        {test: 1}, {}];
        
    unreservedInvalidTopics.forEach(topic => {
        var valid = realTimeEnabled.isTopicValid(topic);
        expect(valid).toBeFalsy();
    });

    var unreservedValidTopics = ["hello", "test-room", "heyyyyy", "room-connect"]; 

    unreservedValidTopics.forEach(topic => {
        var valid = realTimeEnabled.isTopicValid(topic);
        expect(valid).toBeTruthy();
    });
});

test("Test History API: Get By ID", async () => {
    // Test checks success response
    const successData = {
        "status": "SUCCESS", 
        "data": {
            id: '3341c5b0-d415-49a6-b5d5-3eccb6cbb858',
            timestamp: 1731601490044,
            topic: 'hello',
            message: { data: 'heyyywsdasda' }
        }
    };

    axios.get.mockResolvedValue({
        data: successData
    });

    var response = await realTimeEnabled.history.getMessageById(successData["data"]["id"]);

    expect(response["id"]).toBe(successData["data"]["id"]);
    expect(response["timestamp"]).toBe(successData["data"]["timestamp"]);
    expect(response["topic"]).toBe(successData["data"]["topic"]);
    expect(response["message"]).toBe(successData["data"]["message"]);

    // Now passing in a null & undefined message id
    response = await realTimeEnabled.history.getMessageById(null);
    expect(response).toBeNull();

    response = await realTimeEnabled.history.getMessageById(undefined);
    expect(response).toBeNull();

    // Getting invalid response from the server
    var invalidData = {
        "status": "FAIL", 
        "data": {}
    };

    axios.get.mockResolvedValue({
        data: invalidData
    });

    var response = await realTimeEnabled.history.getMessageById(successData["data"]["id"]);
    expect(response).toBeNull();

    // Do not send status message
    invalidData = {
        "data": {}
    };

    axios.get.mockResolvedValue({
        data: invalidData
    });

    var response = await realTimeEnabled.history.getMessageById(successData["data"]["id"]);
    expect(response).toBeNull();
});