// Creates a studio account, or resets its password if it exists.
//
//   npm run studio:user -- <username> --remote     (the live site)
//   npm run studio:user -- <username> --local      (wrangler dev)
//
// The password is asked for twice and never shown; piped input (one line) also works.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { hashPassword, passwordProblem, USERNAME_PATTERN } from '../src/shared/password';

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

/** Runs the project's own wrangler with node directly — no shell, so arguments arrive intact on Windows too. */
function wrangler(args: string[]) {
  const pkg = createRequire(import.meta.url).resolve('wrangler/package.json');
  const bin = join(dirname(pkg), 'bin', 'wrangler.js');
  return spawnSync(process.execPath, [bin, ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const username = args.find((a) => !a.startsWith('--'));
  const mode = args.includes('--remote') ? '--remote' : args.includes('--local') ? '--local' : null;
  if (!username || !mode) {
    console.error('Usage: npm run studio:user -- <username> --remote|--local');
    return 1;
  }
  if (!USERNAME_PATTERN.test(username)) {
    console.error('Usernames are 3–32 letters, numbers, dots, dashes or underscores.');
    return 1;
  }

  let password: string;
  if (process.stdin.isTTY) {
    console.log(`Choose a password for ${username} (at least 10 characters; typing is hidden).`);
    password = await ask('Password: ');
    const again = await ask('Same password again: ');
    process.stdin.pause();
    if (again !== password) {
      console.error('The passwords don’t match.');
      return 1;
    }
  } else {
    password = await readPiped();
  }
  const problem = passwordProblem(password);
  if (problem) {
    console.error(problem);
    return 1;
  }

  const hash = await hashPassword(password);
  // username matches USERNAME_PATTERN and the hash is base64 + "$": both safe inside SQL quotes.
  const sql =
    `INSERT INTO studio_users (username, password_hash) VALUES ('${username}', '${hash}')\n` +
    `  ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash;\n` +
    `DELETE FROM studio_sessions WHERE user_id = (SELECT id FROM studio_users WHERE username = '${username}');\n`;

  const dir = mkdtempSync(join(tmpdir(), 'noah-studio-'));
  const file = join(dir, 'account.sql');
  try {
    writeFileSync(file, sql, { mode: 0o600 });
    const run = wrangler(['d1', 'execute', 'noah-arts', mode, `--file=${file}`]);
    if (run.status !== 0) {
      console.error('Saving the account failed (see the wrangler output above). Did you run the migrations?');
      return run.status ?? 1;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`✓ ${username} can now sign in at /studio${mode === '--local' ? ' (local)' : ''}.`);
  return 0;
}

// Set the exit code instead of calling process.exit(): exiting while the terminal
// handle is still closing trips a libuv assertion on Windows.
process.exitCode = await main();
