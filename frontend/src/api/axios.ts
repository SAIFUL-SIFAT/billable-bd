import axios from 'axios'

const api = axios.create({
    baseURL: 'http://127.0.0.1:8001/api',
    headers: { 'Content-Type': 'application/json' }
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
        if (error.response?.status === 401 && !originalRequest?._retry) {
            originalRequest._retry = true
            const refreshToken = localStorage.getItem('refresh')
            try {
                const res = await api.post('/accounts/refresh/', { refresh: refreshToken })
                localStorage.setItem('access', res.data.access);
                originalRequest.headers.Authorization = `Bearer ${res.data.access}`
                return api(originalRequest)
            } catch (err) {
                localStorage.removeItem('access');
                localStorage.removeItem('refresh');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error)
    }
)

export default api;


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
                const res = await axios.post(`${api.defaults.baseURL}/accounts/refresh/`, {
                    refresh: refreshToken,
                });

                const newAccess = res.data.access;
                localStorage.setItem('access', newAccess);
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


