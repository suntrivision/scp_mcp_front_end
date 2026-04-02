import http from 'node:http';

const TALLY_HOST = process.env.TALLY_HOST || '127.0.0.1';
const TALLY_PORT = Number(process.env.TALLY_PORT || '9000');

/**
 * POST XML to TallyPrime HTTP server (same wire format as tally-prime tally.mjs).
 * @param {string} xmlUtf8
 * @returns {Promise<string>} UTF-16 LE response body
 */
export function postTallyUtf16(xmlUtf8) {
  return new Promise((resolve, reject) => {
    const byteLen = Buffer.byteLength(xmlUtf8, 'utf16le');
    const req = http.request(
      {
        hostname: TALLY_HOST,
        port: TALLY_PORT,
        path: '',
        method: 'POST',
        headers: {
          'Content-Length': byteLen,
          'Content-Type': 'text/xml;charset=utf-16',
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf16le');
        res
          .on('data', (chunk) => {
            data += chunk;
          })
          .on('end', () => resolve(data))
          .on('error', reject);
      }
    );
    req.on('error', (e) => {
      if (e && e.code === 'ECONNREFUSED') {
        reject(new Error(`Cannot connect to Tally at ${TALLY_HOST}:${TALLY_PORT}. Enable XML server (port 9000).`));
      } else {
        reject(e);
      }
    });
    req.write(xmlUtf8, 'utf16le');
    req.end();
  });
}
