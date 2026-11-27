import * as esbuild from 'esbuild';

// MV3 content scripts don't accept static `import`; bundling into an IIFE lets us write small,
// testable modules without exposing files through web_accessible_resources.
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
