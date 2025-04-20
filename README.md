# `@mcp-it/fastify`

> 🤖 Automatically generate MCP tools from your Fastify API routes.

A Fastify plugin (`@mcp-it/fastify`) for the Model Context Protocol (MCP) that allows you to expose your Fastify routes as MCP tools. This enables AI assistants to interact with your API directly through the MCP protocol.

## Overview

This plugin automatically discovers your Fastify routes and exposes them as tools consumable by MCP clients like Cursor or Claude. It leverages Fastify's schema system to generate complete tool definitions.

> [!NOTE]
> While this package focuses specifically on Fastify, the `@mcp-it` scope may host adapters for other Node.js frameworks (like Express, NestJS, etc.) in the future.

## Installation

```bash
npm install @mcp-it/fastify
# or
yarn add @mcp-it/fastify
# or
pnpm add @mcp-it/fastify
```

## Usage

```typescript
import Fastify from "fastify";
import mcpPlugin from "@mcp-it/fastify";

const fastify = Fastify();

// Register the MCP plugin
await fastify.register(mcpPlugin, {
  name: "My API",
  description: "My API with MCP support",
});

// Define your routes with schemas and operation IDs
fastify.get(
  "/users/:id",
  {
    schema: {
      operationId: "get_user", // Used as the tool name
      summary: "Get user by ID",
      description: "Returns a user by their ID",
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "number", description: "User ID" },
        },
      },
      response: {
        200: {
          description: "Successful response",
          type: "object",
          properties: {
            id: { type: "number" },
            name: { type: "string" },
            email: { type: "string" },
          },
        },
      },
    },
    // Add MCP-specific config if needed, e.g.:
    // config: {
    //   mcp: { hidden: true }
    // }
  },
  async (request) => {
    // Implementation...
    const userId = (request.params as any).id;
    // ... fetch user
    return { id: userId, name: "Example User", email: "user@example.com" };
  }
);

await fastify.listen({ port: 3000 });

console.log("MCP SSE server running at http://localhost:3000/mcp/sse");
```

## Features

- **Automatic Route Discovery**: Utilizes Fastify hooks to identify all registered routes.
- **Schema Utilization**: Employs Fastify route schemas for comprehensive tool generation.
- **Per-Route Configurations**: Allows customization on a per-route basis.
- **Multiple Transports**: Supports both Server-Sent Events and Streamable HTTP transports.
- **Debug Endpoint**: An optional endpoint to view generated tools, independent of transport.

## Configuration Options

| Option               | Type       | Default                  | Description                                                         |
| -------------------- | ---------- | ------------------------ | ------------------------------------------------------------------- |
| `name`               | `string`   | "Fastify MCP"            | Name for the MCP server displayed to the client.                    |
| `description`        | `string`   | "MCP server for Fastify" | Description for the MCP server.                                     |
| `transportType`      | `string`   | `"sse"`                  | Transport protocol to use: `"sse"` or `"streamableHttp"`.           |
| `describeFullSchema` | `boolean`  | `false`                  | Include detailed input/output schemas and examples in descriptions. |
| `skipHeadRoutes`     | `boolean`  | `true`                   | Exclude `HEAD` routes from the generated MCP tools.                 |
| `skipOptionsRoutes`  | `boolean`  | `true`                   | Exclude `OPTIONS` routes from the generated MCP tools.              |
| `mountPath`          | `string`   | `"/mcp"`                 | Base path prefix where MCP SSE and message endpoints are mounted.   |
| `filter`             | `Function` | `undefined`              | Custom function `(route: Route) => boolean` for filtering.          |
| `addDebugEndpoint`   | `boolean`  | `false`                  | Add a `GET /<mountPath>/tools` endpoint listing generated tools.    |

## Route Configuration (`config.mcp`)

You can add specific MCP configurations directly within a route's `config` object. The following options are available:

| Option        | Type      | Default                       | Description                         |
| ------------- | --------- | ----------------------------- | ----------------------------------- |
| `hidden`      | `boolean` | `false`                       | Hide this route from the MCP Server |
| `name`        | `string`  | `operationId` or `method_url` | Override the default tool name      |
| `description` | `string`  | Route's schema description    | Override the tool description       |

Example usage:

```typescript
fastify.get(
  "/some-route",
  {
    config: {
      mcp: {
        name: "custom_tool_name", // Override the default tool name
        description: "Custom description for this tool", // Override the default description
      },
    },
    // ... other route options
  },
  async (request, reply) => {
    /* ... */
  }
);
```

## Accessing the MCP Server Instance

This plugin decorates the Fastify instance with the underlying MCP `Server` instance from `@modelcontextprotocol/sdk`. You can access it via `fastify.mcpServer` after the plugin has been registered.

This might be useful for advanced scenarios, such as:

- Directly interacting with the MCP server's lifecycle or methods.
- Adding custom request handlers or capabilities beyond basic tool exposure.

```typescript
import Fastify from "fastify";
import mcpPlugin from "@mcp-it/fastify";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

const fastify = Fastify();

await fastify.register(mcpPlugin, {
  /* options */
});

// Now you can access the MCP server instance
console.log("MCP Server:", fastify.mcpServer);

// Example: Add a custom handler (use with caution)
// fastify.mcpServer.setRequestHandler(...);

// ... rest of your application setup

await fastify.listen({ port: 3000 });
```

## Examples

See the [examples](./examples) directory for complete working examples demonstrating various features.

## Client Configuration

### Cursor

In Cursor settings (Settings -> MCP), add a new SSE connection with the URL:

```
http://localhost:3000/mcp/sse
```

(Replace `localhost:3000` with your server's address and `mcp` with your `mountPath` if customized).

### Claude Desktop

Use [mcp-proxy](https://github.com/sparfenyuk/mcp-proxy) to bridge between Claude Desktop (which expects stdio) and the SSE endpoint.

Add the following to your Claude Desktop MCP config file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "my-fastify-api": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp/sse"]
    }
  }
}
```

(Replace `localhost:3000` with your server's address and `mcp` with your `mountPath` if customized).

_Alternatively, you can use the Streamable HTTP endpoint if your client supports it (Cursor might require configuration or proxying for non-SSE endpoints)._
