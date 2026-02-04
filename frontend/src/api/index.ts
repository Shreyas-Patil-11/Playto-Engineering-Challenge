// API Export - Switch between mock and real API
// Set USE_MOCK_API to false when connecting to real Django backend

const USE_MOCK_API = true; // Set to false to use real Django backend

// Import both APIs
import * as mockApi from './mockApi';
import * as realApi from './api';

// Export the selected API
const api = USE_MOCK_API ? mockApi : realApi;

export const fetchPosts = api.fetchPosts;
export const createPost = api.createPost;
export const likePost = api.likePost;
export const unlikePost = api.unlikePost;
export const fetchComments = api.fetchComments;
export const addComment = api.addComment;
export const likeComment = api.likeComment;
export const unlikeComment = api.unlikeComment;
export const fetchLeaderboard = api.fetchLeaderboard;

// Auth functions (only available in real API)
export const login = realApi.login;
export const register = realApi.register;
export const logout = realApi.logout;
export const getCurrentUser = realApi.getCurrentUser;

// Export flag for components to check
export const isMockApi = USE_MOCK_API;
