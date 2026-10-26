---
name: atiendo-api
description: Call the Atiendo public REST API v1 correctly, including authentication, response envelopes, error codes, cursor pagination and idempotency. Use when writing code against api.atiendo.ai or debugging a 401, 403, 409 or 422 from it.
---

# Atiendo: the public API v1

Base URL: `https://api.atiendo.ai`.
The full OpenAPI document is at `/docs/json` and covers every served operation.
Fetch it rather than guessing a path.

## Authentication: two kinds of credential

**API key.** `Authorization: Bearer sk_...`. Belongs to the workspace, not to a
person. Created in the dashboard under Integrations → API keys, where the
permissions are chosen at creation time.

**OAuth token.** What an assistant connected over MCP uses. Belongs to a person
and carries a workspace, chosen on the consent screen.

They are not interchangeable. Two operations, `publish` and
`restore_agent_version`, **only work with an OAuth token** and answer `403
USER_AUTHORIZATION_REQUIRED` for an `sk_` key. This is deliberate: publishing
changes what real callers hear and has to be attributable to a person, not to a
shared key.

## Every response has the same shape

Success:

```json
{ "success": true, "data": { }, "pagination": { "next_cursor": null, "has_more": false } }
```

Error:

```json
{ "success": false, "request_id": "...", "error": { "code": "...", "message": "...", "details": { } } }
```

Branch on `error.code`, never on `error.message`: the message is wording and
will change. `request_id` is on every error; quote it when reporting a problem.

Some errors carry `details.recovery`: a sentence written for the end user
explaining what *they* have to do. When it is present, relay it instead of
paraphrasing.

## The errors you will actually hit

| Code | Means | What to do |
|---|---|---|
| `INSUFFICIENT_SCOPE` | The key or token lacks the permission | Not retryable. The user must re-authorize (or create a key) with that scope. `details.required_scope` names it |
| `USER_AUTHORIZATION_REQUIRED` | `sk_` key used on publish/restore | Use an OAuth connection |
| `VALIDATION_ERROR` | Body failed the schema | `details` names the field |
| `INVALID_REFERENCE` (422) | A referenced id does not exist, e.g. a voice | Look the id up; do not invent UUIDs |
| `RELEASE_REQUIRED` (409) | Deleting a purchased number | Dashboard-only |
| 404 on someone else's resource | Not yours | Deliberate: a 403 would confirm it exists |

## Pagination

Cursor-based. `?limit=N&cursor=<opaque>`; read `pagination.next_cursor` and stop
when `has_more` is false.

The cursor is **opaque**. It is base64url of a JSON object today, and decoding,
editing or constructing one is not supported: its contents are interpolated into
a PostgREST filter and the server validates it strictly. Pass back exactly what
you received.

## Idempotency

Send `Idempotency-Key: <uuid>` on writes. A replay with the same key returns the
first result instead of creating a second resource. Reservations from abandoned
requests expire after 5 minutes.

Use it for anything that creates: retrying a `create_agent` after a timeout
without a key is how a workspace ends up with two identical agents.

## What is not there, and why

Do not go looking for these; they were removed or never served on purpose.

- **Buying phone numbers.** Dashboard only. The route was withdrawn entirely.
- **Deleting agents.** Destructive, dashboard only.
- **Campaigns.** No executor behind them; the routes are not registered.
- **The agent `config` object.** It carries credentials in
  `config.functions[].headers`, so it is excluded from both reads and writes by
  an allow-list. Reads return a fixed column set, not `select(*)`.
- **Originating or hanging up calls.** No programmatic path exists.
- **`description` on `PATCH /v1/agents/{id}`.** The schema accepts `name`,
  `type`, `status`, `greeting_message`, `system_prompt`, `voice_id` and
  `language` only.

## One timing trap

Publishing through the API does not invalidate the Redis cache that the voice
service reads agents from. A published change can take up to the cache TTL
(5 minutes) to affect live calls. If someone publishes and immediately test-calls
and hears the old version, that is why. Wait and try again rather than
publishing a second time.
