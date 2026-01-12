import { Script } from '@axhxrx/script';

const s = new Script();

let cuteness;
s.add(`
  curl -o example.png https://httpbin.org/image/png
`);
s.description(() =>
{
  cuteness = performImageAnalysis('example.png');
  console.log(cuteness);
});
await s.execute({ parseArgs: true });
console.log(s);
