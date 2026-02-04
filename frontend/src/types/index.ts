export interface User {
  id: string;
  username: string;
  avatar: string;
  totalKarma: number;
}

export interface Like {
  id: string;
  userId: string;
  targetId: string;
  targetType: "post" | "comment";
  createdAt: Date;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  author: User;
  content: string;
  likes: number;
  likedByCurrentUser: boolean;
  createdAt: Date;
  replies?: Comment[];
}

export interface Post {
  id: string;
  author: User;
  content: string;
  likes: number;
  likedByCurrentUser: boolean;
  commentCount: number;
  createdAt: Date;
  comments?: Comment[];
}

export interface LeaderboardEntry {
  user: User;
  karma24h: number;
  rank: number;
}

export interface KarmaTransaction {
  id: string;
  userId: string;
  amount: number;
  reason: "post_like" | "comment_like";
  sourceId: string;
  createdAt: Date;
}
