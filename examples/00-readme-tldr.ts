#!/usr/bin/env bun

import { add, execute, parseScriptArgs } from '@axhxrx/script';

// const options: any = parseScriptArgs();
// const { repoName, subpath } = options;
// const pathToNewRepo = subpath ? `${repoName}/${subpath}` : repoName;

// function initNewGitRepo(path: string, options: Record<string, any>) {
//   console.warn("initNewGitRepo", path, options);
// }

// add(`mkdir -p "${pathToNewRepo}"`).description(`Create path to new repo`);

// add(() => initNewGitRepo(pathToNewRepo, options))
//   .description(`Initialize default git repo`)
//   .confirmIf(options.public, "Will create PUBLIC repo, are you sure?");

// add("git push -u origin main")
//   .description("Push to GitHub")
//   .cwd(pathToNewRepo)
//   .or(
//     `
//     ~/bin/update_ssh_auth_keys.ts
//     git push -u origin main
//     `,
//   )
//   .cwd(pathToNewRepo)
//   .or(() => {
//     // only runs if the first fallback also failed
//     console.log(`
//       First attempt failed. Will try running
//       "gh auth switch" once before giving up.
//       `);
//   })
//   .and(`gh auth switch`)
//   .and(`git push -u origin main`)
//   .and(`this will fail!`) // sets andStep of git push -u origin main and returns builder for this will fail step
//   .or('echo "Hehe but the last .or() worked"'); // sets orStep for the this will fail step and returns builder for echo step

// // FUTURE: .if() and .then() are planned but not yet implemented
// // add(`rm -rf .foo`)
// //   .description(`Cleanup temp files`)
// //   .cwd(pathToNewRepo)
// //   .if(`ls .foo`) // whole step only runs if .foo exists
// //   .then(`~/bin/something_else.sh`); // runs only if previous step succeeded

// add("git push -u origin main").description("Push to GitHub").cwd(pathToNewRepo);

add('echo assholeblasthole')
  .and('ls -lsa /nonexistentdir')
  .or('echo "The previous step failed, but we are still here!"')
  .and(`ls fhjskd`)
  .or('echo "The last step also failed, but we are still here!"')
  .and(async () => 1);

// Execute all steps
const result = await execute();
console.log(
  `Done! Ran ${result.stepsRun} steps. ${JSON.stringify(structuredClone(result))}`,
);
