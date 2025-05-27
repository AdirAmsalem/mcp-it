import { test, describe, beforeEach, afterEach } from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { setupFastify } from "./setup.ts";

describe("Fastify MCP Plugin", () => {
  let fastify: FastifyInstance;
  let client: Client;

  beforeEach(async () => {
    fastify = Fastify();

    client = new Client({
      name: "Test Client",
      version: "1.0.0",
    });
  });

  afterEach(async () => {
    fastify.close();
    client.close();
  });

  test("should expose a streamable http endpoint", async (t) => {
    const { address } = await setupFastify(
      fastify,
      (fastify) => {
        fastify.get("/hello", () => "Hello World");
      },
      {
        transportType: "streamableHttp",
      }
    );

    const transport = new StreamableHTTPClientTransport(
      new URL(`${address}/mcp`)
    );
    await client.connect(transport);

    const pingResult = await client.ping();
    t.assert.deepEqual(pingResult, {});
  });

  test("should expose the default SSE endpoint", async (t) => {
    const { address } = await setupFastify(fastify);

    const transport = new SSEClientTransport(new URL(`${address}/mcp/sse`));
    await client.connect(transport);

    const pingResult = await client.ping();
    t.assert.deepEqual(pingResult, {});
  });

  test("should list tools with default info", async (t) => {
    const { address } = await setupFastify(fastify, (fastify) => {
      fastify.get("/hello", () => "Hello World");
    });

    const transport = new SSEClientTransport(new URL(`${address}/mcp/sse`));
    await client.connect(transport);

    const toolsResult = await client.listTools();

    t.assert.deepEqual(toolsResult, {
      tools: [
        {
          name: "GET__hello",
          description: "GET__hello",
          inputSchema: {
            properties: {},
            title: "GET__helloParameters",
            type: "object",
          },
        },
      ],
    });
  });

  test("should list tools with info from openapi", async (t) => {
    const { address } = await setupFastify(fastify, (fastify) => {
      fastify.get(
        "/helloa",
        {
          schema: {
            operationId: "hello",
            summary: "Hello World",
            description: "Says hello",
          },
        },
        () => "Hello World"
      );
    });

    const transport = new SSEClientTransport(new URL(`${address}/mcp/sse`));
    await client.connect(transport);

    const toolsResult = await client.listTools();

    t.assert.deepEqual(toolsResult, {
      tools: [
        {
          name: "hello",
          description: "Hello World\n\nSays hello",
          inputSchema: {
            properties: {},
            title: "helloParameters",
            type: "object",
          },
        },
      ],
    });
  });

  test("should call tools", async (t) => {
    const { address } = await setupFastify(fastify, (fastify) => {
      fastify.get(
        "/hello",
        {
          schema: {
            operationId: "hello",
            summary: "Hello World",
            description: "Says hello",
          },
        },
        () => "Hello World"
      );
    });

    const transport = new SSEClientTransport(new URL(`${address}/mcp/sse`));
    await client.connect(transport);

    const toolResult = await client.callTool({
      name: "hello",
      arguments: {},
    });

    t.assert.deepEqual(toolResult, {
      content: [
        {
          type: "text",
          text: "Hello World",
        },
      ],
    });
  });

  test("should use specific tool info", async (t) => {
    const { address } = await setupFastify(fastify, (fastify) => {
      fastify.get(
        "/hello",
        {
          config: {
            mcp: {
              name: "my_hello",
              description: "The is my hello tool",
            },
          },
          schema: {
            operationId: "hello",
            summary: "Hello World",
            description: "Says hello",
          },
        },
        () => "Hello World"
      );
    });

    const transport = new SSEClientTransport(new URL(`${address}/mcp/sse`));
    await client.connect(transport);

    const listToolsResult = await client.listTools();
    t.assert.deepEqual(listToolsResult, {
      tools: [
        {
          name: "my_hello",
          description: "Hello World\n\nThe is my hello tool",
          inputSchema: {
            properties: {},
            title: "my_helloParameters",
            type: "object",
          },
        },
      ],
    });

    const toolResult = await client.callTool({
      name: "my_hello",
      arguments: {},
    });

    t.assert.deepEqual(toolResult, {
      content: [
        {
          type: "text",
          text: "Hello World",
        },
      ],
    });
  });

  test("should use auth header", async (t) => {
    const { address } = await setupFastify(fastify, (fastify) => {
      fastify.get(
        "/hello",
        {
          config: {
            mcp: {
              name: "my_hello",
              description: "The is my hello tool",
            },
          },
          schema: {
            operationId: "hello",
            summary: "Hello World",
            description: "Says hello",
            headers: {
              type: "object",
              properties: {
                authorization: {
                  type: "string",
                  description: "Authorization header as a bearer token",
                },
              },
              required: ["authorization"],
            }
          },
        },
        () => "Hello World"
      );
    });

    const transport = new SSEClientTransport(new URL(`${address}/mcp/sse`));
    await client.connect(transport);

    const listToolsResult = await client.listTools();
    t.assert.deepEqual(listToolsResult, {
      tools: [
        {
          name: "my_hello",
          description: "Hello World\n\nThe is my hello tool",
          inputSchema: {
            properties: {
              authorization: {
                description: 'Authorization header as a bearer token',
                title: 'authorization',
                type: 'string'
              }
            },
            required: [
              'authorization'
            ],
            title: "my_helloParameters",
            type: "object",
          },
        },
      ],
    });

    const toolResult = await client.callTool({
      name: "my_hello",
      arguments: {
        authorization: "Bearer ia"
      },
    });

    t.assert.deepEqual(toolResult, {
      content: [
        {
          type: "text",
          text: "Hello World",
        },
      ],
    });
  });

  test("should use the published package", async (t) => {
    await fastify.register(import("@mcp-it/fastify"), {
      name: "Test API",
      description: "API for testing",
    });
    fastify.get("/hello", () => "Hello World");
    await fastify.ready();
    await fastify.listen({ port: 0 });

    const address = `http://localhost:${
      (fastify.server.address() as any).port
    }`;

    const transport = new SSEClientTransport(new URL(`${address}/mcp/sse`));
    await client.connect(transport);

    const pingResult = await client.ping();
    t.assert.deepEqual(pingResult, {});
  });
});
