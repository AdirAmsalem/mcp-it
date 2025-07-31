// Define our own HTTP methods type to avoid conflicts
export type HTTPMethods =
  | "DELETE"
  | "GET"
  | "HEAD"
  | "PATCH"
  | "POST"
  | "PUT"
  | "OPTIONS";

export interface Route {
  methods: HTTPMethods[];
  url: string;
  name: string;
  summary?: string;
  description?: string;
  tags?: string[];
  headers?: any;
  querystring?: any;
  body?: any;
  params?: any;
  response?: any;
}

export interface McpPluginOptions {
  /**
   * Name for the MCP server
   * @default "Fastify MCP"
   */
  name?: string;

  /**
   * Description for the MCP server
   */
  description?: string;

  /**
   * Whether to include detailed schemas in tool descriptions
   * @default false
   */
  describeFullSchema?: boolean;

  /**
   * Exclude HEAD routes from the MCP tools
   * @default true
   */
  skipHeadRoutes?: boolean;

  /**
   * Exclude OPTIONS routes from the MCP tools
   * @default true
   */
  skipOptionsRoutes?: boolean;

  /**
   * Path prefix where MCP server will be mounted
   * @default "/mcp"
   */
  mountPath?: string;

  /**
   * Filter function to determine if a route should be included in the MCP tools
   * @param route - The route to filter
   * @returns `true` if the route should be included, `false` otherwise
   */
  filter?: (route: Route) => boolean | undefined;

  /**
   * Whether to add a debug endpoint to the MCP server (GET /{mountPath}/tools)
   * @default false
   */
  addDebugEndpoint?: boolean;

  /**
   * Transport to use for the MCP server
   * @default "sse"
   */
  transportType?: "streamableHttp" | "sse";

  /**
   * A function to convert api schema to JSONSchema
   * @param schema - Api schema used by Fastify, zod etc
   * @returns `JSONSchema` a valid JSON schema object
   */
  toJSONSchema?: (schema: any) => {[k: string]: unknown;};
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    title: string;
  };
}

export interface McpToolPayload {
  headers: Record<string, any>;
  params: Record<string, any>;
  query: Record<string, any>;
  body: Record<string, any>;
}
