import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('nexus_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('nexus_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUserSession = async () => {
      if (token) {
        try {
          const response = await axiosClient.get('/auth/me');
          const userData = response.data || response;
          setUser(userData);
          localStorage.setItem('nexus_user', JSON.stringify(userData));
        } catch (error) {
          console.error('Session verification failed:', error);
          logout();
        }
      }
      setLoading(false);
    };

    verifyUserSession();
  }, [token]);

  const login = async (credentials) => {
    const response = await axiosClient.post('/auth/login', credentials);
    const authData = response.data || response;
    const tokenVal = authData.accessToken || authData.token;
    const userData = authData.user;

    if (!tokenVal || !userData) {
      throw new Error('Authentication response payload invalid');
    }

    setToken(tokenVal);
    setUser(userData);
    localStorage.setItem('nexus_token', tokenVal);
    localStorage.setItem('nexus_user', JSON.stringify(userData));
    return userData;
  };

  const register = async (registerData) => {
    const response = await axiosClient.post('/auth/register', registerData);
    const authData = response.data || response;
    const tokenVal = authData.accessToken || authData.token;
    const userData = authData.user;

    if (!tokenVal || !userData) {
      throw new Error('Registration response payload invalid');
    }

    setToken(tokenVal);
    setUser(userData);
    localStorage.setItem('nexus_token', tokenVal);
    localStorage.setItem('nexus_user', JSON.stringify(userData));
    return userData;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
  };

  const isAuthenticated = !!token && !!user;
  const isCustomer = user?.role === 'ROLE_CUSTOMER';
  const isSeller = user?.role === 'ROLE_SELLER';
  const isAdmin = user?.role === 'ROLE_ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        isCustomer,
        isSeller,
        isAdmin,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
