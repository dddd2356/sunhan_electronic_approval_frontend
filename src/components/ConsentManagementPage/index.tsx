import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import {
    FileText,
    CheckCircle,
    Clock,
    Search,
    Filter,
    Download,
    Eye
} from 'lucide-react';
import './style.css';
import Layout from "../Layout";

const API_BASE = process.env.REACT_APP_API_URL || '';

interface ConsentAgreement {
    id: number;
    type: string;
    status: string;
    targetUserId: string;
    targetUserName: string;
    creatorId: string;
    createdAt: string;
    completedAt?: string;
    pdfUrl?: string;
}

interface Statistics {
    totalIssued: number;
    totalCompleted: number;
    completedByType: {
        PRIVACY_POLICY: number;
        SOFTWARE_USAGE: number;
        MEDICAL_INFO_SECURITY: number;
    };
}

const ConsentManagementPage: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;

    const [agreements, setAgreements] = useState<ConsentAgreement[]>([]);
    const [statistics, setStatistics] = useState<Statistics | null>(null);
    const [loading, setLoading] = useState(true);

    // 필터 상태
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState<string>('');

    // 페이징
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // 상세보기 모달
    const [selectedAgreement, setSelectedAgreement] = useState<ConsentAgreement | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    useEffect(() => {
        loadData();
    }, [statusFilter, typeFilter, searchTerm, currentPage]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 통계 조회
            const statsRes = await fetch(`${API_BASE}/consents/admin/statistics`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (statsRes.ok) {
                const stats = await statsRes.json();
                setStatistics(stats);
            }

            // 목록 조회
            const params = new URLSearchParams({
                page: currentPage.toString(),
                size: '20',
                ...(statusFilter !== 'ALL' && { status: statusFilter }),
                ...(typeFilter !== 'ALL' && { type: typeFilter }),
                ...(searchTerm && { searchTerm })
            });

            const listRes = await fetch(
                `${API_BASE}/consents/admin/search?${params}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (listRes.ok) {
                const data = await listRes.json();
                setAgreements(data.content);
                setTotalPages(data.totalPages);
                setTotalElements(data.totalElements);
            }
        } catch (error) {
            console.error('데이터 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    // ✅ PDF 다운로드 함수 수정
    const downloadPdf = async (agreementId: number) => {
        try {
            const pdfResp = await fetch(`${API_BASE}/consents/${agreementId}/pdf`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!pdfResp.ok) {
                if (pdfResp.status === 404) {
                    alert('PDF 파일이 아직 생성되지 않았거나 찾을 수 없습니다.');
                } else if (pdfResp.status === 403) {
                    alert('조회 권한이 없습니다.');
                } else {
                    alert('PDF 조회에 실패했습니다.');
                }
                return;
            }

            const blob = await pdfResp.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('PDF 조회 실패:', error);
            alert('PDF 조회 중 오류가 발생했습니다.');
        }
    };

    const viewDetail = (agreement: ConsentAgreement) => {
        setSelectedAgreement(agreement);
        setShowDetailModal(true);
    };

    // 타입 한글 매핑
    const typeNames: Record<string, string> = {
        PRIVACY_POLICY: '개인정보 동의서',
        SOFTWARE_USAGE: '소프트웨어 서약서',
        MEDICAL_INFO_SECURITY: '의료정보 보호 및 보안(교육)서약서'
    };

    // 상태 뱃지
    const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
        const styles: Record<string, any> = {
            ISSUED: { bg: '#fef3c7', color: '#92400e', icon: Clock },
            COMPLETED: { bg: '#d1fae5', color: '#065f46', icon: CheckCircle },
            CANCELLED: { bg: '#f3f4f6', color: '#374151', icon: Clock }
        };

        const style = styles[status] || styles.ISSUED;
        const Icon = style.icon;

        return (
            <span
                className="consent-status-badge"
                style={{ backgroundColor: style.bg, color: style.color }}
            >
        <Icon size={14} />
                {status === 'ISSUED' ? '작성 대기' : status === 'COMPLETED' ? '완료' : '취소됨'}
      </span>
        );
    };

    if (loading && currentPage === 0) {
        return (
            <Layout>
                <div className="consent-loading-container">
                    <div className="loading-spinner"></div>
                    <p>로딩 중...</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="consent-management-page">
                {/* 헤더 */}
                <div className="consent-page-header">
                    <h1>동의서 관리</h1>
                    <p className="consent-page-description">
                        전사 동의서 현황을 조회하고 관리합니다
                    </p>
                </div>

                {/* 통계 카드 */}
                {statistics && (
                    <div className="consent-stats-grid">
                        <div className="consent-stat-card blue">
                            <div className="stat-content">
                                <p className="stat-label">작성 대기</p>
                                <p className="stat-value">{statistics.totalIssued}</p>
                            </div>
                            <Clock className="stat-icon" size={32} />
                        </div>

                        <div className="consent-stat-card green">
                            <div className="stat-content">
                                <p className="stat-label">작성 완료</p>
                                <p className="stat-value">{statistics.totalCompleted}</p>
                            </div>
                            <CheckCircle className="stat-icon" size={32} />
                        </div>

                        <div className="consent-stat-card purple">
                            <div className="stat-content">
                                <p className="stat-label">타입별 완료</p>
                                <div className="stat-detail">
                                    <span>개인정보: {statistics.completedByType.PRIVACY_POLICY}</span>
                                    <span>소프트웨어: {statistics.completedByType.SOFTWARE_USAGE}</span>
                                    <span>의료정보 보호 및 보안(교육): {statistics.completedByType.MEDICAL_INFO_SECURITY}</span>
                                </div>
                            </div>
                            <FileText className="stat-icon" size={32} />
                        </div>
                    </div>
                )}

                {/* 필터 & 검색 */}
                <div className="consent-filter-section">
                    <div className="consent-filters">
                        {/* 상태 필터 */}
                        <div className="filter-group">
                            <label>
                                <Filter size={14} />
                                상태
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setCurrentPage(0);
                                }}
                                className="consent-select"
                            >
                                <option value="ALL">전체</option>
                                <option value="ISSUED">작성 대기</option>
                                <option value="COMPLETED">완료</option>
                            </select>
                        </div>

                        {/* 타입 필터 */}
                        <div className="filter-group">
                            <label>
                                <FileText size={14} />
                                타입
                            </label>
                            <select
                                value={typeFilter}
                                onChange={(e) => {
                                    setTypeFilter(e.target.value);
                                    setCurrentPage(0);
                                }}
                                className="consent-select"
                            >
                                <option value="ALL">전체</option>
                                <option value="PRIVACY_POLICY">개인정보 동의서</option>
                                <option value="SOFTWARE_USAGE">소프트웨어 서약서</option>
                                <option value="MEDICAL_INFO_SECURITY">의료정보 보호 및 보안(교육)서약서</option>
                            </select>
                        </div>

                        {/* 검색 */}
                        <div className="filter-group search">
                            <label>
                                <Search size={14} />
                                검색
                            </label>
                            <input
                                type="text"
                                placeholder="사용자 ID, 이름으로 검색"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(0);
                                }}
                                className="consent-search-input"
                            />
                        </div>
                    </div>

                    <div className="consent-result-info">
                        총 {totalElements}건
                    </div>
                </div>

                {/* 테이블 */}
                <div className="consent-table-wrapper">
                    <table className="consent-table">
                        <thead>
                        <tr>
                            <th>ID</th>
                            <th>타입</th>
                            <th>대상자</th>
                            <th>상태</th>
                            <th>발송일</th>
                            <th>완료일</th>
                            <th>액션</th>
                        </tr>
                        </thead>
                        <tbody>
                        {agreements.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="consent-table-empty">
                                    {searchTerm ? '검색 결과가 없습니다.' : '등록된 동의서가 없습니다.'}
                                </td>
                            </tr>
                        ) : (
                            agreements.map((agreement) => (
                                    <tr key={agreement.id} className="consent-table-row">
                                        <td data-label="ID">{agreement.id}</td>
                                        <td data-label="타입">{typeNames[agreement.type]}</td>
                                        <td data-label="대상자">
                                            <div className="user-cell">
                                                <span className="user-name">{agreement.targetUserName}</span>
                                                <span className="user-id">{agreement.targetUserId}</span>
                                            </div>
                                        </td>
                                        <td data-label="상태">
                                            <StatusBadge status={agreement.status} />
                                        </td>
                                        <td data-label="발송일">{new Date(agreement.createdAt).toLocaleDateString('ko-KR')}</td>
                                        <td data-label="완료일">
                                            {agreement.completedAt
                                                ? new Date(agreement.completedAt).toLocaleDateString('ko-KR')
                                                : '-'}
                                        </td>
                                        <td data-label="액션">
                                            <div className="action-buttons">
                                                <button
                                                    onClick={() => viewDetail(agreement)}
                                                    className="consent-btn-icon"
                                                    title="상세보기"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                {agreement.status === 'COMPLETED' && (
                                                    <button
                                                        onClick={() => downloadPdf(agreement.id)}
                                                        className="consent-btn-icon"
                                                        title="PDF 다운로드"
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>

                {/* 페이징 */}
                {totalPages > 1 && (
                    <div className="consent-pagination">
                        <button
                            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                            disabled={currentPage === 0}
                            className="pagination-btn"
                        >
                            이전
                        </button>

                        <div className="pagination-pages">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const pageNum = currentPage < 3 ? i : currentPage - 2 + i;
                                if (pageNum >= totalPages) return null;

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`pagination-page ${currentPage === pageNum ? 'active' : ''}`}
                                    >
                                        {pageNum + 1}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                            disabled={currentPage === totalPages - 1}
                            className="pagination-btn"
                        >
                            다음
                        </button>
                    </div>
                )}

                {/* 상세보기 모달 (간단 버전) */}
                {showDetailModal && selectedAgreement && (
                    <div className="consent-modal-overlay" onClick={() => setShowDetailModal(false)}>
                        <div className="consent-modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>동의서 상세</h2>
                                <button
                                    className="modal-close"
                                    onClick={() => setShowDetailModal(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="modal-body">
                                <div className="detail-row">
                                    <span className="detail-label">ID:</span>
                                    <span>{selectedAgreement.id}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">타입:</span>
                                    <span>{typeNames[selectedAgreement.type]}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">대상자:</span>
                                    <span>{selectedAgreement.targetUserName} ({selectedAgreement.targetUserId})</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">발송자:</span>
                                    <span>{selectedAgreement.creatorId}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">상태:</span>
                                    <StatusBadge status={selectedAgreement.status} />
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">발송일:</span>
                                    <span>{new Date(selectedAgreement.createdAt).toLocaleString('ko-KR')}</span>
                                </div>
                                {selectedAgreement.completedAt && (
                                    <div className="detail-row">
                                        <span className="detail-label">완료일:</span>
                                        <span>{new Date(selectedAgreement.completedAt).toLocaleString('ko-KR')}</span>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                {selectedAgreement.status === 'COMPLETED' && (
                                    <button
                                        onClick={() => downloadPdf(selectedAgreement.id)}
                                        className="consent-btn-primary"
                                    >
                                        <Download size={16} />
                                        PDF 다운로드
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default ConsentManagementPage;