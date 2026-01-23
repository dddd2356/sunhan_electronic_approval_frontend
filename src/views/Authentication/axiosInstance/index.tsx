import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || "/api/v1";

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
});

axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // ✅ localStorage를 최우선으로 사용
        const accessToken = localStorage.getItem('accessToken');

        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
            console.log("🚀 [인터셉터] 토큰 주입 성공 (localStorage)");
        } else {
            console.error("🚫 [인터셉터] localStorage에서 accessToken을 찾을 수 없음");
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ✅ 401 에러 시 자동 로그아웃 처리
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.warn('⚠️ 인증 만료 - 로그인 페이지로 이동');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('tokenExpires');
            localStorage.removeItem('userCache');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;