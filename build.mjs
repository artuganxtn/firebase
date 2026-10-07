import {build} from 'esbuild';
await build({entryPoints:['src/index.ts'],outdir:'lib',bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',sourcemap:true});
