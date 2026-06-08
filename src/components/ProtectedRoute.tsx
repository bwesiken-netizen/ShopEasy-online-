import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'buyer' | 'seller' | 'admin'>;
  requireVerified?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  allowedRoles = ['buyer', 'seller', 'admin'],
  requireVerified = false 
}: ProtectedRouteProps) {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) {
    // Save current URL to redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user.isProfileComplete) {
    // Redirect to profile completion onboarding
    return <Navigate to="/complete-profile" replace />;
  }

  if (requireVerified && !user.isVerified) {
    // Redirect to phone OTP verification
    return <Navigate to="/verify-otp" state={{ phone: user.phone }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Not authorized, fallback to home or relative access
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
