---
name: atiendo-webhooks
description: Receive and verify Atiendo post-call webhooks, including HMAC-SHA256 signature verification and replay protection. Use when wiring up a webhook endpoint for Atiendo, debugging deliveries, or writing signature verification code.
---

# Atiendo: post-call webhooks

When a call ends, Atiendo POSTs a JSON body to the URL configured on the agent.
That is the integration point for a CRM, a ticketing system or a database.

## Where the URL lives

The destination is `config.postcall_webhook_url` **on the agent**, set from the
dashboard.

There is a `webhooks` table in the database and a CRUD surface that looks like
it should be the answer. It is not: nothing reads it. If you are wiring a
webhook and you configured it there, no delivery will ever arrive. Set it on the
agent.

To see what was sent and what came back: `GET /v1/webhook-deliveries`.

## Verifying the signature

Every delivery carries two headers:

```
X-Webhook-Signature: sha256=<hex digest>
X-Webhook-Timestamp: <unix seconds>
```

The signed payload is the timestamp, a literal dot, and the **raw request body**:

```
{timestamp}.{body}
```

HMAC-SHA256 with the workspace's webhook secret key, hex-encoded, prefixed with
`sha256=`.

```js
import { createHmac, timingSafeEqual } from "node:crypto";

// `rawBody` must be the exact bytes received. Re-serializing a parsed object
// changes key order and whitespace and the signature will never match. In
// Express this means express.raw({ type: "application/json" }), not express.json().
export function verifyAtiendoWebhook(rawBody, headers, secret) {
  const signature = headers["x-webhook-signature"];
  const timestamp = headers["x-webhook-timestamp"];
  if (!signature || !timestamp) return false;

  // Replay protection. Without this, a signature stays valid forever and
  // anyone who captures one delivery can resend it indefinitely.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected =
    "sha256=" +
    createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so check length first.
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Three ways this goes wrong, in order of how often:

1. **Comparing against a parsed and re-serialized body.** Capture the raw bytes.
2. **No timestamp check.** The signature alone does not expire.
3. **`===` on the digest.** Use a constant-time comparison.

## Deliveries without a signature

If the workspace has no webhook secret configured, deliveries go out
**unsigned**. Your endpoint must reject unsigned requests rather than treating a
missing header as "signature check skipped", which turns the endpoint into an
open write path for anyone who learns the URL.

If you find yourself writing a fallback for the unsigned case, stop and tell the
user to generate the secret in the dashboard instead.

## Retries and idempotency

Deliveries are retried. Your endpoint will receive the same call more than once
and must be idempotent: key on the call id, not on arrival order. Return 2xx
quickly and do the slow work afterwards; a slow handler causes a timeout, which
causes a retry, which causes a duplicate.

## Testing locally

There is no tunnel command yet (`atiendo listen` is planned, not shipped). For
now, expose a local port with whatever tunnel you already use, point the agent's
`postcall_webhook_url` at it, and place a test call from the dashboard. Check
`GET /v1/webhook-deliveries` for the status code your endpoint returned.
