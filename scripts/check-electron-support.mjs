// Comprueba que la versión de Electron instalada sigue recibiendo parches de
// seguridad. Electron solo mantiene sus 3 últimas versiones mayores estables.
//
// `npm audit --omit=dev` no revisa Electron (es una devDependency aunque su
// motor va dentro del instalador), así que esta comprobación cubre ese hueco.
// Termina con error si la versión está sin soporte, y avisa si le queda poco.

import { readFileSync } from 'node:fs';

const SUPPORTED_MAJORS = 3;
const RELEASES_URL = 'https://releases.electronjs.org/releases.json';

const installed = JSON.parse(
  readFileSync(new URL('../node_modules/electron/package.json', import.meta.url), 'utf-8'),
).version;
const installedMajor = Number(installed.split('.')[0]);

const res = await fetch(RELEASES_URL);
if (!res.ok) {
  console.error(`No se pudo consultar ${RELEASES_URL} (HTTP ${res.status}).`);
  process.exit(1);
}
const releases = await res.json();

// Versiones mayores con al menos una versión estable (sin -alpha, -beta…).
const stableMajors = [
  ...new Set(releases.filter((r) => !r.version.includes('-')).map((r) => Number(r.version.split('.')[0]))),
].sort((a, b) => b - a);
const supported = stableMajors.slice(0, SUPPORTED_MAJORS);
const newestStable = releases.find((r) => !r.version.includes('-') && Number(r.version.split('.')[0]) === installedMajor);

console.log(`Electron instalado: ${installed}`);
console.log(`Versiones mayores con soporte: ${supported.join(', ')}`);
if (newestStable) console.log(`Última ${installedMajor}.x publicada: ${newestStable.version} (Node ${newestStable.node})`);

if (!supported.includes(installedMajor)) {
  console.error(
    `::error::Electron ${installedMajor} ya no recibe parches de seguridad. ` +
      `Hay que actualizar a la ${supported[0]}.`,
  );
  process.exit(1);
}
if (installedMajor === supported[supported.length - 1]) {
  console.warn(
    `::warning::Electron ${installedMajor} es la versión con soporte más antigua: ` +
      `se quedará sin parches cuando salga la ${supported[0] + 1}. Conviene planificar la actualización.`,
  );
}
if (newestStable && newestStable.version !== installed) {
  console.warn(`::warning::Hay una versión más nueva de Electron ${installedMajor}: ${newestStable.version}.`);
}
console.log('Electron tiene soporte.');
