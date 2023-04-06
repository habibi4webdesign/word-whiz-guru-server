import { Schema, model, Document } from "mongoose";

export interface WordType {
  type: string;
  translations: string[];
}

export interface Box {
  boxNumber: number;
  lastReviewed: Date;
}

export interface TranslationDocument extends Document {
  questionSource: string;
  category: string;
  question: string;
  answer: WordType[];
  userId: string;
  boxes: Box[];
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

const boxSchema = new Schema(
  {
    boxNumber: { type: Number, required: true },
    lastReviewed: { type: Date, required: true },
  },
  { _id: false }
);

const translationSchema = new Schema(
  {
    questionSource: { type: String, required: true },
    category: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: [wordTypeSchema], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    boxes: { type: [boxSchema], default: [] },
  },
  { timestamps: true }
);

export const Translation = model<TranslationDocument>(
  "Translation",
  translationSchema
);
