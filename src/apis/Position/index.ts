import axiosInstance from "../../views/Authentication/axiosInstance";


const API_BASE = '/positions';

export interface Position {
    id: number;
    deptCode: string;
    positionName: string;
    displayOrder: number;
    isActive: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * 부서별 직책 목록 조회
 */
export const fetchPositionsByDept = async (
    deptCode: string
): Promise<Position[]> => {
    const response = await axiosInstance.get(`${API_BASE}/department/${deptCode}`);
    return response.data;
};

/**
 * 직책 생성
 */
export const createPosition = async (
    deptCode: string,
    positionName: string,
    displayOrder: number | null
): Promise<Position> => {
    const response = await axiosInstance.post(
        API_BASE,
        { deptCode, positionName, displayOrder }
    );
    return response.data;
};

/**
 * 직책 수정
 */
export const updatePosition = async (
    positionId: number,
    positionName: string,
    displayOrder: number | null
): Promise<Position> => {
    const response = await axiosInstance.put(
        `${API_BASE}/${positionId}`,
        { positionName, displayOrder }
    );
    return response.data;
};


/**
 * 직책 삭제
 */
export const deletePosition = async (
    positionId: number
): Promise<void> => {
    await axiosInstance.delete(`${API_BASE}/${positionId}`);
};

/**
 * 직책 순서 변경
 */
export const reorderPositions = async (
    deptCode: string,
    positionIds: number[]
): Promise<void> => {
    await axiosInstance.put(
        `${API_BASE}/department/${deptCode}/reorder`,
        { positionIds }
    );
};