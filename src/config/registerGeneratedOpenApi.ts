// Les packages OpenAPI générés publient des sources TypeScript dans node_modules.
// Ce bootstrap permet à ts-node de les charger au runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('ts-node').register({
    transpileOnly: true,
    ignore: [],
    compilerOptions: { module: 'commonjs' },
});
