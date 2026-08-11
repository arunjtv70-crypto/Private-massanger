# Private Messenger — Phase 1 (V1.0)

Secure 1-to-1 online chat, E2EE. Handle-based (no phone number).
Server sirf ciphertext store/forward karta hai — plaintext kabhi nahi dekhta.

---

## 🚀 STEP 1: GitHub Codespaces se open karo (phone browser se)

1. Ye poora folder apne GitHub repo (arunjtv70-crypto) mein upload karo.
   - GitHub app/website pe jao → naya repo banao → "Add file" → "Upload files" → sab files daal do.
2. Repo khulne ke baad, green **"Code"** button dabao → **"Codespaces"** tab → **"Create codespace on main"**.
3. Browser mein VS Code jaisa environment khul jayega — free 60 hrs/month.

## 🚀 STEP 2: Server chalao (Codespaces terminal mein)

```bash
cd server
npm install
npm start
```

Codespaces automatically ek popup dega "Port 3000 is available" → **Open in Browser** dabao.
Bas! Tera chat app live hai.

## 🚀 STEP 3: Test karo

1. Do alag browser tabs kholo (ya do phones).
2. Tab 1: signup karo `@arun` handle se.
3. Tab 2: signup karo `@rahul` handle se.
4. Tab 1 mein "Chat with" box mein `rahul` likho, Enter dabao.
5. Message bhejo — dusre tab mein turant aayega, encrypted.

---

## 🌍 STEP 4: Free permanent hosting (taaki app hamesha online rahe)

Codespaces temporary hai. Permanent free hosting ke liye:

1. **Render.com** pe free account banao (GitHub se login).
2. "New Web Service" → apna GitHub repo select karo.
3. Settings:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Deploy dabao — 2-3 min mein ek free URL milega (e.g. `private-messenger.onrender.com`).
5. Free tier: thoda slow start hota hai jab koi use na kare, lekin V1.0 testing ke liye perfect hai.

---

## 📱 STEP 5: Android pe "app" jaisa install karo

Deploy hone ke baad wo URL Chrome mein kholo → menu (⋮) → **"Add to Home Screen"**.
Ab icon phone pe app jaisa dikhega — ye ek PWA hai, real APK nahi, lekin V1.0 ke liye kaafi hai.

---

## 🔐 Security notes (jo blueprint mein bhi likha tha)

- Private key sirf tere device pe (`localStorage`) — server ko kabhi nahi milti.
- Har message `crypto_box` (libsodium) se encrypt hota hai — authenticated encryption.
- Server sirf ciphertext + nonce store karta hai, delivery ke baad bhi record rehta hai (undelivered messages ke liye queue).
- **Yaad rakh:** ye E2EE hai, lekin abhi tak koi security audit nahi hua — "unhackable" ka claim kabhi mat karna jab tak proper pen-testing na ho jaye (Phase 7).

---

## 📋 Agla kya (roadmap se)

- ✅ Phase 1: Secure Online 1-to-1 Chat & E2EE Core (ye code)
- ⬜ Phase 2: Offline P2P (Bluetooth/WiFi Direct) — iske liye native Android (Kotlin) chahiye hoga, PWA se nahi ho sakta
- ⬜ Phase 3: Store-and-forward queue (basic version already isme hai)
- ⬜ Phase 4+: Relay infra, voice, video — baad mein

## 💰 Kharcha (abhi)

₹0 — Codespaces free, Render free tier, koi paid service nahi.
Jab users badhenge (100+), Render ka paid tier (~$7/month) chahiye ho sakta hai taaki app hamesha fast rahe.
