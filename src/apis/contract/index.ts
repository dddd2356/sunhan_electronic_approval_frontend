import axios from '../../views/Authentication/axiosInstance';
import {AxiosResponse} from 'axios';

/** 타입 정의 (컴포넌트와 공유 가능하도록 간단히 작성) */
export interface Contract {
    id: number;
    creatorId: string;
    employeeId: string;
    status: string;
    formDataJson: string;
    pdfUrl?: string;
    jpgUrl?: string;
    createdAt: string;
    updatedAt: string;
    employeeName?: string;
    creatorName?: string;
    rejectionReason?: string;
}

export interface User {
    id: string;
    name: string;
    jobLevel: string; // 0: 직원, 1 : 부서장, 2: 센터장, 3:원장, 4 : 행정원장, 5 : 대표원장, 6 : Admin
    role: string;
    userId?: string;
    userName?: string;
    deptCode?: string;
    jobType?: string;
    phone?: string | null;
    address?: string | null;
    detailAddress?: string | null;
    useFlag?: string;
    permissions?: string[];
}

export interface SignatureState {
    page1: Array<{ text: string; imageUrl?: string; isSigned: boolean }>;
    page2: Array<{ text: string; imageUrl?: string; isSigned: boolean }>;
    page3: Array<{ text: string; imageUrl?: string; isSigned: boolean }>;
    page4_consent: Array<{ text: string; imageUrl?: string; isSigned: boolean }>;
    page4_receipt: Array<{ text: string; imageUrl?: string; isSigned: boolean }>;
    page4_final: Array<{ text: string; imageUrl?: string; isSigned: boolean }>;
}

export interface ContractSignatures {
    signatures: SignatureState;
    agreements: { [page: string]: 'agree' | 'disagree' | '' };
}

const API_BASE = '';

/** ---------- 조회 (GET) ---------- */

/** 단건 조회: response.data (Contract) 반환 */
export const fetchContract = async (id: number): Promise<Contract> => {
    const resp = await axios.get<Contract>(`${API_BASE}/employment-contract/${id}`);
    return resp.data;
};

/** 목록 조회: 기본(in-progress) 또는 completed 선택 가능 */
export const fetchContracts = async (completed = false): Promise<Contract[]> => {
    const path = completed ? `${API_BASE}/employment-contract/completed` : `${API_BASE}/employment-contract`;
    const resp = await axios.get<Contract[]>(path);
    return resp.data;
};
/** 사용자(조직도) 목록 조회 */
export const fetchUsers = async (): Promise<User[]> => {
    const resp = await axios.get<User[]>(`${API_BASE}/user/all`);
    const data = resp.data || [];
    // 서버가 이미 재직자만 내려주면 filter는 무해합니다.
    const activeOnly = data.filter(u => String(u.useFlag ?? '1') === '1');
    return activeOnly;
};

/** 현재 사용자 정보 조회 */
export const fetchCurrentUser = async (): Promise<User> => {
    const resp = await axios.get<User>(`${API_BASE}/user/me`);
    return resp.data;
};

/** 사용자 서명 이미지 조회 */
export const fetchUserSignature = async (): Promise<{ imageUrl?: string; signatureUrl?: string }> => {
    const resp = await axios.get<{ imageUrl?: string; signatureUrl?: string }>(`${API_BASE}/user/me/signature`);
    return resp.data;
};

/** 계약서 서명 데이터 조회 */
export const fetchSignaturesForContract = async (contractId: number): Promise<ContractSignatures> => {
    const resp = await axios.get<ContractSignatures>(`${API_BASE}/employment-contract/${contractId}/signatures`);
    return resp.data;
};

/** ---------- 생성 (POST) ---------- */

/** 계약서 생성: 새 Contract 반환 (response.data) */
export const createContract = async (employeeId: string): Promise<Contract> => {
    const resp = await axios.post<Contract>(`${API_BASE}/employment-contract`, {employeeId});
    return resp.data;
};
/** ---------- 상태 변경 (PUT / POST) ---------- */
/** 주의: 아래 함수들은 전체 AxiosResponse를 반환합니다. (요청자 요구) */

/** 계약서 업데이트 — formData 객체는 JSON 직렬화하여 formDataJson에 담아 보냄 */
export const updateContract = async (id: number, saveData: any): Promise<AxiosResponse<any>> => {
    const payload = {formDataJson: JSON.stringify(saveData)};
    return axios.put(`${API_BASE}/employment-contract/${id}`, payload);
};

/** 서명 요청 (직원 서명 등) — 전체 AxiosResponse 반환 */
export const signContract = async (id: number, formData: any): Promise<AxiosResponse<any>> => {
    const payload = {formDataJson: JSON.stringify(formData)};
    return axios.put(`${API_BASE}/employment-contract/${id}/sign`, payload);
};

/** 발송(관리자가 직원에게 발송) — 전체 AxiosResponse 반환 */
export const sendContract = async (id: number): Promise<AxiosResponse<any>> => {
    return axios.put(`${API_BASE}/employment-contract/${id}/send`, {});
};
/** 반송(관리자에게 반송) — 전체 AxiosResponse 반환 */
export const returnToAdmin = async (id: number, reason: string): Promise<AxiosResponse<any>> => {
    return axios.put(`${API_BASE}/employment-contract/${id}/return`, {reason});
};
/** 승인(완료) — 전체 AxiosResponse 반환 */
export const approveContract = async (id: number): Promise<AxiosResponse<any>> => {
    return axios.put(`${API_BASE}/employment-contract/${id}/approve`, {});
};
/** ---------- 파일 다운로드 ---------- */

/** 계약서 파일 다운로드 (PDF/JPG) */
export const downloadContract = async (id: number, type: 'pdf' | 'jpg'): Promise<Blob> => {
    const resp = await axios.get(`${API_BASE}/employment-contract/${id}/${type}`, {
        responseType: 'blob'
    });
    return resp.data;
};
export const deleteContract = async (contractId: number): Promise<AxiosResponse<{ message: string }>> => {
    return axios.delete(`${API_BASE}/employment-contract/${contractId}`);
};

/** 완료된 계약서 반려 (관리자 전용) */
export const rejectCompletedContract = async (id: number, reason: string): Promise<AxiosResponse<any>> => {
    return axios.put(`${API_BASE}/employment-contract/${id}/reject-completed`, {reason});
};

// 특정 직원의 이전 계약서 목록 조회
export const fetchPreviousContracts = async (employeeId: string) => {
    const response = await axios.get(`${API_BASE}/employment-contract/previous/${employeeId}`);
    return response.data;
};