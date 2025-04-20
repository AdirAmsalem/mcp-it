import type { FastifyInstance } from "fastify";
import mcpPlugin from "../src/index.ts";
import type { McpPluginOptions } from "../src/types.ts";

export async function setupFastify(
  fastify: FastifyInstance,
  setup?: (fastify: FastifyInstance) => void,
  options?: Partial<McpPluginOptions>
) {
  await fastify.register(mcpPlugin, {
    name: "Test API",
    description: "API for testing",
    ...options,
  });
  setup?.(fastify);
  await fastify.ready();
  await fastify.listen({ port: 0 });

  const address = `http://localhost:${(fastify.server.address() as any).port}`;

  return {
    address,
  };
}
