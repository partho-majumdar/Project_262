import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { Roles, SellerStatus } from '../constants/roles';

const AuthContext = createContext(null);

const TOKEN_KEY = 'nexus_token';
const USER_KEY = 'nexus_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    if (!savedUser) return null;
    try {
      return JSON.parse(savedUser);
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const persist = useCallback((tokenVal, userData) => {
    if (tokenVal && userData) {
      localStorage.setItem(TOKEN_KEY, tokenVal);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    persist(null, null);
  }, [persist]);

  useEffect(() => {
    const verifyUserSession = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await axiosClient.get('/auth/me');
        const userData = response.data || response;
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      } catch (error) {
        console.error('Session verification failed:', error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    verifyUserSession();
  }, [token, logout]);

  useEffect(() => {
    const handleForcedLogout = () => logout();
    window.addEventListener('auth:logout', handleForcedLogout);
    return () => window.removeEventListener('auth:logout', handleForcedLogout);
  }, [logout]);

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
    persist(tokenVal, userData);
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
    persist(tokenVal, userData);
    return userData;
  };

  const registerSeller = async (sellerData) => {
    const response = await axiosClient.post('/auth/register/seller', sellerData);
    const authData = response.data || response;
    const tokenVal = authData.accessToken || authData.token;
    const userData = authData.user;

    if (!tokenVal || !userData) {
      throw new Error('Seller registration response payload invalid');
    }

    setToken(tokenVal);
    setUser(userData);
    persist(tokenVal, userData);
    return userData;
  };

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    try {
      const response = await axiosClient.get('/auth/me');
      const userData = response.data || response;
      setUser(userData);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      return userData;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      return null;
    }
  }, [token]);

  const submitSellerApplication = async (applicationData) => {
    const response = await axiosClient.post('/auth/seller/apply', applicationData);
    const payload = response.data || response;
    await refreshUser();
    return payload;
  };

  const fetchSellerApplication = async () => {
    const response = await axiosClient.get('/auth/seller/application');
    return response.data || response;
  };

  const isAuthenticated = !!token && !!user;
  const role = user?.role;
  const sellerStatus = user?.sellerStatus || SellerStatus.NONE;
  const isCustomer = role === Roles.CUSTOMER;
  const isSeller = role === Roles.SELLER;
  const isAdmin = role === Roles.ADMIN;
  const isSellerApproved =
    isAdmin ||
    isSeller ||
    sellerStatus === SellerStatus.APPROVED;
  const isSellerPending = sellerStatus === SellerStatus.PENDING;
  const isSellerRejected = sellerStatus === SellerStatus.REJECTED;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        role,
        sellerStatus,
        isAuthenticated,
        isCustomer,
        isSeller,
        isAdmin,
        isSellerApproved,
        isSellerPending,
        isSellerRejected,
        login,
        register,
        registerSeller,
        logout,
        refreshUser,
        submitSellerApplication,
        fetchSellerApplication,
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
