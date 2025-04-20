import type { FastifyInstance } from "fastify";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Route, McpToolPayload } from "../types.ts";

export function requestHandler(fastify: FastifyInstance) {
  function prepareToolPayload(
    route: Route,
    args: Record<string, any>
  ): McpToolPayload {
    const payload: McpToolPayload = {
      params: {},
      query: {},
      body: {},
    };

    // Assign parameters to the appropriate location
    for (const [key, value] of Object.entries(args)) {
      // Check if this is a path parameter
      if (route.params?.properties?.[key]) {
        payload.params[key] = value;
      }
      // Check if this is a query parameter
      else if (route.querystring?.properties?.[key]) {
        payload.query[key] = value;
      }
      // Otherwise, assume it's a body parameter
      else {
        payload.body[key] = value;
      }
    }

    return payload;
  }

  function formatToolResponse(responseBody: string): CallToolResult {
    // Try to parse as JSON
    try {
      const responseJSON = JSON.parse(responseBody);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(responseJSON, null, 2),
          },
        ],
      };
    } catch {
      // Not JSON, return as plain text
      return {
        content: [
          {
            type: "text",
            text: responseBody,
          },
        ],
      };
    }
  }

  async function handleToolCall(route: Route, args: Record<string, any>) {
    const payload = prepareToolPayload(route, args);

    // Replace path parameters in URL
    let url = route.url;
    for (const [key, value] of Object.entries(payload.params)) {
      url = url.replace(`:${key}`, encodeURIComponent(String(value)));
    }

    // Execute request using fastify.inject
    const result = await fastify.inject({
      method: route.methods[0],
      url,
      query: payload.query,
      payload: Object.keys(payload.body).length > 0 ? payload.body : undefined,
    });

    return formatToolResponse(result.body);
  }

  return {
    handleToolCall,
  };
}
