const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
connection.on('error', (err) => {
      process.stdout.write('[Redis] Connection error: ' + err.message + '\n');
});
const messageQueue = new Queue('messages', { connection });
messageQueue.on('error', (err) => {
    process.stdout.write('[Queue] Error: ' + err.message + '\n');
});

function humanDelay() {
    const r = Math.random();
    if (r < 0.4) return (30 + Math.random() * 60) * 1000;
    if (r < 0.8) return (90 + Math.random() * 90) * 1000;
    return (180 + Math.random() * 60) * 1000;
}
/**
 * Adiciona mensagens à fila com delay aleatório entre 5–15s (anti-ban).
 * @param {Array<{messageId: string, userId: string}>} jobs
 */
async function enqueueCampaignMessages(jobs) {
  let cumulativeDelay = 0;

  const bulkJobs = jobs.map((job) => {
          cumulativeDelay += humanDelay();
    
    return {
      name: 'send-message',
      data: { messageId: job.messageId, userId: job.userId },
      opts: {
        delay: Math.floor(cumulativeDelay),
                attempts: 10,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    };
  });

  await messageQueue.addBulk(bulkJobs);
  return bulkJobs.length;
}

module.exports = { messageQueue, connection, enqueueCampaignMessages };
