---
name: atiendo-calls
description: Read Atiendo call history, summaries and transcripts, and handle the personal data they contain. Use when the user asks about past calls, what a caller said, call outcomes, sentiment or minutes consumed.
---

# Atiendo: reading calls, transcripts and usage

## Read this before the first call you fetch

Atiendo call data is **other people's personal data**. A transcript is a
recording of a member of the public talking to a business, usually without
knowing that an AI assistant will later read it back.

Three rules, and they are not negotiable:

1. **Never move transcripts, summaries or phone numbers out of the
   conversation** unless the user explicitly asks for that specific export. Do
   not paste them into files, issues, commits, tickets or third-party services
   because it seemed convenient.
2. **Fetch the narrowest thing that answers the question.** `list_calls` gives
   agent, duration, outcome and sentiment with no content. If the user asks
   "how did yesterday go", that is the whole answer. Do not pull transcripts to
   summarize something the list already tells you.
3. **Say when you are about to read content.** "I'll open the transcript of the
   14:32 call" is enough. It gives the user the chance to stop you.

The permission that unlocks all of this is `calls:read`, and it is the single
reason a workspace might refuse to connect an assistant at all. Treat it as
borrowed.

## What each tool gives you

| Tool | Contains personal data? | Use it for |
|---|---|---|
| `list_calls` | Metadata only: agent, duration, outcome, sentiment | Volume, trends, "which calls went badly" |
| `get_call` | **Yes**: phone numbers and the conversation summary | One specific call the user named |
| `get_call_transcript` | **Yes**: everything that was said, turn by turn | Only when the exact wording matters |
| `get_usage` | No | Minutes consumed in a period |

Recordings are separate: `GET /v1/calls/{id}/recording` returns a signed URL that
expires in 5 minutes and is served `no-store`. Do not cache it, do not paste it
anywhere, do not treat it as a permanent link. If recordings are encrypted at
rest the endpoint answers `409` instead; that is expected, not a failure to work
around.

## Redaction

Transcripts carry a `pii_redacted` flag. **Check it.**

Redaction is opt-in per agent and off by default, so `pii_redacted: false` is
the normal case, not an anomaly. It means names, numbers and addresses are
present verbatim. When it is `true`, the personal data was replaced in place at
the end of the call, and the unredacted version no longer exists.

If a user is surprised that a transcript is unredacted, the fix is turning
redaction on for that agent in the dashboard; it applies to future calls, not
past ones.

## Usage and cost

`get_usage` reports minutes consumed for a period. Overage figures only appear
when the workspace is on usage-based pricing.

The API never exposes what a call cost Atiendo to run (`call_cost`,
`calculated_cost`, provider names). If a user asks what a call cost them, answer
with their price from usage; if they ask what it cost Atiendo, say the API does
not report that.

Billing counts **started minutes, per call**. A 10-second call is one minute.
That is deliberate, not a rounding bug, and it is worth stating plainly when
someone questions their bill.

## What is not available

There is no way to place or hang up a call through the API or MCP. Campaign
routes are not served. If a user asks for outbound calling, say it is dashboard
and contract territory today rather than hunting for an endpoint.
