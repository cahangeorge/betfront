import type { APIRoute } from 'astro';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { handleMcpRequest } from '#/server/mcp-handler';
import { addTodo } from '#/server/mcp-todos';

const server = new McpServer({
  name: 'betfront',
  version: '1.0.0',
});

server.registerTool(
  'addTodo',
  {
    title: 'Add a todo',
    description: 'Add a todo to the persistent todo list.',
    inputSchema: {
      title: z.string().describe('The title of the todo'),
    },
  },
  ({ title }) => ({
    content: [{ type: 'text', text: String(addTodo(title)) }],
  }),
);

export const POST: APIRoute = ({ request }) => handleMcpRequest(request, server);

export const prerender = false;
