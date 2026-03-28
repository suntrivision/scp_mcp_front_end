import net from 'node:net';

const host = process.env.API_HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const timeoutMs = Number(process.env.API_WAIT_MS || 120_000);
const deadline = Date.now() + timeoutMs;

function tryConnect() {
  return new Promise((resolve) => {
    const s = net.connect(port, host, () => {
      s.end();
      resolve(true);
    });
    s.on('error', () => resolve(false));
  });
}

process.stderr.write(`Waiting for API at ${host}:${port}…\n`);
while (Date.now() < deadline) {
  if (await tryConnect()) {
    process.stderr.write('API is up.\n');
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 250));
}

process.stderr.write(`Timed out after ${timeoutMs}ms (nothing listening on ${host}:${port}).\n`);
process.exit(1);
