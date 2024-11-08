import { Realtime } from "../realtime/realtime";
import axios from "axios";

jest.mock('axios');

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