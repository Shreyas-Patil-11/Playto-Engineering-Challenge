import type { Post, Comment, LeaderboardEntry, User } from '../types';

// API Configuration
const API_BASE_URL = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:8000/api';

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Get auth token from localStorage if available
  const token = localStorage.getItem('authToken');
  if (token) {
    (defaultHeaders as Record<string, string>)['Authorization'] = `Token ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

// Transform backend user to frontend user
function transformUser(backendUser: {
  id: number;
  username: string;
  avatar?: string;
  total_karma: number;
}): User {
  return {
    id: String(backendUser.id),
    username: backendUser.username,
    avatar: backendUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${backendUser.username}`,
    totalKarma: backendUser.total_karma,
  };
}

// Transform backend comment to frontend comment (recursive)
function transformComment(backendComment: {
  id: number;
  author: { id: number; username: string; avatar?: string; total_karma: number };
  content: string;
  likes_count: number;
  is_liked: boolean;
  created_at: string;
  replies?: Array<any>;
  post?: number;
  parent?: number | null;
}): Comment {
  return {
    id: String(backendComment.id),
    postId: String(backendComment.post || ''),
    parentId: backendComment.parent ? String(backendComment.parent) : null,
    author: transformUser(backendComment.author),
    content: backendComment.content,
    likes: backendComment.likes_count,
    likedByCurrentUser: backendComment.is_liked,
    createdAt: new Date(backendComment.created_at),
    replies: backendComment.replies?.map(transformComment) || [],
  };
}

// Transform backend post to frontend post
function transformPost(backendPost: {
  id: number;
  author: { id: number; username: string; avatar?: string; total_karma: number };
  content: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
  comments?: Array<any>;
}): Post {
  return {
    id: String(backendPost.id),
    author: transformUser(backendPost.author),
    content: backendPost.content,
    likes: backendPost.likes_count,
    commentCount: backendPost.comments_count,
    likedByCurrentUser: backendPost.is_liked,
    createdAt: new Date(backendPost.created_at),
    comments: backendPost.comments?.map(transformComment) || [],
  };
}

// ==================== AUTH ====================

export const login = async (username: string, password: string): Promise<{ user: User; token: string }> => {
  const response = await apiCall<{
    token: string;
    user: { id: number; username: string; avatar?: string; total_karma: number };
  }>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  localStorage.setItem('authToken', response.token);

  return {
    user: transformUser(response.user),
    token: response.token,
  };
};

export const register = async (username: string, email: string, password: string): Promise<{ user: User; token: string }> => {
  const response = await apiCall<{
    token: string;
    user: { id: number; username: string; avatar?: string; total_karma: number };
  }>('/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });

  localStorage.setItem('authToken', response.token);

  return {
    user: transformUser(response.user),
    token: response.token,
  };
};

export const logout = async (): Promise<void> => {
  try {
    await apiCall('/auth/logout/', { method: 'POST' });
  } finally {
    localStorage.removeItem('authToken');
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const response = await apiCall<{
      id: number;
      username: string;
      avatar?: string;
      total_karma: number;
    }>('/auth/me/');
    return transformUser(response);
  } catch {
    return null;
  }
};

// ==================== POSTS ====================

export const fetchPosts = async (): Promise<Post[]> => {
  const response = await apiCall<Array<any>>('/posts/');
  return response.map(transformPost);
};

export const fetchPost = async (postId: string): Promise<Post> => {
  const response = await apiCall<any>(`/posts/${postId}/`);
  return transformPost(response);
};

export const createPost = async (content: string): Promise<Post> => {
  const response = await apiCall<any>('/posts/', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  return transformPost(response);
};

export const likePost = async (postId: string): Promise<{ success: boolean; likes: number; karma: number }> => {
  const response = await apiCall<{ likes_count: number; karma_awarded: number }>(
    `/posts/${postId}/like/`,
    { method: 'POST' }
  );
  return {
    success: true,
    likes: response.likes_count,
    karma: response.karma_awarded,
  };
};

export const unlikePost = async (postId: string): Promise<{ success: boolean; likes: number }> => {
  const response = await apiCall<{ likes_count: number }>(
    `/posts/${postId}/unlike/`,
    { method: 'POST' }
  );
  return {
    success: true,
    likes: response.likes_count,
  };
};

// ==================== COMMENTS ====================

export const fetchComments = async (postId: string): Promise<Comment[]> => {
  const response = await apiCall<Array<any>>(`/posts/${postId}/comments/`);
  return response.map(transformComment);
};

export const addComment = async (
  postId: string,
  content: string,
  parentId: string | null = null
): Promise<Comment> => {
  const body: { content: string; parent?: number } = { content };
  if (parentId) {
    body.parent = parseInt(parentId, 10);
  }

  const response = await apiCall<any>(`/posts/${postId}/comments/`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return transformComment(response);
};

export const likeComment = async (
  commentId: string,
  _postId: string
): Promise<{ success: boolean; likes: number }> => {
  const response = await apiCall<{ likes_count: number }>(
    `/comments/${commentId}/like/`,
    { method: 'POST' }
  );
  return {
    success: true,
    likes: response.likes_count,
  };
};

export const unlikeComment = async (
  commentId: string,
  _postId: string
): Promise<{ success: boolean; likes: number }> => {
  const response = await apiCall<{ likes_count: number }>(
    `/comments/${commentId}/unlike/`,
    { method: 'POST' }
  );
  return {
    success: true,
    likes: response.likes_count,
  };
};

// ==================== LEADERBOARD ====================

export const fetchLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const response = await apiCall<Array<{
    user: { id: number; username: string; avatar?: string; total_karma: number };
    karma_24h: number;
    rank: number;
  }>>('/leaderboard/');

  return response.map((entry) => ({
    user: transformUser(entry.user),
    karma24h: entry.karma_24h,
    rank: entry.rank,
  }));
};
