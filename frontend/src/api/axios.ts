import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
})


api.interceptors.request.use((config) => {

    const token = localStorage.getItem('access')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Only attempt refresh on 401 errors, if not already retried, and NOT on auth endpoints
        const isAuthEndpoint =
            originalRequest?.url?.includes('/accounts/refresh/') ||
            originalRequest?.url?.includes('/accounts/login/');

        if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh');

            if (!refreshToken) {
                localStorage.removeItem('access');
                localStorage.removeItem('refresh');
                return Promise.reject(error);
            }

            try {
                // WARNING: Use axios.post directly (NOT api.post) to prevent recursive interceptor calls
                // withCredentials: true allows the browser to send the httpOnly refresh_token cookie
                const res = await axios.post(
                    `${api.defaults.baseURL}/accounts/refresh/`,
                    refreshToken ? { refresh: refreshToken } : {},
                    { withCredentials: true }
                );

                const newAccess = res.data.access;
                localStorage.setItem('access', newAccess);
                if (res.data.refresh) {
                    localStorage.setItem('refresh', res.data.refresh);
                }
                originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                return api(originalRequest);
            } catch (refreshErr) {
                // Refresh token is invalid/expired — clear storage and redirect safely
                localStorage.removeItem('access');
                localStorage.removeItem('refresh');
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshErr);
            }
        }

        return Promise.reject(error);
    }
);

export default api;

export function getApiErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data;
        if (data?.error?.message) {
            return data.error.message;
        }
        if (typeof data?.detail === 'string') {
            return data.detail;
        }
        if (data && typeof data === 'object') {
            const firstKey = Object.keys(data)[0];
            const val = (data as Record<string, unknown>)[firstKey];
            if (Array.isArray(val) && typeof val[0] === 'string') {
                return `${firstKey}: ${val[0]}`;
            }
            if (typeof val === 'string') {
                return `${firstKey}: ${val}`;
            }
        }
        if (error.response?.statusText) {
            return `Server error (${error.response.status}): ${error.response.statusText}`;
        }
        if (error.message) {
            return error.message;
        }
    }
    return 'An unexpected error occurred. Please try again.';
}



