import { Schema, model, Document } from "mongoose";

export interface CategoryDocument extends Document {
  category: string;
  userId: string;
}

const categorySchema = new Schema(
  {
    category: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Category = model<CategoryDocument>("Category", categorySchema);
