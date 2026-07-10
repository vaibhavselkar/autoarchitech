import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5004/api',
  timeout: 60000, // plan generation can involve several sequential Gemini calls
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/auth';
    } else if (error.code === 'ECONNABORTED') {
      error.friendlyMessage = 'The request took too long to respond. Please try again.';
    } else if (!error.response) {
      error.friendlyMessage = 'Could not reach the server. Check your connection and try again.';
    } else {
      error.friendlyMessage = error.response?.data?.message || 'Something went wrong. Please try again.';
    }
    return Promise.reject(error);
  }
);

export default api;