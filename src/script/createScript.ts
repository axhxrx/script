import { Script } from './Script.ts';

/**
 Create a new isolated Script instance.

 Use this when you need multiple independent scripts (e.g., for testing or conditional script selection), rather than the global default instance.

 @returns A new Script instance

 @example
 ```ts
 import { createScript } from '@axhxrx/script';

 // In tests: create isolated instances
 const script = createScript();
 script.add('echo hello');
 await script.execute({ yes: true });
 // No need to call reset() — the instance is isolated

 // For conditional execution:
 const devScript = createScript();
 const prodScript = createScript();
 devScript.add('npm run dev');
 prodScript.add('npm run build && npm run deploy');
 if (isDev) await devScript.execute();
 else await prodScript.execute();
 ```
 */
export function createScript(): Script
{
  return new Script();
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/createScript.ts');

  // Exercise the function
  const script = createScript();
  script.add('echo "createScript test"');
  console.log('createScript() returned a Script with', script.getStepCount(), 'step(s)');

  console.log('<- executed ./src/script/createScript.ts');
}
