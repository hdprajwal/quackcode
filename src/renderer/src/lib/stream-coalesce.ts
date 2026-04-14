import type { StreamChunk } from '@shared/types'

// Merges adjacent text_delta chunks that share (threadId, messageId) into a
// single chunk by concatenating their content. This drops a long burst of
// tokens into one store update instead of N. Other chunk types pass through
// untouched — tool_call_delta in particular needs the store's per-chunk
// standalone-JSON detection, which would break under naive concat.
export function coalesceStreamChunks(chunks: StreamChunk[]): StreamChunk[] {
  if (chunks.length < 2) return chunks
  const out: StreamChunk[] = []
  for (const chunk of chunks) {
    const prev = out[out.length - 1]
    if (
      prev &&
      prev.type === 'text_delta' &&
      chunk.type === 'text_delta' &&
      prev.threadId === chunk.threadId &&
      prev.messageId === chunk.messageId
    ) {
      out[out.length - 1] = {
        ...chunk,
        content: (prev.content ?? '') + (chunk.content ?? '')
      }
      continue
    }
    out.push(chunk)
  }
  return out
}
