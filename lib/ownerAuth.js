// Tells apart "the keeper" (you, running this shop) from an anonymous
// visitor -- a shared passcode, hashed into a cookie value so the raw
// passcode itself never sits in the visitor's browser. Same pattern as
// coven-site and kaqchikel-site's ownerAuth.js.
//
// Set ABRACADABRA_KEEPER_PASSCODE in your environment variables to enable
// this. Until it's set, "sign in" simply won't authenticate anyone -- the
// public parts of the site still work fine, the keeper-only parts (the
// message inbox, posting a story) just stay unreachable.

import crypto from "crypto";

export const OWNER_COOKIE_NAME = "abracadabra_keeper";

export function ownerToken() {
  const passcode = process.env.ABRACADABRA_KEEPER_PASSCODE;
  if (!passcode) return null;
  return crypto.createHash("sha256").update("keeper|" + passcode).digest("hex");
}

export function isOwnerRequest(req) {
  const token = ownerToken();
  if (!token) return false;
  const cookie = req.cookies.get(OWNER_COOKIE_NAME)?.value;
  return cookie === token;
}

export function hashIp(ip) {
  const salt = process.env.IP_HASH_SALT || "abracadabra-site";
  return crypto.createHash("sha256").update(salt + "|" + (ip || "unknown")).digest("hex");
}
