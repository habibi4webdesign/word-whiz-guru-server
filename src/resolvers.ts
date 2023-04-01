import { Translation, TranslationDocument } from "./models/translation.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  User,
  UserDocument,
  UserDocumentWithOutPassword,
} from "./models/user.model";
import { ApolloError } from "apollo-server";

const removePassword = (user: any): UserDocumentWithOutPassword => {
  const userObj = user.toObject();
  const { password, ...userWithoutPassword } = userObj;
  return {
    id: userObj._id,
    ...userWithoutPassword,
  };
};

const createToken = (
  user: UserDocument,
  secret: string,
  expiresIn: string,
  type: string
) => {
  const { id, email } = user;
  return jwt.sign({ id, email, type }, secret, { expiresIn });
};

const SECRET = process.env.JWT_SECRET || "your-secret-key";

export const resolvers = {
  Query: {
    getTranslations: async (
      _: any,
      args: { category?: string },
      context: { user: UserDocument }
    ): Promise<TranslationDocument[]> => {
      if (!context.user) {
        throw new ApolloError(
          "Authentication required.",
          "AUTHENTICATION_REQUIRED",
          { statusCode: 401 }
        );
      }
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
      if (!context.user) {
        throw new ApolloError(
          "Authentication required.",
          "AUTHENTICATION_REQUIRED",
          { statusCode: 401 }
        );
      }
      try {
        const user = await User.findById(context.user.id).select("-password");
        return user;
      } catch (error) {
        throw new Error(`Error fetching user: ${error}`);
      }
    },
  },

  Mutation: {
    addTranslation: async (
      _: any,
      args: {
        category?: string;
        question: string;
        answer: { type: string; translations: string[] }[];
      },
      context: { user: UserDocument }
    ): Promise<TranslationDocument> => {
      if (!context.user) {
        throw new ApolloError(
          "Authentication required.",
          "AUTHENTICATION_REQUIRED",
          { statusCode: 401 }
        );
      }

      try {
        const newTranslation = new Translation({
          category: args.category || "all",
          question: args.question,
          answer: args.answer,
          userId: context.user.id,
        });

        await newTranslation.save();
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

        const accessToken = createToken(newUser, SECRET, "30s", "access");
        const refreshToken = createToken(newUser, SECRET, "2m", "refresh");
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
        const accessToken = createToken(user, SECRET, "30s", "access");
        //30d
        const refreshToken = createToken(user, SECRET, "2m", "refresh");

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
        if (!user || !user.refreshTokens.includes(args.refreshToken)) {
          throw new Error("Invalid or expired refresh token.");
        }

        const newAccessToken = createToken(user, SECRET, "30s", "access");
        return { token: newAccessToken, user };
      } catch (error) {
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
