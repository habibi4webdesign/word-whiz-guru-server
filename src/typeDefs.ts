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

  type Box {
    boxNumber: Int!
    lastReviewed: String!
  }

  type Translation {
    id: ID!
    questionSource: String
    category: String
    question: String!
    answer: [WordType!]!
    userId: String!
    boxes: [Box!]!
    createdAt: String!
    updatedAt: String!
  }

  type Category {
    category: String!
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    getTranslations(category: String): [Translation!]!
    getTranslationsToReview(questionSource: String,category: String): [Translation!]!
    getUser: User
    getUserCategories: [Category!]!
  }

  type Mutation {
    addTranslation(
      category: String
      question: String!
      answer: [WordTypeInput!]!
      questionSource: String
    ): Translation!
    updateTranslationReview(translationId: ID!, difficulty: String!): Translation
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
