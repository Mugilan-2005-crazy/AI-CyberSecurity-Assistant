/**
 * pages/VerifyEmail.jsx
 * Consumes the ?token= from the verification email link and
 * calls the backend to activate the account.
 */
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api.js';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState('verifying');

  useEffect(() => {
    const token = params.get('token');
    if (!token) return setState('error');
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => setState('success'))
      .catch(() => setState('error'));
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md text-center animate-fade-in">
        {state === 'verifying' && <p>Verifying your email...</p>}
        {state === 'success' && (
          <>
            <h1 className="text-xl font-bold text-cyber-400">Email verified!</h1>
            <p className="text-slate-400 my-2">Your account is now active.</p>
            <Link to="/login" className="btn-primary">Continue to login</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 className="text-xl font-bold text-danger">Verification failed</h1>
            <p className="text-slate-400 my-2">The link is invalid or expired.</p>
            <Link to="/login" className="btn-primary">Back to login</Link>
          </>
        )}
      </div>
    </div>
  );
}
