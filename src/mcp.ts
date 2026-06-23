import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

// MCP wrapper over the kitt vocab HTTP API. Lets any Claude (e.g. on the Mac, over the
// LAN) read Igor's due Kindle words and weave them into a session — the external-brain
// use case. The HTTP API stays the single source of truth; this is just a consumer.
const KITT = process.env.KITT_URL ?? 'http://127.0.0.1:8787';
const PORT = Number(process.env.MCP_PORT ?? 8788);

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });

function buildServer(): McpServer {
  const s = new McpServer({ name: 'kitt-vocab', version: '0.1.0' });

  s.registerTool('vocab_due',
    { description: 'List vocabulary words currently due for review (Kindle lookups, FSRS-scheduled).', inputSchema: { limit: z.number().int().min(1).max(200).optional() } },
    async ({ limit }) => text(await (await fetch(`${KITT}/vocab/words/due?limit=${limit ?? 20}`)).text()));

  s.registerTool('vocab_word',
    { description: 'Full detail for one word: stem, the source sentences it was seen in, and its FSRS card.', inputSchema: { id: z.string().describe('word id, e.g. "en:inexorably"') } },
    async ({ id }) => text(await (await fetch(`${KITT}/vocab/words/${encodeURIComponent(id)}`)).text()));

  s.registerTool('vocab_review',
    { description: 'Record a review outcome for a word; FSRS reschedules it.', inputSchema: { wordId: z.string(), rating: z.enum(['again', 'hard', 'good', 'easy']) } },
    async ({ wordId, rating }) => text(await (await fetch(`${KITT}/vocab/reviews`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wordId, rating }) })).text()));

  s.registerTool('vocab_stats',
    { description: 'Vocabulary library stats: total words, due now, counts by FSRS state.', inputSchema: {} },
    async () => text(await (await fetch(`${KITT}/vocab/stats`)).text()));

  return s;
}

const transports = new Map<string, StreamableHTTPServerTransport>();

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve(undefined); } });
  });
}

const httpServer = http.createServer(async (req, res) => {
  if (req.url !== '/mcp') { res.writeHead(404).end(); return; }
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (req.method === 'POST') {
    const body = await readBody(req);
    const isInit = !!body && typeof body === 'object' && (body as any).method === 'initialize';
    let transport: StreamableHTTPServerTransport | undefined = sessionId ? transports.get(sessionId) : undefined;

    if (!transport && isInit) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => { transports.set(sid, transport!); },
      });
      transport.onclose = () => { if (transport!.sessionId) transports.delete(transport!.sessionId); };
      await buildServer().connect(transport);
    } else if (!transport) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'No valid session; send initialize first' }, id: null }));
      return;
    }
    await transport.handleRequest(req, res, body);
    return;
  }

  if (req.method === 'GET' || req.method === 'DELETE') {
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) { res.writeHead(400).end(); return; }
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(405).end();
});

httpServer.listen(PORT, '0.0.0.0', () => console.error(`kitt-vocab MCP listening on :${PORT}/mcp (api ${KITT})`));
