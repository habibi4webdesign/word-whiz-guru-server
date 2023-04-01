import { gql } from "apollo-server-express";

export const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    password: String!
    createdAt: String!
    updatedAt: String!
  }

  type UserWithOutPassword {
    id: ID!
    email: String!
    createdAt: String!
    updatedAt: String!
  }

  type AuthPayload {
    token: String!
    refreshToken: String
    user: UserWithOutPassword!
  }

  type WordType {
    type: String!
    translations: [String!]!
  }

  type Translation {
    id: ID!
    category: String
    question: String!
    answer: [WordType!]!
    userId: String!
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    getTranslations(category: String): [Translation!]!
    getUser: User
  }

  type Mutation {
    addTranslation(
      category: String
      question: String!
      answer: [WordTypeInput!]!
    ): Translation!
    signUp(email: String!, password: String!): AuthPayload!
    signIn(email: String!, password: String!): AuthPayload!
    refreshToken(refreshToken: String!): AuthPayload!
    revokeRefreshToken(refreshToken: String!): Boolean!
  }

  input WordTypeInput {
    type: String!
    translations: [String!]!
  }
`;
