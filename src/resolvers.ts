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

const SECRET = process.env.JWT_SECRET || "your-secret-key";

export const resolvers = {
  Query: {
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
  },

  Mutation: {
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
