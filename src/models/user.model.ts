import { model, Document, Schema } from "mongoose";

export interface UserDocument extends Document {
  email: string;
  password: string;
  translations: [string];
  refreshTokens: string[];
  dailyGoal: number;
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
  },
  { timestamps: true }
);

export const User = model<UserDocument>("User", userSchema);
