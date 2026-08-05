/**
 * context/AuthContext.jsx
 * ------------------------------------------------------------
 * Provides authentication state (user, token) and actions
 * (login, register, logout, refresh). Persists the access token
 * via the api client and exposes it app-wide through a hook.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { setToken } from '../services/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.user);
        if (res.user?.language && i18n.language !== res.user.language) {
          i18n.changeLanguage(res.user.language);
        }
      })
      .catch(() => setToken(''))
      .finally(() => setLoading(false));
  }, [i18n]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password, language: i18n.language });
    setToken(res.accessToken);
    setUser(res.user);
    if (res.user?.language && i18n.language !== res.user.language) {
      i18n.changeLanguage(res.user.language);
    }
    return res.user;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password, language: i18n.language });
    setToken(res.accessToken);
    setUser(res.user);
    if (res.user?.language && i18n.language !== res.user.language) {
      i18n.changeLanguage(res.user.language);
    }
    return res.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    setToken('');
    setUser(null);
  };

  const updateLanguage = async (language) => {
    const res = await api.patch('/auth/me/language', { language });
    setUser((prev) => ({ ...prev, language: res.user?.language || language }));
    if (res.accessToken) setToken(res.accessToken);
    return res.user;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, updateLanguage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
