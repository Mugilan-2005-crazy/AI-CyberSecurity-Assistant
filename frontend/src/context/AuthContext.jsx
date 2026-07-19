/**
 * context/AuthContext.jsx
 * ------------------------------------------------------------
 * Provides authentication state (user, token) and actions
 * (login, register, logout, refresh). Persists the access token
 * via the api client and exposes it app-wide through a hook.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import api, { setToken } from '../services/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return setLoading(false);
    api
      .get('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => setToken(''))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
