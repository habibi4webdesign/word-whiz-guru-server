export interface ProgressStats {
  totalWords: number;
  vocabsByBox: number[];
  completedReviews: number;
  wordsNotLearnedYet: number;
  daysToLearnRemainingWords: number;
  userRank: number;
  newCardsCount: number;
  reviewDaysCount: number;
  missedDaysCount: number;
  user: UserWithOutPassword;
  categories: CategoryWithWordsCount[];
}

export type LastReviewedVocab = {
  translationId: string;
  question: string;
  boxNumber: number;
  lastReviewed: Date;
};

export interface CategoryCount {
  categoryId: string;
  count: number;
}

export interface RecentReview {
  question: string;
  boxNumber: number;
  lastReviewed: Date;
}

export interface UserWithOutPassword {
  email: string;
  username: string;
}

export interface CategoryWithWordsCount {
  categoryId: string;
  category: string;
  wordsCount: number;
  wordsNotLearnedYet: number;
}
