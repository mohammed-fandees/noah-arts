// Creates a studio account, or resets its password if it exists.
//
//   npm run studio:user -- <username> --remote     (the live site)
//   npm run studio:user -- <username> --local      (wrangler dev)
//
// The password is asked for twice and never shown; piped input (one line) also works.

import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { hashPassword, passwordProblem, USERNAME_PATTERN } from '../src/shared/password';

const args = process.argv.slice(2);
const username = args.find((a) => !a.startsWith('--'));
const mode = args.includes('--remote') ? '--remote' : args.includes('--local') ? '--local' : null;

if (!username || !mode) {
  console.error('Usage: npm run studio:user -- <username> --remote|--local');
  process.exit(1);
}
if (!USERNAME_PATTERN.test(username)) {
  console.error('Usernames are 3–32 letters, numbers, dots, dashes or underscores.');
  process.exit(1);
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Hide what is typed.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.includes(question)) process.stdout.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function readPiped(): Promise<string> {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.split(/\r?\n/)[0];
}

let password: string;
if (process.stdin.isTTY) {
  password = await ask(`Password for ${username}: `);
  if ((await ask('Same password again: ')) !== password) {
    console.error('The passwords don’t match.');
    process.exit(1);
  }
} else {
  password = await readPiped();
}
const problem = passwordProblem(password);
if (problem) {
  console.error(problem);
  process.exit(1);
}

const hash = await hashPassword(password);
// username matches USERNAME_PATTERN and the hash is base64 + "$": both safe inside SQL quotes.
const sql =
  `INSERT INTO studio_users (username, password_hash) VALUES ('${username}', '${hash}') ` +
  `ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash; ` +
  `DELETE FROM studio_sessions WHERE user_id = (SELECT id FROM studio_users WHERE username = '${username}');`;

const run = spawnSync('npx', ['wrangler', 'd1', 'execute', 'noah-arts', mode, '--command', sql], {
  stdio: ['ignore', 'pipe', 'inherit'],
  shell: process.platform === 'win32'
});
if (run.status !== 0) {
  console.error('Saving the account failed (see the wrangler output above). Did you run the migrations?');
  process.exit(run.status ?? 1);
}
console.log(`✓ ${username} can now sign in at /studio${mode === '--local' ? ' (local)' : ''}.`);
