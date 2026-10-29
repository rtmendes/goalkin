#!/usr/bin/env node
// Print a fresh VAPID key pair for web push. Store both in Infisical:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>   VAPID_PRIVATE_KEY=<private>
// Rotating keys invalidates every existing device subscription.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:support@goalkin.app`);
