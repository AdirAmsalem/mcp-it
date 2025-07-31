import type { Route, McpTool, McpPluginOptions } from "../types.ts";
import { generateExampleFromSchema, getSchemaType } from "./schema.ts";

function asMDJson(obj: any):string {
  return '```json\n' + JSON.stringify(obj, null, 2) + '\n```'
}

export function toolConverter(options: McpPluginOptions) {
  function buildToolName(route: Route): string {
    return route.name;
  }

  function buildToolDescription(route: Route): string {
    const description: (string|undefined)[] = [route.summary, route.description];


    if (route.tags && route.tags.length > 0) {
      description.push(`Tags: ${route.tags.join(", ")}`);
    }

    // Add response schema information if available
    if (route.response && options.describeFullSchema) {
      description.push("### Response:");

      // Get response example
      const example = generateExampleFromSchema(route.response);
      if (example) {
        description.push(`**Example Response:**\n${asMDJson(example)}`);
      }

      // Add schema information
      if (options.describeFullSchema) {

        description.push(`**Output Schema:**${asMDJson(route.response)}`);
      }
    }

    return description.filter(Boolean).join('\n\n') || route.name;
  }

  function buildToolInputSchema(route: Route): McpTool["inputSchema"] {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add header parameters
    if (route.headers) {
      for (const [key, schema] of Object.entries(
        route.headers.properties || {}
      )) {
        properties[key] = {
          type: getSchemaType(schema),
          title: key,
          description: (schema as any).description ?? `Header: ${key}`,
        };
        if ((route.headers.required || []).includes(key)) {
          required.push(key);
        }
      }
    }

    // Add path parameters
    if (route.params) {
      for (const [key, schema] of Object.entries(
        route.params.properties || {}
      )) {
        properties[key] = {
          type: getSchemaType(schema),
          title: key,
          description: `Path parameter: ${key}`,
        };
        if ((route.params.required || []).includes(key)) {
          required.push(key);
        }
      }
    }

    // Add query parameters
    if (route.querystring) {
      for (const [key, schema] of Object.entries(
        route.querystring.properties || {}
      )) {
        properties[key] = {
          type: getSchemaType(schema),
          title: key,
          description: `Query parameter: ${key}`,
        };
        if ((route.querystring.required || []).includes(key)) {
          required.push(key);
        }
      }
    }

    // Add body parameters
    if (route.body) {
      for (const [key, schema] of Object.entries(route.body.properties || {})) {
        properties[key] = {
          type: getSchemaType(schema),
          title: key,
          description: `Body parameter: ${key}`,
        };
        if ((route.body.required || []).includes(key)) {
          required.push(key);
        }
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
      title: `${route.name}Parameters`,
    };
  }

  function convertRouteToTool(route: Route): McpTool {
    return {
      name: buildToolName(route),
      description: buildToolDescription(route),
      inputSchema: buildToolInputSchema(route),
    };
  }

  return {
    convertRouteToTool,
  };
}
