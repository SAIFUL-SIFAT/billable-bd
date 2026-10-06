import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api from '../api/axios';

interface User {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (access: string, refresh: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = async () => {
        try {
            const res = await api.get('/accounts/me/');
            setUser(res.data);

        } catch {
            logout();

        } finally {
            setLoading(false);

        }

    };

    useEffect(() => {
        if (localStorage.getItem('access')) fetchUser();
        else setLoading(false);
    }, []);

    const login = (access: string, refresh: string) => {
        localStorage.setItem('access', access);
        localStorage.setItem('refresh', refresh);
        fetchUser();

    };
    const logout = () => {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );

};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
}
