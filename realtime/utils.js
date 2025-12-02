import { JetStreamApiError, JetStreamError } from "@nats-io/jetstream";
import NatsError from "nats"

export class ErrorLogging {

    logError(data){
        var err = data.err;

        if(err instanceof JetStreamApiError){
            var code = err.code;

            if(code == 10077){
                // Code 10077 is for message limit exceeded
                console.table({
                    Event: "Message Limit Exceeded",
                    Description: "Current message count for account exceeds plan defined limits. Upgrade plan to remove limits",
                    Link: "https://console.relay-x.io/billing"
                })

                throw new Error("Message limit exceeded!")
            }
        }

        if(err instanceof JetStreamError){
            var code = err.code;

            if(code == 409){
                // Consumer deleted

                console.table({
                    Event: "Consumer Manually Deleted!",
                    Description: "Consumer was manually deleted by user using deleteConsumer() or the library equivalent",
                    Link: "https://console.relay-x.io/billing"
                })
            }
        }

        if(err.name == "NatsError"){
            var code = err.code;
            var chainedError = err.chainedError;
            var permissionContext = err.permissionContext;

            if(code == "PERMISSIONS_VIOLATION"){
                var op = permissionContext.operation;

                if(op == "publish"){
                    console.table({
                        Event: "Publish Permissions Violation",
                        Description: `User is not permitted to publish on '${data.topic}'`,
                        Topic: data.topic,
                        "Docs to Solve Issue": "<>"
                    })

                    throw new Error(`User is not permitted to publish on '${data.topic}'`)
                }else if(op == "subscribe"){
                    console.table({
                        Event: "Subscribe Permissions Violation",
                        Description: `User is not permitted to subscribe to '${data.topic}'`,
                        Topic: data.topic,
                        "Docs to Solve Issue": "<>"
                    })

                    throw new Error(`User is not permitted to subscribe to '${data.topic}'`)
                }
            }else if(code == "AUTHORIZATION_VIOLATION"){
                console.table({
                    Event: "Authentication Failure",
                    Description: `User failed to authenticate. Check if API key exists & if it is enabled`,
                    "Docs to Solve Issue": "<>"
                })
            }
        }
    }

}