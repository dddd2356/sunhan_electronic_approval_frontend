import axios from 'axios';  // 기존 import 유지

export interface ContractMemo {
    id: number;
    memoText: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

const API_BASE = '';

/** 유틸: 토큰이 있으면 Authorization 헤더 반환 */
const authHeader = (token?: string) =>
    token ? {headers: {Authorization: `Bearer ${token}`}} : undefined;


export const createMemo = async (userId: string, memoText: string, token?: string): Promise<ContractMemo> => {
    const resp = await axios.post(`${API_BASE}/api/v1/memo/${userId}`, { memoText }, authHeader(token));
    return resp.data;
};

export const updateMemo = async (memoId: number, memoText: string, token?: string): Promise<ContractMemo> => {
    const resp = await axios.put(`${API_BASE}/api/v1/memo/${memoId}`, { memoText }, authHeader(token));
    return resp.data;
};

export const deleteMemo = async (memoId: number, token?: string): Promise<void> => {
    await axios.delete(`${API_BASE}/api/v1/memo/${memoId}`, authHeader(token));
};

export const getMyMemos = async (token?: string): Promise<ContractMemo[]> => {
    const resp = await axios.get(`${API_BASE}/api/v1/memo/my`, authHeader(token));
    return resp.data;
};

export const getUserMemos = async (userId: string, token?: string): Promise<ContractMemo[]> => {
    const resp = await axios.get(`${API_BASE}/api/v1/memo/${userId}`, authHeader(token));
    return resp.data;
};