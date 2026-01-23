import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import Layout from '../Layout';
import { FileText, Clock, CheckCircle, Eye } from 'lucide-react';
import './style.css';
import {useNavigate} from "react-router-dom";

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

    if (loading) {
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
            <div className="consent-my-list-page">
                <div className="consent-page-header">
                    <h1>내 동의서</h1>
                    <p className="consent-page-description">
                        나에게 온 동의서를 확인하고 작성하세요
                    </p>
                </div>

                {/* 작성 대기 */}
                <section className="consent-section">
                    <h2 className="section-title">
                        <Clock size={20} /> 작성 대기 중 ({pendingList.length})
                    </h2>

                    {pendingList.length === 0 ? (
                        <div className="consent-empty-state">
                            <p>작성할 동의서가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="consent-card-grid">
                            {pendingList.map(agreement => (
                                <div key={agreement.id} className="consent-card pending">
                                    <div className="card-header">
                                        <FileText size={24}/>
                                        <span className="card-badge yellow">작성 대기</span>
                                    </div>
                                    <h3>{getConsentTitle(agreement)}</h3>
                                    <p className="card-date">
                                        발송일: {new Date(agreement.createdAt).toLocaleDateString('ko-KR')}
                                    </p>
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

                {/* 작성 완료 */}
                <section className="consent-section">
                    <h2 className="section-title">
                        <CheckCircle size={20} /> 작성 완료 ({completedList.length})
                    </h2>

                    {completedList.length === 0 ? (
                        <div className="consent-empty-state">
                            <p>작성 완료된 동의서가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="consent-card-grid">
                            {completedList.map(agreement => (
                                <div key={agreement.id} className="consent-card completed">
                                    <div className="card-header">
                                        <FileText size={24}/>
                                        <span className="card-badge green">작성 완료</span>
                                    </div>
                                    <h3>{getConsentTitle(agreement)}</h3>
                                    <p className="card-date">
                                        완료일: {agreement.completedAt ? new Date(agreement.completedAt).toLocaleDateString('ko-KR') : '-'}
                                    </p>
                                    <button
                                        className="card-action-btn secondary"
                                        onClick={async () => {
                                            try {
                                                const response = await fetch(`${API_BASE}/consents/${agreement.id}`, {
                                                    headers: {Authorization: `Bearer ${token}`}
                                                });

                                                if (response.ok) {
                                                    const data = await response.json();
                                                    if (data.pdfUrl) {
                                                        // ✅ 전체 URL 구성
                                                        const pdfUrl = `http://localhost:9090${data.pdfUrl}`;
                                                        window.open(pdfUrl, '_blank');
                                                    }
                                                } else {
                                                    alert('동의서 조회 권한이 없습니다.');
                                                }
                                            } catch (error) {
                                                console.error('동의서 조회 실패:', error);
                                                alert('동의서 조회 중 오류가 발생했습니다.');
                                            }
                                        }}
                                    >
                                        <Eye size={16}/> 보기
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