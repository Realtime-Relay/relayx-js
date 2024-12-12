import { connect, StringCodec } from "nats";
const servers = [
  "nats://localhost:4222",
];

const nc = await connect({ servers: "nats://0.0.0.0:4222" });
console.log(`connected to ${nc.getServer()}`);
// this promise indicates the client closed

const sc = StringCodec();
setInterval(() => {
    nc.publish("hello", sc.encode("world")); 
}, 1);