import jwt from "jsonwebtoken";
import { UserDocument } from "./models/user.model";

interface DecodedToken {
  id: string;
  email: string;
  iat: number;
  exp: number;
}

const SECRET = process.env.JWT_SECRET || "your-secret-key"; // Remember to set up an environment variable for JWT_SECRET in production.

export const getUserFromToken = (token: string): UserDocument | null => {
  try {
    const decodedToken = jwt.verify(token, SECRET) as DecodedToken;
    const user = {
      id: decodedToken.id,
      email: decodedToken.email,
    };

    return user as UserDocument;
  } catch (error) {
    return null;
  }
};
