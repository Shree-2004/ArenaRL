import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, type Agent } from '@/lib/api';

interface User {
    id: string;
    username: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            if (token) {
                try {
                    api.setToken(token);
                    // Fetch real user data from backend, skip redirect on 401
                    const userData = await api.getProfile(true);
                    setUser(userData);
                } catch (err) {
                    console.error("Auth initialization failed", err);
                    logout();
                }
            }
            setLoading(false);
        };
        initAuth();
    }, [token]);

    const login = async (username: string, password: string) => {
        const data = await api.login(username, password);
        setToken(data.access_token);
        setUser(data.user);
        api.setToken(data.access_token);
    };

    const register = async (username: string, email: string, password: string) => {
        await api.register(username, email, password);
        // Automatically login after registration
        await login(username, password);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        api.setToken(null);
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                loading,
                login,
                register,
                logout,
                isAuthenticated: !!token,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
