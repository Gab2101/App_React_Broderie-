import { createContext, useContext, useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in from localStorage
    const checkAuth = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const signIn = async (username, password) => {
    try {
      // Check username/password against users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        return { error: 'Nom d\'utilisateur ou mot de passe incorrect' };
      }

      // Store user in localStorage
      const userData = { id: data.id, username: data.username };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      return { data: userData };
    } catch (err) {
      return { error: 'Erreur de connexion' };
    }
  };

  const signOut = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
