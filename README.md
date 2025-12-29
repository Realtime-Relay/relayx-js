# RelayX JavaScript SDK

![License](https://img.shields.io/badge/Apache_2.0-green?label=License)

Real-time messaging, queues, and key-value storage for JavaScript applications.

---

## What is RelayX?

RelayX is a real-time communication platform that enables pub/sub messaging, distributed queues, and key-value storage. This SDK provides a simple JavaScript interface to build real-time applications with minimal setup.

---

## Installation

Install via npm:

```bash
npm install relayx-js
```

---

## Quick Start

```javascript
import { Realtime } from 'relayx-js';

const client = new Realtime({
  api_key: 'your-api-key',
  secret: 'your-secret'
});

await client.init();
await client.connect();

await client.on('messages', (msg) => {
  console.log('Received:', msg.data);
});

await client.publish('messages', { text: 'Hello RelayX!' });
```

---

## Messaging (Pub/Sub)

**Publishing Messages:**

```javascript
await client.publish('chat.room1', {
  user: 'alice',
  message: 'Hello world'
});
```

**Subscribing to Messages:**

```javascript
await client.on('chat.room1', (msg) => {
  console.log(`${msg.data.user}: ${msg.data.message}`);
});
```

---

## Queues

**Publishing a Job:**

```javascript
const queue = await client.initQueue('tasks');

await queue.publish('email.send', {
  to: 'user@example.com',
  subject: 'Welcome'
});
```

**Consuming Jobs:**

```javascript
await queue.consume({ topic: 'email.send' }, async (job) => {
  console.log('Processing:', job.data);
  job.ack();
});
```

---

## Key-Value Store

**Storing Data:**

```javascript
const kv = await client.initKVStore();

await kv.put('user.123', {
  name: 'Alice',
  status: 'active'
});
```

**Retrieving Data:**

```javascript
const user = await kv.get('user.123');
console.log(user.name);
```

---

## Documentation

For complete documentation including guarantees, limits, API reference, and advanced usage:

**https://docs.relay-x.io**

---

## License

This SDK is licensed under the Apache 2.0 License.
