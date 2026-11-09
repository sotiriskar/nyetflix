import type { Readable } from 'stream';

/**
 * Turns a Node stream (a file, a remote download, ffmpeg's output) into a web stream for a
 * Response body.
 *
 * Replaces `Readable.toWeb`, which crashes the server with "Invalid state: Controller is already
 * closed" when the browser drops a request mid-stream (seeking or skipping in the player does
 * that all the time) and the Node stream still has data on the way. Here a cancelled response
 * stops the source and late data is ignored. Reading pauses while the client is behind.
 */
export function nodeToWebStream(node: Readable, onCancel?: () => void): ReadableStream<Uint8Array> {
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    if (!node.destroyed) node.destroy();
    onCancel?.();
  };

  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        node.on('data', (chunk: Buffer | string) => {
          if (done) return;
          try {
            controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
          } catch {
            stop();
            return;
          }
          if ((controller.desiredSize ?? 1) <= 0) node.pause();
        });
        node.once('end', () => {
          if (done) return;
          done = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
        node.once('error', (err) => {
          if (done) return;
          done = true;
          try {
            controller.error(err);
          } catch {
            // already closed
          }
        });
        // Destroyed without ending (e.g. the request was aborted): end the response too.
        node.once('close', () => {
          if (done) return;
          done = true;
          try {
            controller.error(new Error('Stream closed before it ended'));
          } catch {
            // already closed
          }
        });
      },
      pull() {
        if (!done && node.isPaused()) node.resume();
      },
      cancel() {
        stop();
      },
    },
    { highWaterMark: 8 },
  );
}
