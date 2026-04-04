import forwardTallyBackend from '../lib/forwardTallyBackend.mjs';

export default function handler(req, res) {
  return forwardTallyBackend(req, res, '/api/tally/import-sample-coa');
}
