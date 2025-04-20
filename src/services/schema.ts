// Utility function to get JSON Schema type
export function getSchemaType(schema: any): string {
  if (!schema) return "string";
  if (schema.type) return schema.type;
  if (schema.properties) return "object";
  if (schema.items) return "array";
  return "string";
}

// Convert schema references to actual schema objects
export function resolveSchemaReferences(schema: any, rootSchema: any): any {
  if (!schema) return schema;

  if (typeof schema === "object") {
    // Handle $ref
    if (schema.$ref) {
      const refPath = schema.$ref.replace("#/", "").split("/");
      let resolved = rootSchema;
      for (const segment of refPath) {
        if (resolved[segment]) {
          resolved = resolved[segment];
        } else {
          return schema; // Can't resolve, return as is
        }
      }
      return resolveSchemaReferences(resolved, rootSchema);
    }

    // Recursively process object properties
    const result: any = Array.isArray(schema) ? [] : {};
    for (const [key, value] of Object.entries(schema)) {
      result[key] = resolveSchemaReferences(value, rootSchema);
    }
    return result;
  }

  return schema;
}

// Generate example from JSON schema
export function generateExampleFromSchema(schema: any): any {
  if (!schema) return undefined;

  const type = getSchemaType(schema);

  switch (type) {
    case "string":
      return schema.example || schema.default || "string";
    case "number":
      return schema.example || schema.default || 0;
    case "integer":
      return schema.example || schema.default || 0;
    case "boolean":
      return schema.example || schema.default || false;
    case "array":
      if (schema.items) {
        const itemExample = generateExampleFromSchema(schema.items);
        return [itemExample];
      }
      return [];
    case "object":
      if (schema.properties) {
        const result: any = {};
        for (const [key, prop] of Object.entries(schema.properties as any)) {
          result[key] = generateExampleFromSchema(prop);
        }
        return result;
      }
      return {};
    default:
      return undefined;
  }
}
