# Plugins de Atiendo para Claude Code

Marketplace propio de Atiendo. Un solo plugin, `atiendo`, que le da a tu
asistente lo que necesita para trabajar contra la plataforma: las skills sobre
la API pública v1, el servidor MCP y los webhooks de postllamada.

```bash
claude plugin marketplace add atiendo-ai/claude-plugins
claude plugin install atiendo@atiendo
```

## Qué entra con el plugin

Cuatro skills, que son instrucciones que el asistente lee cuando le hacen falta:

| Skill | Para qué |
|---|---|
| `atiendo-agents` | Crear, configurar y publicar un agente. El orden de los cuatro pasos, y por qué publicar se confirma siempre |
| `atiendo-calls` | Leer llamadas y transcripciones, y cómo tratar los datos personales que llevan dentro |
| `atiendo-webhooks` | Recibir el webhook de postllamada y verificar la firma HMAC sin dejar tres agujeros clásicos |
| `atiendo-api` | La API v1: autenticación, sobres de respuesta, códigos de error, paginación por cursor e idempotencia |

Y la configuración del servidor MCP (`.mcp.json`), que apunta a
`https://api.atiendo.ai/mcp`.

## Antes de que el MCP funcione: el registro dinámico

**El `.mcp.json` de este plugin no conectará mientras el registro dinámico de
clientes OAuth (DCR) siga desactivado en Supabase.**

No es un descuido nuestro: se desactivó a propósito el 28 de agosto de 2026, y
la postura para producción es admitir clientes OAuth a mano. Un cliente con
forma de CLI, como Claude Code o Gemini CLI, redirige a `localhost` con un
puerto aleatorio y no puede usar un `client_id` registrado de antemano, así que
necesita DCR.

Mientras tanto:

- **Las skills funcionan igual**, sin autenticación y sin MCP. Son la mayor
  parte del valor del plugin.
- **Para conectar el MCP** usa la aplicación de escritorio o la web del
  asistente (Claude, ChatGPT o Gemini), donde sí se puede pegar un
  `client_id`: está en el panel, en Integraciones → Aplicaciones conectadas,
  botón «Conectar asistente».

Cuando se decida abrir DCR, este fichero empieza a funcionar solo y no hay nada
que cambiar aquí.

## Sin plugin, sin npm, sin nada nuestro instalado

Las skills se publican en un índice abierto y cualquier agente puede
instalarlas directamente:

```bash
npx skills add https://atiendo.ai
```

Es el mismo formato que usa Stripe en `docs.stripe.com/.well-known/skills/`.

## Cómo se mantiene

**La fuente de verdad de las skills NO es este repo**: es
`atiendo-web/public/.well-known/skills/`, que es lo que se publica en
`https://atiendo.ai/.well-known/skills/index.json`. Este repo lleva una copia
para que el plugin sea autocontenido.

Editar una skill:

1. Se edita en `atiendo-web`, y se despliega.
2. Aquí: `node scripts/sync-skills.mjs`.
3. Se sube la `version` en `plugins/atiendo/.claude-plugin/plugin.json`.

Antes de publicar una versión, `node scripts/sync-skills.mjs --check` falla si
alguien editó la copia del plugin a mano en vez de editar la fuente.

`atiendo.ai` es público desde el 26 de octubre de 2026, así que el script ya no
necesita credenciales. Si algún día vuelve a cerrarse, las lee del entorno
(`ATIENDO_WEB_USER`, `ATIENDO_WEB_PASS`), nunca del repo.

## Licencia

MIT. Ver [LICENSE](LICENSE).
