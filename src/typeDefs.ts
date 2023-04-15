import { gql } from "apollo-server-express";

export const typeDefs = gql`
  type CategoryWithWordsCount {
    categoryId: ID!
    category: String!
    wordsCount: Int!
    wordsNotLearnedYet: Int!
  }

  type LastReviewedVocab {
    translationId: ID!
    question: String!
    boxNumber: Int!
    lastReviewed: String!
  }

  type ProgressStats {
    totalWords: Int!
    vocabsByBox: [Int!]!
    completedReviews: Int!
    wordsNotLearnedYet: Int!
    daysToLearnRemainingWords: Int!
    userRank: Int!
    newCardsCount: Int!
    reviewDaysCount: Int!
    missedDaysCount: Int!
    user: UserWithOutPassword!
    categories: [CategoryWithWordsCount!]!
  }

  type User {
    id: ID!
    email: String!
    password: String!
    dailyGoal: Int!
    createdAt: String!
    updatedAt: String!
    defaultSourceLanguage: String!
    defaultTargetLanguage: String!
  }

  type UserWithOutPassword {
    id: ID!
    email: String!
    username: String!
    dailyGoal: Int!
    defaultSourceLanguage: String!
    defaultTargetLanguage: String!
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
    id: ID!
    category: String!
    createdAt: String!
    updatedAt: String!
  }

  type DetectedLanguage {
    text: String!
    detectedLanguage: String!
  }

  type Query {
    getProgressStats: ProgressStats
    getTranslations(category: String): [Translation!]!
    getTranslationsToReview(
      questionSource: String
      category: String
    ): [Translation!]!
    getUser: User
    getUserCategories: [Category!]!
    detectLanguage(text: String!): DetectedLanguage
  }

  type Mutation {
    addTranslation(
      category: String
      question: String!
      answer: [WordTypeInput!]!
      questionSource: String
    ): Translation!
    updateUserDailyGoal(dailyGoal: Int!): User
    updateTranslationReview(
      translationId: ID!
      difficulty: String!
    ): Translation
    signUp(email: String!, password: String!): AuthPayload!
    signIn(email: String!, password: String!): AuthPayload!
    refreshToken(refreshToken: String!): AuthPayload!
    revokeRefreshToken(refreshToken: String!): Boolean!
    createCategory(category: String!): Category!
    deleteCategory(categoryId: ID!): Category!
    updateUserDefaultLanguages(
      defaultSourceLanguage: String
      defaultTargetLanguage: String
    ): UserWithOutPassword!
  }

  input WordTypeInput {
    type: String!
    translations: [String!]!
  }
`;
