import swaggerJSDoc from "swagger-jsdoc";

const rawSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Jjamphong Blog API",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/**/*.ts"],
});

export const swaggerSpec = rawSpec as Record<string, unknown>;
