import { Client as QStashClient } from '@upstash/qstash';

if (!process.env.QSTASH_TOKEN) {
  throw new Error('Missing QSTASH_TOKEN env var.');
}

export const qstash = new QStashClient({
  token: process.env.QSTASH_TOKEN,
});

/**
 * Publish a job to the worker endpoint via QStash.
 * The worker URL must be a publicly reachable endpoint (Vercel deployment).
 *
 * @param payload - The job payload to serialize and send.
 * @returns The messageId from QStash, useful for deduplication.
 */
export async function publishJob<T extends object>(payload: T): Promise<string> {
  const workerUrl = process.env.WORKER_URL;
  if (!workerUrl) {
    throw new Error('Missing WORKER_URL env var — cannot publish job to QStash.');
  }

  const response = await qstash.publishJSON({
    url: workerUrl,
    body: payload,
    retries: 3,
  });

  return response.messageId;
}
