import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * Which brand the public shell should wear on the authentication pages.
 *
 * `PublicLayout` owns the top navigation, but the account type being signed in to is chosen inside
 * `LoginPage`, so the two need to agree. Without this the seller and admin sign-in forms sit under
 * the customer marketplace header, which reads as the wrong portal.
 */
const AuthBrandContext = createContext({ brand: 'ROLE_CUSTOMER', setBrand: () => {} });

export function AuthBrandProvider({ children }) {
  const [brand, setBrand] = useState('ROLE_CUSTOMER');
  const value = useMemo(() => ({ brand, setBrand }), [brand]);
  return <AuthBrandContext.Provider value={value}>{children}</AuthBrandContext.Provider>;
}

export const useAuthBrand = () => useContext(AuthBrandContext);
