import { model, Document, Schema } from "mongoose";

export interface UserDocument extends Document {
  username: string;
  email: string;
  password: string;
  translations: [string];
  refreshTokens: string[];
  dailyGoal: number;
  defaultSourceLanguage: string;
  defaultTargetLanguage: string;
}

export interface UserDocumentWithOutPassword {
  id: string;
  email: string;
  translations: [string];
  refreshTokens: string[];
  dailyGoal: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    translations: [{ type: Schema.Types.ObjectId, ref: "Translation" }],
    refreshTokens: { type: [String], default: [] },
    dailyGoal: { type: Number, default: 10 },
    defaultSourceLanguage: {
      type: String,
      default: "en",
    },
    defaultTargetLanguage: {
      type: String,
      default: "es",
    },
  },
  { timestamps: true }
);

export const User = model<UserDocument>("User", userSchema);
