import type {
  FastifyInstance,
  FastifyPluginAsync,
  RouteOptions,
} from "fastify";
import fp from "fastify-plugin";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpPluginOptions, Route, HTTPMethods } from "./types.ts";
import { toolConverter } from "./services/tool-converter.ts";
import { routeFilter } from "./services/route-filter.ts";
import { requestHandler } from "./services/request-handler.ts";
import { resolveSchemaReferences } from "./services/schema.ts";

// Map of active transports
const activeTransports = new Map<string, SSEServerTransport>();

// Update the fastify types to include our additions
declare module "fastify" {
  interface FastifyInstance {
    mcpServer: Server;
  }

  interface FastifyContextConfig {
    mcp?: {
      /**
       * Hide the route from the MCP tools
       * @default false
       */
      hidden?: boolean;

      /**
       * Will be used as the tool name
       * @default operationId from the route options, or method_url if not present
       */
      name?: string;

      /**
       * Will be used as the tool description
       * @default description from the route options, or method_url if not present
       */
      description?: string;
    };
  }
}

const McpPlugin: FastifyPluginAsync<McpPluginOptions> = async (
  fastify: FastifyInstance,
  _options: McpPluginOptions
) => {
  const options: McpPluginOptions = {
    name: "Fastify MCP",
    description: "MCP server for Fastify",
    mountPath: "/mcp",
    describeFullSchema: false,
    addDebugEndpoint: false,
    transportType: "sse",
    skipHeadRoutes: true,
    skipOptionsRoutes: true,
    ..._options,
  };

  // Initialize our helper functions
  const { convertRouteToTool } = toolConverter(options);
  const { filterRoutes } = routeFilter(options);
  const { handleToolCall } = requestHandler(fastify);

  // Normalize mount path
  const normalizedMountPath = options.mountPath?.startsWith("/")
    ? options.mountPath
    : `/${options.mountPath}`;

  // Store all routes for processing
  const routes: Route[] = [];

  // Setup MCP Server
  const mcpServer = new Server(
    {
      name: options.name!,
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Set up streamable transport
  if (options.transportType === "streamableHttp") {
    const streamableTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await mcpServer.connect(streamableTransport);

    // Set up streamable transport endpoint
    fastify.post(`${normalizedMountPath}`, async (req, res) => {
      fastify.log.info("New streamable connection established", {
        body: req.body,
      });
      try {
        await streamableTransport.handleRequest(req.raw, res.raw, req.body);
      } catch (error) {
        fastify.log.error("Error handling MCP request:", { error });
        if (!res.raw.headersSent) {
          res.status(500).send({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    });
  }

  // Set up SSE transport
  if (options.transportType === "sse") {
    // Set up SSE endpoint
    fastify.get(`${normalizedMountPath}/sse`, async (req, res) => {
      const transport = new SSEServerTransport(
        `${normalizedMountPath}/messages`,
        res.raw
      );
      const sessionId = transport.sessionId;
      activeTransports.set(sessionId, transport);

      fastify.log.info("New SSE connection established", { sessionId });

      // Clean up on connection close
      res.raw.on("close", () => {
        fastify.log.info("SSE connection closed", { sessionId });
        activeTransports.delete(sessionId);
      });

      await mcpServer.connect(transport);
    });

    // Set up messages endpoint
    fastify.post<{
      Querystring: {
        sessionId: string;
      };
    }>(`${normalizedMountPath}/messages`, async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = activeTransports.get(sessionId);

      if (!transport) {
        fastify.log.error("Transport not found for session", { sessionId });
        res.status(404).send({ error: "Session not found" });
        return;
      }

      try {
        await transport.handlePostMessage(req.raw, res.raw, req.body);
      } catch (error) {
        fastify.log.error("Error handling message", {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).send({ error: "Internal server error" });
      }
    });
  }

  // Expose endpoint to list all tools for debugging
  if (options.addDebugEndpoint) {
    fastify.get(`${normalizedMountPath}/tools`, async () => {
      const filteredRoutes = filterRoutes(routes);
      return filteredRoutes.map((route) => convertRouteToTool(route));
    });
  }

  // Collect routes from Fastify
  fastify.addHook("onRoute", (routeOptions: RouteOptions) => {
    // Skip if marked as hidden in MCP config
    if (routeOptions.config?.mcp?.hidden) {
      fastify.log.debug("Skipping hidden route", { url: routeOptions.url });
      return;
    }

    // Extract name or generate one
    const name =
      routeOptions.config?.mcp?.name ||
      ((routeOptions.schema as any)?.operationId as string) ||
      `${routeOptions.method}_${routeOptions.url.replace(/[/:{}]/g, "_")}`;

    // Extract tags
    const tagList = (routeOptions.schema as any)?.tags || [];
    const tags: string[] = Array.isArray(tagList) ? [...tagList] : [];

    // Extract methods
    const methodList = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method];

    // Filter to only valid HTTP methods
    const methods = methodList.filter((method): method is HTTPMethods =>
      ["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT", "OPTIONS"].includes(
        method
      )
    );

    // Skip if no valid methods
    if (methods.length === 0) {
      fastify.log.debug("Skipping route with no valid HTTP methods", {
        url: routeOptions.url,
        methods: methodList,
      });
      return;
    }

    routes.push({
      methods,
      url: routeOptions.url,
      name,
      summary: (routeOptions.schema as any)?.summary as string,
      description:
        routeOptions.config?.mcp?.description ||
        ((routeOptions.schema as any)?.description as string),
      tags,
      querystring: resolveSchemaReferences(
        routeOptions.schema?.querystring,
        routeOptions.schema
      ),
      body: resolveSchemaReferences(
        routeOptions.schema?.body,
        routeOptions.schema
      ),
      params: resolveSchemaReferences(
        routeOptions.schema?.params,
        routeOptions.schema
      ),
      response: resolveSchemaReferences(
        (routeOptions.schema?.response as any)?.[200] ||
          (routeOptions.schema?.response as any)?.["2xx"],
        routeOptions.schema
      ),
    });
  });

  // Expose the MCP server
  fastify.decorate("mcpServer", mcpServer);

  // Register list tools handler
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    fastify.log.info("Listing available tools");
    const filteredRoutes = filterRoutes(routes);
    const tools = filteredRoutes.map((route) => convertRouteToTool(route));
    return {
      tools,
    };
  });

  // Register call tool handler
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      fastify.log.info("Tool execution requested", {
        tool: request.params.name,
      });

      const filteredRoutes = filterRoutes(routes);
      const route = filteredRoutes.find((r) => r.name === request.params.name);

      if (!route) {
        throw new Error(`Tool '${request.params.name}' not found`);
      }

      return await handleToolCall(route, request.params.arguments as any);
    } catch (error) {
      fastify.log.error("Tool execution failed", {
        tool: request.params.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

  fastify.log.info("MCP plugin registered", {
    name: options.name,
    description: options.description,
    mountPath: normalizedMountPath,
  });
};

export default fp(McpPlugin, {
  name: "fastify-mcp",
  fastify: "5.x",
});
