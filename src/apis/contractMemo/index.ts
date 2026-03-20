import axiosInstance from '../../views/Authentication/axiosInstance';

export interface ContractMemo {
    id: number;
    memoText: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

const API_BASE = '';

/** 유틸: 토큰이 있으면 Authorization 헤더 반환 */
export const createMemo = async (userId: string, memoText: string): Promise<ContractMemo> => {
    const resp = await axiosInstance.post(`/memo/${userId}`, { memoText });
    return resp.data;
};

export const updateMemo = async (memoId: number, memoText: string): Promise<ContractMemo> => {
    const resp = await axiosInstance.put(`/memo/${memoId}`, { memoText });
    return resp.data;
};

export const deleteMemo = async (memoId: number): Promise<void> => {
    await axiosInstance.delete(`/memo/${memoId}`);
};

export const getMyMemos = async (): Promise<ContractMemo[]> => {
    const resp = await axiosInstance.get(`/memo/my`);
    return resp.data;
};
export const getUserMemos = async (userId: string): Promise<ContractMemo[]> => {
    const resp = await axiosInstance.get(`/memo/${userId}`);
    return resp.data;
};