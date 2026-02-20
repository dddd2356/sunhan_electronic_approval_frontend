import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import Layout from '../Layout';
import { FileText, Clock, CheckCircle, Eye, Calendar, Inbox } from 'lucide-react';
import './style.css';
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_URL || '';

interface ConsentAgreement {
    id: number;
    type: string;
    status: string;
    consentForm: {
        title: string;
    } | null;
    createdAt: string;
    completedAt?: string;
}

const ConsentMyListPage: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;

    const [pendingList, setPendingList] = useState<ConsentAgreement[]>([]);
    const [completedList, setCompletedList] = useState<ConsentAgreement[]>([]);
    const [loading, setLoading] = useState(true);

    const typeNames: Record<string, string> = {
        PRIVACY_POLICY: '개인정보 수집·이용 동의서',
        SOFTWARE_USAGE: '소프트웨어 사용 서약서',
        MEDICAL_INFO_SECURITY: '의료정보 보호 및 보안(교육)서약서'
    };

    const navigate = useNavigate();

    const getConsentTitle = (agreement: ConsentAgreement): string => {
        return agreement.consentForm?.title || typeNames[agreement.type] || '동의서';
    };

    useEffect(() => {
        loadMyConsents();
    }, []);

    const loadMyConsents = async () => {
        try {
            // 작성 대기 중
            const pendingRes = await fetch(`${API_BASE}/consents/my/pending`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (pendingRes.ok) {
                setPendingList(await pendingRes.json());
            }

            // 작성 완료
            const completedRes = await fetch(`${API_BASE}/consents/my/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (completedRes.ok) {
                const all = await completedRes.json();
                setCompletedList(all.filter((a: ConsentAgreement) => a.status === 'COMPLETED'));
            }
        } catch (error) {
            console.error('동의서 목록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const goToWrite = (agreementId: number) => {
        navigate(`/detail/consent/write/${agreementId}`);
    };

    // 로딩 화면 UI 개선
    if (loading) {
        return (
            <Layout>
                <div className="consent-loading-container">
                    <div className="loading-spinner"></div>
                    <p>데이터를 불러오는 중입니다...</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="consent-my-list-page">
                <div className="consent-page-header">
                    <h1>내 동의서 보관함</h1>
                    <p className="consent-page-description">
                        요청받은 동의서를 작성하거나, 완료된 내역을 확인할 수 있습니다.
                    </p>
                </div>

                {/* 작성 대기 섹션 */}
                <section className="consent-section">
                    <h2 className="section-title">
                        <Clock size={22} className="text-blue-500" />
                        <span>작성 대기 중인 동의서</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.9rem', color: '#6b7280', fontWeight: 'normal' }}>
                            총 {pendingList.length}건
                        </span>
                    </h2>

                    {pendingList.length === 0 ? (
                        <div className="consent-empty-state">
                            <div className="empty-icon-box">
                                <Inbox size={32} strokeWidth={1.5} />
                            </div>
                            <p>현재 작성해야 할 동의서가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="consent-card-grid">
                            {pendingList.map(agreement => (
                                <div key={agreement.id} className="consent-card pending">
                                    <div>
                                        <div className="card-header">
                                            <div className="card-icon-wrapper">
                                                <FileText size={20} strokeWidth={2} />
                                            </div>
                                            <span className="card-badge yellow">작성 대기</span>
                                        </div>
                                        <h3>{getConsentTitle(agreement)}</h3>
                                        <p className="card-date">
                                            <Calendar size={14} />
                                            발송일: {new Date(agreement.createdAt).toLocaleDateString('ko-KR')}
                                        </p>
                                    </div>
                                    <button
                                        className="card-action-btn primary"
                                        onClick={() => goToWrite(agreement.id)}
                                    >
                                        작성하기
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* 작성 완료 섹션 */}
                <section className="consent-section">
                    <h2 className="section-title">
                        <CheckCircle size={22} className="text-green-500" />
                        <span>작성 완료된 동의서</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.9rem', color: '#6b7280', fontWeight: 'normal' }}>
                            총 {completedList.length}건
                        </span>
                    </h2>

                    {completedList.length === 0 ? (
                        <div className="consent-empty-state">
                            <div className="empty-icon-box">
                                <Inbox size={32} strokeWidth={1.5} />
                            </div>
                            <p>아직 완료된 동의서 내역이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="consent-card-grid">
                            {completedList.map(agreement => (
                                <div key={agreement.id} className="consent-card completed">
                                    <div>
                                        <div className="card-header">
                                            <div className="card-icon-wrapper">
                                                <FileText size={20} strokeWidth={2}/>
                                            </div>
                                            <span className="card-badge green">작성 완료</span>
                                        </div>
                                        <h3>{getConsentTitle(agreement)}</h3>
                                        <p className="card-date">
                                            <Calendar size={14}/>
                                            완료일: {agreement.completedAt ? new Date(agreement.completedAt).toLocaleDateString('ko-KR') : '-'}
                                        </p>
                                    </div>
                                    <button
                                        className="card-action-btn secondary"
                                        onClick={async () => {
                                            try {
                                                const pdfResp = await fetch(`${API_BASE}/consents/${agreement.id}/pdf`, {
                                                    headers: {Authorization: `Bearer ${token}`}
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
                                        }}
                                    >
                                        <Eye size={18}/>
                                        <span>PDF 보기</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </Layout>
    );
};

export default ConsentMyListPage;