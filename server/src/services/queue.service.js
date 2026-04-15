const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
connection.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
});
const messageQueue = new Queue('messages', { connection });

/**
 * Adiciona mensagens à fila com delay aleatório entre 5–15s (anti-ban).
 * @param {Array<{messageId: string, userId: string}>} jobs
 */
async function enqueueCampaignMessages(jobs) {
  let cumulativeDelay = 0;

  const bulkJobs = jobs.map((job) => {
    const randomDelay = (20 + Math.random() * 25) * 1000; // 20–45s em ms
    cumulativeDelay += randomDelay;

    return {
      name: 'send-message',
      data: { messageId: job.messageId, userId: job.userId },
      opts: {
        delay: Math.floor(cumulativeDelay),
        attempts: 3,
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
