import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { useNavigate } from 'react-router-dom';
import Layout from '../Layout';
import {
    FileText,
    Clock,
    CheckCircle,
    XCircle,
    Eye,
    Download,
    Send,
    Filter
} from 'lucide-react';
import './style.css';

const API_BASE = process.env.REACT_APP_API_URL || '';

interface ConsentAgreement {
    id: number;
    type: string;
    status: string;
    consentForm: {
        title: string;
    };
    targetUserId: string;
    targetUserName: string;
    createdAt: string;
    completedAt?: string;
    pdfUrl?: string;
}

const ConsentMyIssuedPage: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;

    const navigate = useNavigate();

    const [allList, setAllList] = useState<ConsentAgreement[]>([]);
    const [filteredList, setFilteredList] = useState<ConsentAgreement[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    useEffect(() => {
        loadMyIssuedConsents();
    }, []);

    useEffect(() => {
        applyFilter();
    }, [statusFilter, allList]);

    const loadMyIssuedConsents = async () => {
        try {
            const response = await fetch(`${API_BASE}/consents/creator/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setAllList(data);
            }
        } catch (error) {
            console.error('발송한 동의서 목록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilter = () => {
        if (statusFilter === 'ALL') {
            setFilteredList(allList);
        } else {
            setFilteredList(allList.filter(a => a.status === statusFilter));
        }
    };

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

    const typeNames: Record<string, string> = {
        PRIVACY_POLICY: '개인정보 동의서',
        SOFTWARE_USAGE: '소프트웨어 서약서',
        MEDICAL_INFO_SECURITY: '의료정보 보호 및 보안(교육)서약서'
    };

    const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
        const config: Record<string, any> = {
            ISSUED: { label: '작성 대기', icon: Clock, className: 'status-issued' },
            COMPLETED: { label: '완료', icon: CheckCircle, className: 'status-completed' },
            CANCELLED: { label: '취소됨', icon: XCircle, className: 'status-cancelled' }
        };

        const { label, icon: Icon, className } = config[status] || config.ISSUED;

        return (
            <span className={`consent-status-badge ${className}`}>
                <Icon size={14} />
                {label}
            </span>
        );
    };

    if (loading) {
        return (
            <Layout>
                <div className="consent-issued-loading">
                    <div className="loading-spinner"></div>
                    <p>로딩 중...</p>
                </div>
            </Layout>
        );
    }

    const pendingCount = allList.filter(a => a.status === 'ISSUED').length;
    const completedCount = allList.filter(a => a.status === 'COMPLETED').length;

    return (
        <Layout>
            <div className="consent-issued-page">
                <div className="consent-page-header">
                    <div>
                        <h1>내가 발송한 동의서</h1>
                        <p className="consent-page-description">
                            발송한 동의서의 진행 상황을 확인하세요
                        </p>
                    </div>
                    <button
                        className="consent-btn-primary"
                        onClick={() => navigate('/admin/consent/issue')}
                    >
                        <Send size={18} />
                        새 동의서 발송
                    </button>
                </div>

                {/* 통계 카드 */}
                <div className="consent-issued-stats">
                    <div className="stat-card blue">
                        <div className="stat-icon">
                            <Clock size={24} />
                        </div>
                        <div className="stat-content">
                            <p className="stat-label">작성 대기</p>
                            <p className="stat-value">{pendingCount}</p>
                        </div>
                    </div>

                    <div className="stat-card green">
                        <div className="stat-icon">
                            <CheckCircle size={24} />
                        </div>
                        <div className="stat-content">
                            <p className="stat-label">작성 완료</p>
                            <p className="stat-value">{completedCount}</p>
                        </div>
                    </div>

                    <div className="stat-card gray">
                        <div className="stat-icon">
                            <FileText size={24} />
                        </div>
                        <div className="stat-content">
                            <p className="stat-label">전체</p>
                            <p className="stat-value">{allList.length}</p>
                        </div>
                    </div>
                </div>

                {/* 필터 */}
                <div className="consent-filter-bar">
                    <div className="filter-group">
                        <Filter size={16} />
                        <label>상태</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">전체</option>
                            <option value="ISSUED">작성 대기</option>
                            <option value="COMPLETED">완료</option>
                        </select>
                    </div>
                    <span className="result-count">총 {filteredList.length}건</span>
                </div>

                {/* 목록 */}
                {filteredList.length === 0 ? (
                    <div className="consent-empty-state">
                        <FileText size={64} />
                        <p>발송한 동의서가 없습니다.</p>
                        <button
                            className="consent-btn-primary"
                            onClick={() => navigate('/admin/consent/issue')}
                        >
                            <Send size={18} />
                            동의서 발송하기
                        </button>
                    </div>
                ) : (
                    <div className="consent-issued-table-wrapper">
                        <table className="consent-issued-table">
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
                            {filteredList.map((agreement) => (
                                <tr key={agreement.id}>
                                    <td>{agreement.id}</td>
                                    <td>{typeNames[agreement.type]}</td>
                                    <td>
                                        <div className="user-cell">
                                            <span className="user-name">{agreement.targetUserName}</span>
                                            <span className="user-id">{agreement.targetUserId}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <StatusBadge status={agreement.status} />
                                    </td>
                                    <td>{new Date(agreement.createdAt).toLocaleDateString('ko-KR')}</td>
                                    <td>
                                        {agreement.completedAt
                                            ? new Date(agreement.completedAt).toLocaleDateString('ko-KR')
                                            : '-'}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            {agreement.pdfUrl && (
                                                <button
                                                    onClick={() => downloadPdf(agreement.id)}
                                                    className="btn-icon"
                                                    title="PDF 다운로드"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default ConsentMyIssuedPage;