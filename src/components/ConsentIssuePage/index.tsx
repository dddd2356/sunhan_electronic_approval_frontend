import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { useNavigate } from 'react-router-dom';
import Layout from '../Layout';
import OrgChartModal from '../OrgChartModal';
import { Send, Users, CheckCircle } from 'lucide-react';
import './style.css';

const API_BASE = process.env.REACT_APP_API_URL || '';

interface ConsentType {
    value: string;
    label: string;
    description: string;
}

const CONSENT_TYPES: ConsentType[] = [
    {
        value: 'PRIVACY_POLICY',
        label: '개인정보 수집·이용 동의서',
        description: '개인정보 보호법에 따른 필수 동의서'
    },
    {
        value: 'SOFTWARE_USAGE',
        label: '소프트웨어 사용 서약서',
        description: '회사 소프트웨어 및 장비 사용 관련 서약'
    },
    {
        value: 'MEDICAL_INFO_SECURITY',
        label: '의료정보 보호 및 보안(교육)서약서',
        description: '의료정보 보호 및 보안(교육) 관련 서약서'
    }
];

const ConsentIssuePage: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const navigate = useNavigate();

    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedUsers, setSelectedUsers] = useState<{id: string; name: string}[]>([]);
    const [showOrgModal, setShowOrgModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [canCreate, setCanCreate] = useState(false);

    useEffect(() => {
        checkPermissions();
    }, []);

    const checkPermissions = async () => {
        try {
            const response = await fetch(`${API_BASE}/consents/permissions`, {
                headers: { Authorization: `Bearer ${cookies.accessToken}` }
            });
            const data = await response.json();

            if (!data.canCreate) {
                alert('동의서 발송 권한이 없습니다.');
                navigate('/');
                return;
            }

            setCanCreate(data.canCreate);
        } catch (error) {
            console.error('권한 확인 실패:', error);
            navigate('/');
        }
    };

    const handleIssue = async () => {
        if (!selectedType) {
            alert('동의서 타입을 선택해주세요.');
            return;
        }

        if (selectedUsers.length === 0) {
            alert('대상자를 선택해주세요.');
            return;
        }

        setLoading(true);

        try {
            if (selectedUsers.length === 1) {
                // 단일 발송
                const response = await fetch(`${API_BASE}/consents/issue`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${cookies.accessToken}`
                    },
                    body: JSON.stringify({
                        targetUserId: selectedUsers[0].id,
                        type: selectedType
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '발송 실패');
                }

                alert('동의서가 발송되었습니다.');
            } else {
                // 배치 발송
                const response = await fetch(`${API_BASE}/consents/issue/batch`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${cookies.accessToken}`
                    },
                    body: JSON.stringify({
                        targetUserIds: selectedUsers.map(u => u.id),
                        type: selectedType
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '배치 발송 실패');
                }

                const result = await response.json();
                alert(`${result.successCount}명에게 동의서를 발송했습니다.`);
            }

            // 발송 후 목록 페이지로 이동
            navigate('/admin/consent/my-issued');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const removeUser = (userId: string) => {
        setSelectedUsers(prev => prev.filter(u => u.id !== userId));
    };

    if (!canCreate) {
        return <Layout><div className="consent-loading">권한 확인 중...</div></Layout>;
    }

    return (
        <Layout>
            <div className="consent-issue-container">
                <div className="consent-page-header">
                    <h1>동의서 발송</h1>
                    <p className="consent-page-description">
                        대상자를 선택하고 동의서를 발송합니다
                    </p>
                </div>

                <div className="consent-issue-form">
                    {/* 동의서 타입 선택 */}
                    <div className="consent-form-section">
                        <h3>1. 동의서 종류 선택</h3>
                        <div className="consent-type-grid">
                            {CONSENT_TYPES.map(type => (
                                <div
                                    key={type.value}
                                    className={`consent-type-card ${selectedType === type.value ? 'selected' : ''}`}
                                    onClick={() => setSelectedType(type.value)}
                                >
                                    <div className="consent-type-header">
                                        <div className={`consent-type-radio ${selectedType === type.value ? 'checked' : ''}`}>
                                            {selectedType === type.value && <CheckCircle size={16} />}
                                        </div>
                                        <h4>{type.label}</h4>
                                    </div>
                                    <p className="consent-type-desc">{type.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 대상자 선택 */}
                    <div className="consent-form-section">
                        <h3>2. 대상자 선택</h3>
                        <button
                            className="consent-btn-select-users"
                            onClick={() => setShowOrgModal(true)}
                        >
                            <Users size={18} />
                            조직도에서 선택
                        </button>

                        {selectedUsers.length > 0 && (
                            <div className="consent-selected-users">
                                <div className="consent-users-header">
                                    <span>선택된 대상자: {selectedUsers.length}명</span>
                                </div>
                                <div className="consent-users-list">
                                    {selectedUsers.map(user => (
                                        <div key={user.id} className="consent-user-chip">
                                            <span>{user.name} ({user.id})</span>
                                            <button
                                                onClick={() => removeUser(user.id)}
                                                className="consent-chip-remove"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 발송 버튼 */}
                    <div className="consent-form-actions">
                        <button
                            className="consent-btn-cancel"
                            onClick={() => navigate('/admin/consent/my-issued')}
                        >
                            취소
                        </button>
                        <button
                            className="consent-btn-submit"
                            onClick={handleIssue}
                            disabled={loading || !selectedType || selectedUsers.length === 0}
                        >
                            {loading ? (
                                '발송 중...'
                            ) : (
                                <>
                                    <Send size={18} />
                                    {selectedUsers.length > 1 ? `${selectedUsers.length}명에게 발송` : '발송'}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* 조직도 모달 */}
                {showOrgModal && (
                    <OrgChartModal
                        isOpen={showOrgModal}
                        onClose={() => setShowOrgModal(false)}
                        onSelect={(users) => {
                            setSelectedUsers(prev => {
                                const combined = [...prev, ...users];
                                const uniqueById: Record<string, {id: string; name: string}> = {};
                                combined.forEach(u => { uniqueById[u.id] = u; });
                                return Object.values(uniqueById);
                            });
                            setShowOrgModal(false);
                        }}
                        multiSelect={true}
                        allDepartments={true}
                    />
                )}
            </div>
        </Layout>
    );
};

export default ConsentIssuePage;