import forwardTallyBackend from './lib/forwardTallyBackend.mjs';

export default function handler(req, res) {
  return forwardTallyBackend(req, res, '/api/chart-of-accounts');
}
