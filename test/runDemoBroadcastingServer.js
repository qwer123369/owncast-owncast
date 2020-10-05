const WebSocket = require('ws');
const fs = require('fs');
const fetch = require('node-fetch');

var statusCheckTimer
var resetBroadcasterTimer

const ws = new WebSocket('ws://localhost:8080/entry', {
  origin: 'http://watch.owncast.online',
});

const host = 'rtmp://broadcast.owncast.online/live';
const broadcastingLimitSeconds = 4 * 1000 * 60;
var currentKey = 'abc123';

ws.on('open', function open() {
  // Reset the key immediately on launch
  resetBroadcaster();
  run();
});

async function run() {
  clearTimeout(statusCheckTimer);

  const status = await getStatus();
  if (!status.online) {
    setStatusCheckTimer();
    return;
  }

  // Shut them down after broadcastingLimitSeconds
  resetBroadcasterTimer = setTimeout(
    resetBroadcaster,
    broadcastingLimitSeconds
  );
}

function setStatusCheckTimer() {
  clearTimeout(statusCheckTimer);
  statusCheckTimer = setTimeout(run, 30 * 1000);
}

async function resetBroadcaster() {
  const newKey = generateNewRandomKey();
  const oldKey = currentKey;

  try {
    await kickBroadcaster(oldKey);
    await sendChatMessage(newKey);
    await updatePageContent(newKey);
  } catch (error) {
    console.log(error);
  }

  try {
    await changeKey(newKey, oldKey);
    currentKey = newKey;
  } catch (error) {
      console.log(error);
  }

  // Restart the timer to check status
  setStatusCheckTimer();
}

async function getStatus() {
  const path = '/api/status';
  const status = await makeRequest(path, 'GET', currentKey);
  return status
}

async function kickBroadcaster(oldKey) {
  const path = '/api/admin/disconnect';
  await makeRequest(path, 'POST', oldKey);
}

async function changeKey(newKey, oldKey) {
  console.log('Changing key to ', newKey, 'from', oldKey);
  const payload = {
    key: newKey,
  };

  const path = '/api/admin/changekey';
  try {
    await makeRequest(path, 'POST', oldKey, payload);
    key = newKey;
  } catch (error) {}
}

async function sendChatMessage(newKey) {
  const messageText = `You can broadcast to this server by pointing your software at **${host}** and using the stream key **${newKey}**.  You're limited to a few minutes, but it's enough for you to try out. For more details visit http://owncast.online/demo.`;

  const message = {
    author: 'Broadcast Right Now',
    body: messageText,
    image: '/img/logo128.png',
    id: currentKey,
    type: 'CHAT',
    visible: true,
    timestamp: new Date().toISOString(),
  };

  ws.send(JSON.stringify(message));
}

async function updatePageContent(newKey) {
  const filepath = './webroot/static/content.md';
  const content = `
  **See how Owncast works by streaming directly to this server right now.**

  [Point your software](https://owncast.online/docs/broadcasting/) at **${host}** using the stream key **${newKey}**.  If there's no option for a stream key point to ${host}/${currentKey} instead.

  This key may change over time, so continue to watch the chat for updates.
  You're limited to a few minutes, but it's enough for you to get a feel for how easy it is to move to an Owncast from your existing streaming provider.

  **Visit [our documentation](http://owncast.online/) to learn more about Owncast.**
  `;

  fs.writeFile(filepath, content, function (error) {
    if (error) {
      console.log(error);
    }
  });
}

async function makeRequest(path, method, key, payload) {
  const encodedKey = Buffer.from(`admin:${key}`).toString('base64')
  const url = `http://localhost:8080${path}`
  try {
    const headers = key ? {
      Authorization: `Basic ${encodedKey}`,
    } : {};

    const response = await fetch(url, {
      method: method,
      headers: headers,
      mode: 'cors',
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    return json;

  } catch (error) {
    console.log(error);
  }
}

function generateNewRandomKey() {
  let r = Math.random().toString(36).substring(7);
  return `octempdemo${r}`
}
