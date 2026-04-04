import http from 'node:http';
import { getTallyConnection, formatNodeError } from './tally-connection.mjs';

/**
 * POST XML to TallyPrime HTTP server (same wire format as tally-prime tally.mjs).
 * Uses request-scoped host/port from tallyConnectionMiddleware when set.
 * @param {string} xmlUtf8
 * @returns {Promise<string>} UTF-16 LE response body
 */
export function postTallyUtf16(xmlUtf8) {
  return new Promise((resolve, reject) => {
    const { host, port } = getTallyConnection();
    const byteLen = Buffer.byteLength(xmlUtf8, 'utf16le');
    const req = http.request(
      {
        hostname: host,
        port: port,
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
        reject(
          new Error(
            `Cannot connect to Tally at ${host}:${port}. Enable the XML/HTTP server in TallyPrime and ensure the port matches.`
          )
        );
      } else {
        reject(new Error(`${formatNodeError(e)} (target ${host}:${port})`));
      }
    });
    req.write(xmlUtf8, 'utf16le');
    req.end();
  });
}
