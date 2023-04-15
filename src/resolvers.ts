import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Category, CategoryDocument } from "./models/category.model";
import { Translation, TranslationDocument } from "./models/translation.model";
import {
  User,
  UserDocument,
  UserDocumentWithOutPassword,
} from "./models/user.model";
import {
  assignToFirstBox,
  checkUserAuthentication,
  createToken,
  removePassword,
} from "./utils";

import { translate } from "@vitalets/google-translate-api";
import { ApolloError } from "apollo-server-express";
import { ProgressStats, LastReviewedVocab, UserWithOutPassword } from "./types";

const SECRET = process.env.JWT_SECRET || "your-secret-key";

export const resolvers = {
  Query: {
    detectLanguage: async (_: any, { text }: { text: string }) => {
      console.log(text);

      try {
        const { text: translatedText, raw } = await translate(text);
        console.log("🚀 ~ file: resolvers.ts:28 ~ detectLanguage: ~ raw:", raw);
        console.log(
          "🚀 ~ file: resolvers.ts:28 ~ detectLanguage: ~ translatedText:",
          translatedText
        );
        return {
          text: translatedText,
          detectedLanguage: raw.src,
        };
      } catch (err) {
        console.error(err);
        throw new Error("Error detecting language");
      }
    },
    getUserCategories: async (
      _: any,
      __: {},
      context: { user: UserDocument }
    ): Promise<CategoryDocument[]> => {
      checkUserAuthentication(context.user);
      try {
        const categories = await Category.find({ userId: context.user.id });
        return categories;
      } catch (error) {
        throw new Error(`Error fetching user categories: ${error}`);
      }
    },

    getTranslationsToReview: async (
      _: any,
      {
        questionSource,
        category,
      }: { questionSource?: string; category?: string },
      context: { user: UserDocument }
    ): Promise<TranslationDocument[]> => {
      checkUserAuthentication(context.user);

      const currentDate = new Date();
      const translationsToReview: TranslationDocument[] = [];

      try {
        let queryConditions: any = {
          userId: context.user.id,
        };

        if (questionSource) {
          queryConditions.questionSource = questionSource;
        }

        if (category) {
          queryConditions.category = category;
        }

        const translations = await Translation.find(queryConditions);

        for (const translation of translations) {
          for (const box of translation.boxes) {
            const daysBetween = Math.ceil(
              (currentDate.getTime() - box.lastReviewed.getTime()) /
                (1000 * 60 * 60 * 24)
            );

            if (daysBetween >= Math.pow(2, box.boxNumber - 1)) {
              translationsToReview.push(translation);
              break;
            }
          }

          // Limit the translations to review based on the user's daily goal
          if (translationsToReview.length >= context.user.dailyGoal) {
            break;
          }
        }

        return translationsToReview;
      } catch (error) {
        throw new Error(`Error fetching translations to review: ${error}`);
      }
    },

    getTranslations: async (
      _: any,
      args: { category?: string },
      context: { user: UserDocument }
    ): Promise<TranslationDocument[]> => {
      checkUserAuthentication(context.user);
      const { category = "all" } = args;

      let translations: TranslationDocument[] = [];
      try {
        if (category === "all") {
          translations = await Translation.find({ userId: context.user.id });
        } else {
          translations = await Translation.find({
            userId: context.user.id,
            category,
          });
        }
        return translations;
      } catch (error) {
        throw new Error(`Error fetching translations: ${error}`);
      }
    },
    getUser: async (
      _: any,
      __: {},
      context: { user: UserDocument | null }
    ): Promise<UserDocument | null> => {
      checkUserAuthentication(context.user);
      try {
        const user = await User.findById(context.user!.id).select("-password");
        return user;
      } catch (error) {
        throw new Error(`Error fetching user: ${error}`);
      }
    },
    getProgressStats: async (
      _: any,
      __: {},
      context: { user: UserDocument }
    ): Promise<ProgressStats> => {
      checkUserAuthentication(context.user);

      try {
        const translations = await Translation.find({
          userId: context.user.id,
        });
        const categories = await Category.find({ userId: context.user.id });
        const allUsers = await User.find();

        const totalWords = translations.length;

        const vocabsByBox = [0, 0, 0, 0, 0];
        const lastReviewedVocabs: LastReviewedVocab[] = [];
        let completedReviews = 0;

        let wordsNotLearnedYet = 0;
        let newCardsCount = 0;
        let reviewDaysCount = 0;
        let missedDaysCount = 0;

        translations.forEach((translation) => {
          const lastBox = translation.boxes[translation.boxes.length - 1];
          vocabsByBox[lastBox.boxNumber - 1]++;

          lastReviewedVocabs.push({
            translationId: translation.id,
            question: translation.question,
            boxNumber: lastBox.boxNumber,
            lastReviewed: lastBox.lastReviewed,
          });

          if (lastBox.boxNumber === 5) {
            completedReviews++;
          } else {
            wordsNotLearnedYet++;
          }

          if (lastBox.boxNumber === 1 && translation.boxes.length === 1) {
            newCardsCount++;
          }
          reviewDaysCount = new Set(
            translation.boxes.map((box) => box.lastReviewed.toDateString())
          ).size;
        });

        const today = new Date() || 0;
        const firstReviewDate = new Date(
          Math.min(...translations.map((t) => t.createdAt.getTime()))
        );
        let totalDays = 0;
        if (firstReviewDate) {
          totalDays = Math.ceil(
            (today.getTime() - firstReviewDate.getTime()) /
              (1000 * 60 * 60 * 24)
          );
        }

        missedDaysCount = totalDays - reviewDaysCount;

        lastReviewedVocabs.sort(
          (a, b) => b.lastReviewed.getTime() - a.lastReviewed.getTime()
        );

        const dailyReviewCount = context.user.dailyGoal || 1;
        const reviewFrequency = [1, 2, 4, 7, 15]; // Change this array according to your desired review frequencies (in days) for each box

        let totalExpectedReviews = 0;
        translations.forEach((translation) => {
          const lastBox = translation.boxes[translation.boxes.length - 1];
          if (lastBox.boxNumber < 5) {
            totalExpectedReviews += reviewFrequency[lastBox.boxNumber - 1];
          }
        });

        const daysToLearnRemainingWords = totalExpectedReviews
          ? Math.ceil(totalExpectedReviews / dailyReviewCount)
          : 0;

        const userRank =
          allUsers
            .map((user) => user.id)
            .sort(
              (a, b) =>
                translations.filter(
                  (t) =>
                    t.userId === b &&
                    t.boxes[t.boxes.length - 1].boxNumber === 5
                ).length -
                translations.filter(
                  (t) =>
                    t.userId === a &&
                    t.boxes[t.boxes.length - 1].boxNumber === 5
                ).length
            )
            .indexOf(context.user.id) + 1;

        const username = context.user.email.substring(
          0,
          context.user.email.lastIndexOf("@")
        );

        const userEmail = context.user.email;

        const categoryWithWordsCount = categories.map((category) => {
          const wordsInCategory = translations.filter(
            (translation) => translation.category === category.category
          );

          const wordsCount = wordsInCategory.length;

          const wordsNotLearnedYet = wordsInCategory.filter(
            (translation) =>
              translation.boxes[translation.boxes.length - 1].boxNumber !== 5
          ).length;

          return {
            categoryId: category.id,
            category: category.category,
            wordsCount,
            wordsNotLearnedYet,
          };
        });

        const stats: ProgressStats = {
          totalWords,
          vocabsByBox,
          completedReviews,
          wordsNotLearnedYet,
          daysToLearnRemainingWords,
          userRank,
          newCardsCount,
          reviewDaysCount,
          missedDaysCount,
          user: {
            email: userEmail,
            username,
          },
          categories: categoryWithWordsCount,
        };

        return stats;
      } catch (error) {
        throw new Error(`Error fetching progress stats: ${error}`);
      }
    },
  },

  Mutation: {
    updateUserDefaultLanguages: async (
      _: any,
      {
        defaultSourceLanguage,
        defaultTargetLanguage,
      }: {
        defaultSourceLanguage?: string;
        defaultTargetLanguage?: string;
      },
      context: { user: UserDocument | null }
    ): Promise<UserWithOutPassword> => {
      checkUserAuthentication(context.user);

      const updates: { [key: string]: string } = {};

      if (defaultSourceLanguage) {
        updates.defaultSourceLanguage = defaultSourceLanguage;
      }

      if (defaultTargetLanguage) {
        updates.defaultTargetLanguage = defaultTargetLanguage;
      }

      try {
        const user = await User.findByIdAndUpdate(context.user!.id, updates, {
          new: true,
          select: "-password",
        });

        if (!user) {
          throw new Error("User not found");
        }

        return user;
      } catch (error) {
        throw new Error(`Error updating user default languages: ${error}`);
      }
    },

    createCategory: async (
      _: any,
      args: { category: string },
      context: { user: UserDocument }
    ): Promise<CategoryDocument> => {
      checkUserAuthentication(context.user);

      if (!args.category || args.category.trim() === "") {
        throw new ApolloError(
          "Category cannot be null or empty.",
          "CATEGORY_NULL_OR_EMPTY",
          { statusCode: 400 }
        );
      }

      try {
        const existingCategory = await Category.findOne({
          userId: context.user.id,
          category: args.category,
        });

        if (existingCategory) {
          throw new Error("Category already exists.");
        }

        const newCategory = new Category({
          category: args.category,
          userId: context.user.id,
        });

        await newCategory.save();
        return newCategory;
      } catch (error) {
        throw new Error(`Error creating category: ${error}`);
      }
    },
    deleteCategory: async (
      _: any,
      args: { categoryId: string },
      context: { user: UserDocument }
    ): Promise<CategoryDocument> => {
      checkUserAuthentication(context.user);

      if (!args.categoryId) {
        throw new ApolloError(
          "Category ID cannot be null or empty.",
          "CATEGORY_ID_NULL_OR_EMPTY",
          { statusCode: 400 }
        );
      }

      try {
        const existingCategory = await Category.findById(args.categoryId);

        if (!existingCategory) {
          throw new ApolloError("Category not found.", "CATEGORY_NOT_FOUND", {
            statusCode: 404,
          });
        }

        if (existingCategory.userId.toString() !== context.user.id) {
          throw new ApolloError("Unauthorized action.", "UNAUTHORIZED_ACTION", {
            statusCode: 403,
          });
        }

        // Delete all translations associated with the category
        await Translation.deleteMany({
          userId: context.user.id,
          category: existingCategory.category,
        });

        // Delete the category
        await Category.deleteOne({ _id: args.categoryId });
        return existingCategory;
      } catch (error) {
        throw new ApolloError(
          `Error deleting category: ${error}`,
          "DELETE_CATEGORY_ERROR"
        );
      }
    },

    updateUserDailyGoal: async (
      _: any,
      { dailyGoal }: { dailyGoal: number },
      context: { user: UserDocument }
    ): Promise<UserDocument> => {
      console.log("🚀 ~ file: resolvers.ts:341 ~ dailyGoal:", dailyGoal);
      checkUserAuthentication(context.user);

      try {
        const updatedUser = await User.findByIdAndUpdate(
          context.user.id,
          { dailyGoal },
          { new: true }
        );

        if (!updatedUser) {
          throw new Error("User not found");
        }

        return updatedUser;
      } catch (error) {
        throw new Error(`Error updating user daily goal: ${error}`);
      }
    },
    updateTranslationReview: async (
      _: any,
      args: { translationId: string; difficulty: string },
      context: { user: UserDocument }
    ): Promise<TranslationDocument> => {
      checkUserAuthentication(context.user);

      try {
        const translation = await Translation.findById(args.translationId);

        if (!translation || translation.userId.toString() !== context.user.id) {
          throw new Error("Translation not found.");
        }

        const currentDate = new Date();
        let updated = false;

        for (const box of translation.boxes) {
          const daysBetween = Math.ceil(
            (currentDate.getTime() - box.lastReviewed.getTime()) /
              (1000 * 60 * 60 * 24)
          );

          if (daysBetween >= Math.pow(2, box.boxNumber - 1)) {
            if (args.difficulty === "easy") {
              box.boxNumber += 2;
            } else if (args.difficulty === "hard") {
              box.boxNumber = Math.max(1, box.boxNumber - 1);
            } else {
              box.boxNumber++;
            }
            box.lastReviewed = currentDate;
            updated = true;
            break;
          }
        }
        if (!updated) {
          throw new Error("No box found to update.");
        }

        await translation.save();
        return translation;
      } catch (error) {
        throw new Error(`Error updating translation review: ${error}`);
      }
    },

    addTranslation: async (
      _: any,
      args: {
        category?: string;
        question: string;
        answer: { type: string; translations: string[] }[];
        questionSource: string;
      },
      context: { user: UserDocument }
    ): Promise<TranslationDocument> => {
      checkUserAuthentication(context.user);

      try {
        const newTranslation = new Translation({
          category: args.category || "all",
          question: args.question,
          answer: args.answer,
          userId: context.user.id,
          questionSource: args.questionSource,
        });

        assignToFirstBox(newTranslation);

        await newTranslation.save();

        // Check and insert new category if it doesn't exist
        const existingCategory = await Category.findOne({
          userId: context.user.id,
          category: args.category || "all",
        });

        if (!existingCategory) {
          const newCategory = new Category({
            category: args.category || "all",
            userId: context.user.id,
          });

          await newCategory.save();
        }

        return newTranslation;
      } catch (error) {
        throw new Error(`Error adding translation: ${error}`);
      }
    },
    signUp: async (
      _: any,
      args: { email: string; password: string }
    ): Promise<{
      token: string;
      refreshToken: string;
      user: UserDocumentWithOutPassword;
    }> => {
      try {
        const existingUser = await User.findOne({ email: args.email });
        if (existingUser) {
          throw new Error("Email already in use.");
        }

        const hashedPassword = await bcrypt.hash(args.password, 10);
        const newUser = new User({
          email: args.email,
          password: hashedPassword,
        });

        const accessToken = createToken(newUser, SECRET, "10m", "access");
        const refreshToken = createToken(newUser, SECRET, "5d", "refresh");
        // Add the refreshToken to the newUser's refreshTokens array
        if (!newUser.refreshTokens.includes(refreshToken)) {
          newUser.refreshTokens.push(refreshToken);
          await newUser.save();
        }

        // Create a new object without the password field
        const userWithoutPassword = removePassword(newUser);

        return { token: accessToken, refreshToken, user: userWithoutPassword };
      } catch (error) {
        throw new Error(`Error signing up: ${error}`);
      }
    },

    signIn: async (
      _: any,
      args: { email: string; password: string }
    ): Promise<{
      token: string;
      refreshToken: string;
      user: UserDocumentWithOutPassword;
    }> => {
      try {
        const user = await User.findOne({ email: args.email });
        if (!user) {
          throw new Error("No user found with that email.");
        }

        const isPasswordValid = await bcrypt.compare(
          args.password,
          user.password
        );
        if (!isPasswordValid) {
          throw new Error("Incorrect password.");
        }

        //1d
        const accessToken = createToken(user, SECRET, "10m", "access");
        //30d
        const refreshToken = createToken(user, SECRET, "5d", "refresh");

        if (!user.refreshTokens.includes(refreshToken)) {
          // Add the refreshToken to the user refreshTokens array
          user.refreshTokens.push(refreshToken);
          await user.save();
        }

        const userWithoutPassword = removePassword(user);

        return { token: accessToken, refreshToken, user: userWithoutPassword };
      } catch (error) {
        throw new Error(`Error signing in: ${error}`);
      }
    },
    refreshToken: async (
      _: any,
      args: { refreshToken: string }
    ): Promise<{ token: string; user: UserDocument }> => {
      try {
        const decodedToken = jwt.verify(args.refreshToken, SECRET) as {
          id: string;
          type: "refresh" | "access";
        };
        if (decodedToken.type !== "refresh") {
          throw new Error("Invalid token type.");
        }

        const user = await User.findById(decodedToken.id);
        checkUserAuthentication(user);

        if (!user || !user.refreshTokens.includes(args.refreshToken)) {
          throw new Error("Invalid or expired refresh token.");
        }

        const newAccessToken = createToken(user, SECRET, "10m", "access");
        return { token: newAccessToken, user };
      } catch (error) {
        checkUserAuthentication(null, `Error refreshing token: ${error}`);

        throw new Error(`Error refreshing token: ${error}`);
      }
    },

    revokeRefreshToken: async (
      _: any,
      args: { refreshToken: string },
      context: any
    ): Promise<boolean> => {
      try {
        const decodedToken = jwt.verify(args.refreshToken, SECRET) as {
          id: string;
          type: "refresh" | "access";
        };
        if (decodedToken.type !== "refresh") {
          throw new Error("Invalid token type.");
        }

        const user = await User.findById(decodedToken.id);
        if (!user) {
          throw new Error("Invalid user.");
        }

        // Remove the refreshToken from the user's refreshTokens array
        user.refreshTokens = user.refreshTokens.filter(
          (token) => token !== args.refreshToken
        );
        await user.save();

        return true;
      } catch (error) {
        throw new Error(`Error revoking refresh token: ${error}`);
      }
    },
  },
};
