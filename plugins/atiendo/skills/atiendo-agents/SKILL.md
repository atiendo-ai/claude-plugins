---
name: atiendo-agents
description: Create, configure and publish Atiendo voice agents that answer and place phone calls. Use when the user asks to build, edit, publish or duplicate an Atiendo agent, or to pick a voice or language for one.
---

# Atiendo: build and publish a voice agent

Atiendo runs AI voice agents that answer and place real phone calls for a
business. An agent is a configuration: a voice, a language, a greeting, a system
prompt and a phone number. Editing it changes a **draft**. Publishing is what
puts a version in front of real callers.

Work through the MCP server if the user has connected one (tool names below), or
through the REST API (`atiendo-api` skill). Both go through the same code path,
so the rules here apply either way.

## The order that actually works

Creating an agent and expecting it to answer is the most common mistake. The
sequence is four steps and none of them is optional:

1. `list_voices`: pick a `voice_id`. Voices are language-specific; there is no
   sensible default and inventing a UUID gives `422 INVALID_REFERENCE`.
2. `create_agent`: with that `voice_id` and a `language` from the supported
   enum (45 codes). This creates the agent and its first version.
3. `assign_phone_number`: attach a number that already belongs to the
   workspace. **An agent with no number never receives a call.** There is no way
   to buy a number through the API or MCP; that is dashboard-only, on purpose.
4. `publish_agent`: last. Until this runs, callers still get the previous
   version, or nothing at all for a brand new agent.

`assign_phone_number` is the exception to step 4: it takes effect on the next
call, with nothing to publish.

## Publishing is a real-world action

`publish_agent` changes what a business's customers hear on the phone.

**Always confirm with the user before publishing.** Describe what changed first.
Publishing is attributed to the person who authorized the connection, and it
creates a new version with a `change_summary`, so a surprise publish is both
visible and traceable back to them.

If the draft does not differ from the published version, `publish_agent` reports
`no_changes` rather than creating an empty version. That is the expected answer,
not an error.

To go back: `list_agent_versions` to see what was published and when, then
`restore_agent_version`. Restore writes the **draft**; it does not publish. You
still need `publish_agent` after it, and you still need to confirm.

## What you can and cannot change

Editable through `update_agent` / `PATCH /v1/agents/{id}`:
`name`, `type`, `status`, `greeting_message`, `system_prompt`, `voice_id`,
`language`.

Not available, and not an oversight:

- **Deleting agents.** Destructive, dashboard-only.
- **Buying phone numbers.** Dashboard-only, including with a `sk_` API key.
- **The rest of the agent `config`** (LLM model, tools, knowledge bases,
  timers). It is not exposed because `config.functions[].headers` carries
  credentials in clear text, so the whole object is kept off the API surface.
  Do not try to reach it another way.
- **Campaigns.** The routes are not served.

`description` is not accepted by `PATCH /v1/agents/{id}` either. If a user asks
to change it, say so instead of silently dropping it.

## Writing the system prompt

The prompt is read aloud by a model on a phone line, not in a chat window. What
works:

- Say what the business is and what the agent is allowed to promise.
- Say what to do when it cannot resolve something: transfer, take a message, or
  end the call. If you do not say it, the model invents.
- Say explicitly what it must not make up: prices, availability, medical or
  legal advice.
- Keep sentences short. Long clauses sound wrong at speech pace.

Never put a hardcoded date in the prompt. Use the `{{local_datetime}}` system
variable, otherwise the model guesses the current year and gets it wrong.

## Permissions

Reading agents needs `agents:read`; creating, editing, publishing, restoring and
duplicating need `agents:write`. Assigning a number needs `numbers:write`.

A `403 INSUFFICIENT_SCOPE` is not a bug and not something you can retry around:
the connection was authorized without that permission. The user has to open the
Atiendo dashboard, go to Integrations → Connected applications, revoke the
application and authorize it again choosing the missing permission.
