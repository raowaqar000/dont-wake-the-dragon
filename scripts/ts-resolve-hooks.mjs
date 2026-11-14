// Module resolve hooks for running the game's pure TypeScript (levels, parser, validator,
// config) directly in Node (built-in type stripping, Node 22.6+ / 23+):
//  - extensionless relative imports ('./types') resolve to the '.ts' file;
//  - 'phaser' resolves to an empty stub (config.ts only uses it inside createGameConfig).
const PHASER_STUB = 'data:text/javascript,export default {};';

export async function resolve(specifier, context, next) {
  if (specifier === 'phaser') return { url: PHASER_STUB, shortCircuit: true };
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      // Fall through to the default resolution.
    }
  }
  return next(specifier, context);
}
