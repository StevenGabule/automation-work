const logger = require('pino');
const dayjs = require('dayjs');

const log = logger({
  prettifier: true,
  base: { pid: false },
  timestamp: () => `,"time" : "${dayjs().format()}"`,
});

module.exports = log;
