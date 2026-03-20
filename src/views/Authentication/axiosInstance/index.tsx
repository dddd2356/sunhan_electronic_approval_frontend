import axios, { InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || "/api/v1";

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true, // httpOnly 쿠키 자동 전송
});

// 요청 인터셉터: Authorization 헤더 주입 제거 (쿠키가 자동으로 전송됨)
axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => config,
    (error) => Promise.reject(error)
);

// 응답 인터셉터: 401/403 시 로그인 페이지로 이동
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('userCache'); // userCache만 제거
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;