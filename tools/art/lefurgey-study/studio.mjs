/** Offline author export. Never imported into the simulator. */
import { writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildLefurgeyAuthoringStudy } from './src/lefurgey-study.ts';

// Three uses the asynchronous FileReader event even for a pure binary mesh
// export. The fallback is temporary and never replaces an existing reader.
class ModelBlobReader {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then(result => {
      this.result = result;
      this.onloadend?.();
    });
  }
}
let localReaders = 0;
export async function studioGLB(model = buildLefurgeyAuthoringStudy()) {
  if (!Object.hasOwn(globalThis, 'FileReader')) Object.defineProperty(globalThis, 'FileReader', {
    configurable: true, value: ModelBlobReader,
  });
  const usingFallback = globalThis.FileReader === ModelBlobReader;
  if (usingFallback) localReaders++;
  try {
    return Buffer.from(await new GLTFExporter().parseAsync(model, {
      binary: true,
      copyright: 'Contains information licensed under the Open Government Licence - Canada.',
    }));
  } finally {
    if (usingFallback && --localReaders === 0) delete globalThis.FileReader;
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    out: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  }});
  if (values.help) {
    console.log('Export the detached study: node --experimental-strip-types tools/art/lefurgey-study/studio.mjs --out PATH.glb');
    return;
  }
  if (!values.out || extname(values.out).toLowerCase() !== '.glb') throw Error('Use --out PATH.glb (an existing file will not be overwritten).');
  const out = resolve(values.out);
  const bytes = await studioGLB();
  writeFileSync(out, bytes, { flag: 'wx' });
  console.log(`Detached model: ${out} (${bytes.length} bytes)`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
