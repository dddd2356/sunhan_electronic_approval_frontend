import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL;

export interface ConsentAgreement {
    id: number;
    type: string;
    status: string;
    consentForm: {
        title: string;
        content: string;
        requiredFields: string;
    };
    targetUserId: string;
    targetUserName: string;
    deptName?: string;
    phone?: string;
    extraData?: Record<string, string>;
    formDataJson?: string;
    pdfUrl?: string;
    createdAt: string;
    completedAt?: string;
}

/**
 * 동의서 상세 조회
 */
export async function fetchConsentAgreement(
    agreementId: number,
    token: string
): Promise<ConsentAgreement> {
    const response = await axios.get<ConsentAgreement>(
        `${API_BASE}/consents/${agreementId}`,
        {
            headers: { Authorization: `Bearer ${token}` }
        }
    );
    return response.data;
}

/**
 * 동의서 작성 완료 (제출)
 */
export async function submitConsentAgreement(
    agreementId: number,
    formData: Record<string, any>,
    token: string
): Promise<void> {
    await axios.put(
        `${API_BASE}/consents/${agreementId}/complete`,
        {
            formDataJson: JSON.stringify(formData)
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            }
        }
    );
}

/**
 * 나에게 온 동의서 목록 (작성 대기)
 */
export async function fetchMyPendingConsents(
    token: string
): Promise<ConsentAgreement[]> {
    const response = await axios.get<ConsentAgreement[]>(
        `${API_BASE}/consents/my/pending`,
        {
            headers: { Authorization: `Bearer ${token}` }
        }
    );
    return response.data;
}

/**
 * 내가 작성한 동의서 목록
 */
export async function fetchMyCompletedConsents(
    token: string
): Promise<ConsentAgreement[]> {
    const response = await axios.get<ConsentAgreement[]>(
        `${API_BASE}/consents/my/list`,
        {
            headers: { Authorization: `Bearer ${token}` }
        }
    );
    return response.data.filter(a => a.status === 'COMPLETED');
}

/**
 * 내가 발송한 동의서 목록
 */
export async function fetchMyIssuedConsents(
    token: string
): Promise<ConsentAgreement[]> {
    const response = await axios.get<ConsentAgreement[]>(
        `${API_BASE}/consents/creator/list`,
        {
            headers: { Authorization: `Bearer ${token}` }
        }
    );
    return response.data;
}

/**
 * 동의서 발송 (1명)
 */
export async function issueConsent(
    targetUserId: string,
    type: string,
    token: string
): Promise<{ agreementId: number; message: string }> {
    const response = await axios.post(
        `${API_BASE}/consents/issue`,
        {
            targetUserId,
            type
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            }
        }
    );
    return response.data;
}

/**
 * 동의서 배치 발송 (여러 명)
 */
export async function issueBatchConsents(
    targetUserIds: string[],
    type: string,
    token: string
): Promise<{ successCount: number; failCount: number }> {
    const response = await axios.post(
        `${API_BASE}/consents/issue/batch`,
        {
            targetUserIds,
            type
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            }
        }
    );
    return response.data;
}

/**
 * 관리자용: 전체 동의서 검색
 */
export async function searchConsents(
    params: {
        status?: string;
        type?: string;
        searchTerm?: string;
        page?: number;
        size?: number;
    },
    token: string
): Promise<{
    content: ConsentAgreement[];
    totalElements: number;
    totalPages: number;
    currentPage: number;
}> {
    const queryParams = new URLSearchParams();

    if (params.status) queryParams.append('status', params.status);
    if (params.type) queryParams.append('type', params.type);
    if (params.searchTerm) queryParams.append('searchTerm', params.searchTerm);
    queryParams.append('page', String(params.page || 0));
    queryParams.append('size', String(params.size || 20));

    const response = await axios.get(
        `${API_BASE}/consents/admin/search?${queryParams}`,
        {
            headers: { Authorization: `Bearer ${token}` }
        }
    );
    return response.data;
}

/**
 * 관리자용: 통계 조회
 */
export async function fetchConsentStatistics(
    token: string
): Promise<{
    totalIssued: number;
    totalCompleted: number;
    completedByType: {
        PRIVACY_POLICY: number;
        SOFTWARE_USAGE: number;
        MEDICAL_INFO_SECURITY: number;
    };
}> {
    const response = await axios.get(
        `${API_BASE}/consents/admin/statistics`,
        {
            headers: { Authorization: `Bearer ${token}` }
        }
    );
    return response.data;
}

/**
 * 사용자별 동의서 완료 현황
 */
export async function fetchUserConsentStatus(
    token: string
): Promise<Record<string, boolean>> {
    const response = await axios.get(
        `${API_BASE}/consents/my/status`,
        {
            headers: { Authorization: `Bearer ${token}` }
        }
    );
    return response.data;
}