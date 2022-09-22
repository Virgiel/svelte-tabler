import tagName from './generate.js';

async function call(cmd) {
  const p = Deno.run({
    cmd,
    stdout: 'piped',
    stderr: 'piped',
  });
  const [status, stdout, stderr] = await Promise.all([
    p.status(),
    p.output(),
    p.stderrOutput(),
  ]);
  p.close();
  if (status.success) {
    return new TextDecoder().decode(stdout);
  } else {
    throw new TextDecoder().decode(stderr);
  }
}

const dirtyFiles = await call(['git', 'status', '--porcelain']);
if (dirtyFiles.length != 0) {
  await call(['git', 'add', '--all']);
  await call(['git', 'config', 'user.name', '"Gentle bot"']);
  await call(['git', 'config', 'user.email', '""']);
  await call(['git', 'commit', '-m', `sync with tabler ${tagName}`]);
  await call(['git', 'push']);
  console.log('Apply changes');
} else {
  console.log('No change');
}
