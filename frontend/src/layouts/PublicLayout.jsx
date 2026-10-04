import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/common/Header';
import AuthRoleHeader from '../components/common/AuthRoleHeader';
import Footer from '../components/common/Footer';
import { AuthBrandProvider } from '../context/AuthBrandContext';

export default function PublicLayout() {
  const { pathname } = useLocation();
  const isSignIn = pathname === '/login';

  return (
    <AuthBrandProvider>
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 selection:bg-nexus-500 selection:text-white">

        {isSignIn ? <AuthRoleHeader /> : <Header />}

        <main className="flex-grow">
          <Outlet />
        </main>

        <Footer />
      </div>
    </AuthBrandProvider>
  );
}
