import { Schema, model, Document } from "mongoose";

export interface WordType {
  type: string;
  translations: string[];
}

export interface TranslationDocument extends Document {
  category: string;
  question: string;
  answer: WordType[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const wordTypeSchema = new Schema(
  {
    type: { type: String, required: true },
    translations: { type: [String], required: true },
  },
  { _id: false }
);

const translationSchema = new Schema(
  {
    category: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: [wordTypeSchema], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Translation = model<TranslationDocument>("Translation", translationSchema);
