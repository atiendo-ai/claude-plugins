#!/usr/bin/env node
// Trae las skills publicadas y las escribe dentro del plugin.
//
// La fuente de verdad es el índice publicado en atiendo.ai, no este repo. Ahí
// es donde las lee `npx skills add https://atiendo.ai`, que funciona en
// cualquier agente sin instalar nada nuestro, y el plugin es solo el envoltorio
// cómodo para Claude Code. Si el repo fuera la fuente, la copia publicada y la
// del plugin divergirían a la primera prisa y cada agente recibiría
// instrucciones distintas sobre la misma API.
//
//   node scripts/sync-skills.mjs            # escribe
//   node scripts/sync-skills.mjs --check    # solo comprueba, sale 1 si difiere
//
// El modo --check es lo que debe correr antes de publicar una versión del
// plugin: si falla, alguien editó las skills del plugin a mano en vez de
// editarlas en atiendo-web.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const INDEX_URL =
  process.env.ATIENDO_SKILLS_INDEX ??
  'https://atiendo.ai/.well-known/skills/index.json';

const check = process.argv.includes('--check');
const skillsDir = fileURLToPath(
  new URL('../plugins/atiendo/skills', import.meta.url),
);

// Mientras atiendo.ai siga detrás del basic auth, la descarga necesita
// credenciales. Se pasan por entorno para que no acaben en el historial del
// shell ni en este fichero.
function authHeaders() {
  const user = process.env.ATIENDO_WEB_USER;
  const pass = process.env.ATIENDO_WEB_PASS;
  if (!user || !pass) return {};
  const token = Buffer.from(`${user}:${pass}`).toString('base64');
  return { authorization: `Basic ${token}` };
}

async function get(url) {
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText} al pedir ${url}` +
        (response.status === 401
          ? '. El sitio sigue con basic auth: exporta ATIENDO_WEB_USER y ATIENDO_WEB_PASS.'
          : ''),
    );
  }
  return response.text();
}

const baseUrl = INDEX_URL.replace(/index\.json$/, '');
const index = JSON.parse(await get(INDEX_URL));

if (!Array.isArray(index.skills) || index.skills.length === 0) {
  throw new Error('El índice no trae ninguna skill');
}

let differs = false;

for (const skill of index.skills) {
  for (const file of skill.files) {
    const remote = await get(`${baseUrl}${skill.name}/${file}`);
    const target = join(skillsDir, skill.name, file);

    let local = null;
    try {
      local = readFileSync(target, 'utf8');
    } catch {
      // No existe todavía: cuenta como diferencia.
    }

    if (local === remote) continue;

    differs = true;
    if (check) {
      console.error(`difiere: ${skill.name}/${file}`);
      continue;
    }

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, remote);
    console.log(`escrito: ${skill.name}/${file}`);
  }
}

// Una skill retirada del índice tiene que desaparecer del plugin, o el agente
// seguiría leyendo instrucciones sobre algo que ya no existe.
const published = new Set(index.skills.map((s) => s.name));
const { readdirSync } = await import('node:fs');
for (const name of readdirSync(skillsDir, { withFileTypes: true })) {
  if (!name.isDirectory() || published.has(name.name)) continue;
  differs = true;
  if (check) {
    console.error(`sobra: ${name.name} (no está en el índice)`);
    continue;
  }
  rmSync(join(skillsDir, name.name), { recursive: true, force: true });
  console.log(`borrado: ${name.name}`);
}

if (check && differs) {
  console.error(
    '\nLas skills del plugin no coinciden con el índice publicado.\n' +
      'Edítalas en atiendo-web (public/.well-known/skills/), publica, y luego\n' +
      'ejecuta `node scripts/sync-skills.mjs` aquí.',
  );
  process.exit(1);
}

console.log(check ? 'skills al día' : 'sincronizado');
