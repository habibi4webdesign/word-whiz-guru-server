import { ApolloServer, gql } from "apollo-server-express";
import express from "express";
import mongoose from "mongoose";
import { resolvers } from "./resolvers";
import { typeDefs } from "./typeDefs";
import { getUserFromToken } from "./auth";

const startServer = async () => {
  const app = express();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {

      const token = req.headers.authorization || "";
      const user = getUserFromToken(token);

      return { user };
    },
  });

  await server.start();
  server.applyMiddleware({ app });

  await mongoose.connect("mongodb://localhost:27017/wwgdb-app");

  app.listen({ port: 4000 }, () =>
    console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
  );
};

startServer();
