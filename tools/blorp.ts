import { Script } from '@axhxrx/script';

function performImageAnalysis(_path: string)
{
  return '0.32';
}

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
// console.log(s);
