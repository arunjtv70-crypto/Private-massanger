// app.js
// ALL encryption/decryption happens HERE, on the device. The server never
// sees plaintext or the private key. This matches the blueprint's core rule:
// Message -> Encrypt (Device) -> Server/Relay -> Receiver -> Decrypt (Device)

const API_BASE = window.location.origin;
let sodiumReady = false;
let myKeyPair = null;   // { publicKey, privateKey } - privateKey NEVER sent anywhere
let myHandle = null;
let myToken = null;
let socket = null;
let peerPublicKey = null;

(async () => {
  await sodium.ready;
  sodiumReady = true;
})();

// --- Key management (stored only in browser localStorage on THIS device) ---
function loadOrCreateKeys(handle) {
  const saved = localStorage.getItem('keys_' + handle);
  if (saved) {
    const parsed = JSON.parse(saved);
    return {
      publicKey: sodium.from_base64(parsed.publicKey),
      privateKey: sodium.from_base64(parsed.privateKey),
    };
  }
  const kp = sodium.crypto_box_keypair();
  localStorage.setItem('keys_' + handle, JSON.stringify({
    publicKey: sodium.to_base64(kp.publicKey),
    privateKey: sodium.to_base64(kp.privateKey),
  }));
  return kp;
}

// --- Auth ---
async function signup() {
  await ensureSodium();
  const handle = document.getElementById('handle').value.trim();
  const password = document.getElementById('password').value;
  myKeyPair = loadOrCreateKeys(handle);

  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handle, password,
      publicKey: sodium.to_base64(myKeyPair.publicKey),
    }),
  });
  const data = await res.json();
  if (!res.ok) return showAuthError(data.error);
  finishLogin(handle, data.token);
}

async function login() {
  await ensureSodium();
  const handle = document.getElementById('handle').value.trim();
  const password = document.getElementById('password').value;

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, password }),
  });
  const data = await res.json();
  if (!res.ok) return showAuthError(data.error);
  myKeyPair = loadOrCreateKeys(handle);
  finishLogin(handle, data.token);
}

function showAuthError(msg) {
  document.getElementById('auth-error').innerText = msg || 'error';
}

function finishLogin(handle, token) {
  myHandle = handle;
  myToken = token;
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');
  connectSocket();
}

async function ensureSodium() {
  if (!sodiumReady) await sodium.ready;
  sodiumReady = true;
}

// --- Realtime connection ---
function connectSocket() {
  socket = io(API_BASE, { auth: { token: myToken } });

  socket.on('connect', () => {
    document.getElementById('status').innerText = 'online';
  });
  socket.on('disconnect', () => {
    document.getElementById('status').innerText = 'offline';
  });

  socket.on('message', async (msg) => {
    const plaintext = await decryptFrom(msg.from, msg.ciphertext, msg.nonce);
    renderMessage(plaintext, 'received', msg.timestamp);
  });

  socket.on('typing', ({ from, isTyping }) => {
    document.getElementById('status').innerText = isTyping ? `${from} is typing...` : 'online';
  });
}

// --- Fetch peer's public key before chatting with them ---
async function loadKeyForPeer() {
  const peer = document.getElementById('peer-handle').value.trim();
  if (!peer) return;
  const res = await fetch(`${API_BASE}/auth/publickey/${peer}`);
  const data = await res.json();
  if (res.ok) {
    peerPublicKey = sodium.from_base64(data.publicKey);
    document.getElementById('messages').innerHTML = '';
  } else {
    alert('User not found');
  }
}

// --- Encrypt / Decrypt (crypto_box = authenticated public-key encryption) ---
async function encryptTo(plaintext) {
  await ensureSodium();
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const ciphertext = sodium.crypto_box_easy(plaintext, nonce, peerPublicKey, myKeyPair.privateKey);
  return {
    ciphertext: sodium.to_base64(ciphertext),
    nonce: sodium.to_base64(nonce),
  };
}

async function decryptFrom(fromHandle, ciphertextB64, nonceB64) {
  await ensureSodium();
  // Fetch sender's public key to verify+decrypt
  const res = await fetch(`${API_BASE}/auth/publickey/${fromHandle}`);
  const data = await res.json();
  const senderPubKey = sodium.from_base64(data.publicKey);

  const ciphertext = sodium.from_base64(ciphertextB64);
  const nonce = sodium.from_base64(nonceB64);
  try {
    const plaintextBytes = sodium.crypto_box_open_easy(ciphertext, nonce, senderPubKey, myKeyPair.privateKey);
    return sodium.to_string(plaintextBytes);
  } catch (e) {
    return '[Unable to decrypt message]';
  }
}

// --- Send ---
async function sendMessage() {
  const box = document.getElementById('msg-box');
  const text = box.value.trim();
  const to = document.getElementById('peer-handle').value.trim();
  if (!text || !to || !peerPublicKey) return alert('Enter a peer handle first');

  const { ciphertext, nonce } = await encryptTo(text);
  socket.emit('send_message', { to, ciphertext, nonce });
  renderMessage(text, 'sent', new Date().toISOString());
  box.value = '';
}

function renderMessage(text, type, timestamp) {
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `${escapeHtml(text)}<div class="meta">${time}</div>`;
  document.getElementById('messages').appendChild(div);
  div.scrollIntoView();
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.innerText = str;
  return d.innerHTML;
}

document.getElementById('msg-box')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});
