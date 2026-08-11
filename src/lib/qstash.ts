import { Client as QStashClient } from '@upstash/qstash';

/**
 * Lazily create the QStash client on first use so the module can be imported
 * at build time without throwing when QSTASH_TOKEN is not set.
 */
function getQStash(): QStashClient {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error('Missing QSTASH_TOKEN env var.');
  }
  return new QStashClient({ token });
}

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

  const client = getQStash();
  const response = await client.publishJSON({
    url: workerUrl,
    body: payload,
    retries: 3,
  });

  return response.messageId;
}
