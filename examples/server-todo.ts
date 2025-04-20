import fastify from "fastify";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import mcpPlugin from "../src/index.ts";

// Todo interface
interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

// In-memory database
let todos: Todo[] = [];
let idCounter = 1;

// Todo plugin
const todoPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get all todos
  fastify.get(
    "/",
    {
      schema: {
        tags: ["todos"],
        summary: "Get all todos",
        description: "Retrieves a list of all todo items",
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "number" },
                title: { type: "string" },
                completed: { type: "boolean" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
    async () => {
      return todos;
    }
  );

  // Get a specific todo
  fastify.get(
    "/:id",
    {
      schema: {
        operationId: "getTodoById",
        tags: ["todos"],
        summary: "Get a specific todo",
        description: "Retrieves a single todo item by id",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "number" },
              title: { type: "string" },
              completed: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          404: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const todo = todos.find((t) => t.id === Number(id));

      if (!todo) {
        reply.code(404);
        return { message: "Todo not found" };
      }

      return todo;
    }
  );

  // Create a new todo
  fastify.post(
    "/",
    {
      schema: {
        tags: ["todos"],
        summary: "Create a new todo",
        description: "Creates a new todo item",
        body: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string" },
            completed: { type: "boolean" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "number" },
              title: { type: "string" },
              completed: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { title, completed = false } = request.body as {
        title: string;
        completed?: boolean;
      };

      const newTodo: Todo = {
        id: idCounter++,
        title,
        completed,
        createdAt: new Date().toISOString(),
      };

      todos.push(newTodo);
      reply.code(201);
      return newTodo;
    }
  );

  // Update a todo
  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["todos"],
        summary: "Update a todo",
        description: "Updates a specific todo item by id",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "number" },
          },
        },
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            completed: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "number" },
              title: { type: "string" },
              completed: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          404: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const { title, completed } = request.body as {
        title?: string;
        completed?: boolean;
      };

      const todo = todos.find((t) => t.id === Number(id));

      if (!todo) {
        reply.code(404);
        return { message: "Todo not found" };
      }

      if (title !== undefined) {
        todo.title = title;
      }

      if (completed !== undefined) {
        todo.completed = completed;
      }

      return todo;
    }
  );

  // Delete a todo
  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["todos"],
        summary: "Delete a todo",
        description: "Deletes a specific todo item by id",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const todoIndex = todos.findIndex((t) => t.id === Number(id));

      if (todoIndex === -1) {
        reply.code(404);
        return { message: "Todo not found" };
      }

      todos.splice(todoIndex, 1);
      return { message: "Todo deleted successfully" };
    }
  );
};

// Create server
const server = fastify({
  logger: true,
});

// Enable CORS
await server.register(import("@fastify/cors"));

// Register swagger
server.register(swagger, {
  swagger: {
    info: {
      title: "Todo API",
      description: "A simple Todo API with CRUD operations",
      version: "1.0.0",
    },
    tags: [{ name: "todos", description: "Todo related endpoints" }],
  },
});

server.register(swaggerUI, {
  routePrefix: "/documentation",
  uiConfig: {
    docExpansion: "list",
    deepLinking: false,
  },
});

await server.register(mcpPlugin, {
  mountPath: "/mcp",
  addDebugEndpoint: true,
});

// Register routes
server.register(todoPlugin, { prefix: "/api/todos" });

// Add hook to generate swagger documentation when the server starts
server.ready(() => {
  server.swagger();
});

// Start server
const start = async () => {
  try {
    await server.listen({ port: 3000 });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
