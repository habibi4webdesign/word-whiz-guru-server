import { ApolloError } from "apollo-server-express";
import { TranslationDocument } from "./models/translation.model";
import { UserDocument, UserDocumentWithOutPassword } from "./models/user.model";
import jwt from "jsonwebtoken";

export const checkUserAuthentication = (
  user: UserDocument | null,
  msg = "Authentication required."
) => {
  if (!user) {
    throw new ApolloError(msg, "AUTHENTICATION_REQUIRED", { statusCode: 401 });
  }
};

export const assignToFirstBox = (translation: TranslationDocument) => {
  const currentDate = new Date();
  translation.boxes.push({ boxNumber: 1, lastReviewed: currentDate });
};

export const removePassword = (user: any): UserDocumentWithOutPassword => {
  const userObj = user.toObject();
  const { password, ...userWithoutPassword } = userObj;
  return {
    id: userObj._id,
    ...userWithoutPassword,
  };
};

export const createToken = (
  user: UserDocument,
  secret: string,
  expiresIn: string,
  type: string
) => {
  const { id, email } = user;
  return jwt.sign({ id, email, type }, secret, { expiresIn });
};
