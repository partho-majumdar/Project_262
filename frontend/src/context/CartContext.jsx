import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(() => {
    let id = localStorage.getItem('nexus_session_id');
    if (!id) {
      id = 'sess-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('nexus_session_id', id);
    }
    return id;
  });

  const fetchCart = async () => {
    try {
      const response = await axiosClient.get('/cart', {
        headers: { 'X-Session-Id': sessionId }
      });
      setCart(response.data);
    } catch (error) {
      console.error('Failed to fetch cart', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [sessionId]);

  const addToCart = async (productId, quantity = 1) => {
    try {
      const response = await axiosClient.post(
        '/cart/items',
        { productId, quantity },
        { headers: { 'X-Session-Id': sessionId } }
      );
      setCart(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to add item to cart', error);
      throw error;
    }
  };

  const updateQuantity = async (cartItemId, newQuantity) => {
    try {
      const response = await axiosClient.put(
        `/cart/items/${cartItemId}`,
        { quantity: newQuantity },
        { headers: { 'X-Session-Id': sessionId } }
      );
      setCart(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to update cart quantity', error);
      throw error;
    }
  };

  const removeFromCart = async (cartItemId) => {
    try {
      const response = await axiosClient.delete(`/cart/items/${cartItemId}`, {
        headers: { 'X-Session-Id': sessionId }
      });
      setCart(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to remove item from cart', error);
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      const response = await axiosClient.delete('/cart/clear', {
        headers: { 'X-Session-Id': sessionId }
      });
      setCart(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to clear cart', error);
      throw error;
    }
  };

  const itemCount = cart?.totalItems || 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        itemCount,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        fetchCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
