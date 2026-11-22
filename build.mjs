import * as esbuild from 'esbuild';

// Content scripts do MV3 não aceitam `import` estático; bundlar em IIFE nos
// deixa escrever módulos pequenos e testáveis sem expor arquivos via
// web_accessible_resources.
const options = {
  entryPoints: ['src/content/main.js'],
  outfile: 'dist/content.js',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}
