import { Script } from '@axhxrx/script';

const s = new Script();

let cuteness;
s.add(`
  curl -o example.png https://httpbin.org/image/png
`);
s.add(() =>
{
  cuteness = performImageAnalysis('example.png');
  console.log(cuteness);
});
await s.execute({ parseArgs: true });
console.log(s);
