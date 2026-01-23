import React, {useEffect, useState, useRef} from 'react';
import {useCookies} from 'react-cookie';
import Layout from '../../../components/Layout';
import SignatureCanvas from 'react-signature-canvas';
import './style.css';
import NotificationPolicy from "../../../components/NotificationPolicy";
import axios from "axios";

interface User {
    id?: string;
    userId?: string;
    userName?: string;
    phone?: string | null;
    address?: string | null;
    detailAddress?: string | null;
    role?: string;
    jobLevel?: string;
    deptCode?: string;
    email?: string;
    signatureUrl?: string | null;
    signimage?: string | null;
    signpath?: string | null;
    privacyConsent?: boolean;
    notificationConsent?: boolean;
}

const MyPage: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);

    const [formData, setFormData] = useState({
        userName: '',
        phone: '',
        address: '',
        detailAddress: '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
        privacyConsent: false,
        notificationConsent: false
    });

    const [showNotificationPolicyModal, setShowNotificationPolicyModal] = useState(false);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [sigError, setSigError] = useState('');
    const sigCanvas = useRef<SignatureCanvas>(null);
    const [departmentNames, setDepartmentNames] = useState<Record<string, string>>({});

    const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const formatPhoneNumber = (value: string) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 3) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
    };

    const getPositionByJobLevel = (jobLevel: string | number | undefined): string => {
        const level = String(jobLevel);
        switch (level) {
            case '0': return '사원';
            case '1': return '부서장';
            case '2': return '센터장';
            case '3': return '원장';
            case '4': return '행정원장';
            case '5': return '대표원장';
            default: return '';
        }
    };

    useEffect(() => {
        const fetchDepartmentNames = async () => {
            try {
                const response = await axios.get('/api/v1/departments/names', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setDepartmentNames(response.data);
            } catch (error) {
                console.error('부서 이름 조회 실패:', error);
            }
        };
        fetchDepartmentNames();
    }, [token]);

    useEffect(() => {
        fetchMyProfile();
    }, []);

    const fetchMyProfile = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/user/me', {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? {Authorization: `Bearer ${token}`} : {})
                },
                credentials: 'include'
            });
            if (!res.ok) throw new Error('사용자 정보를 불러올 수 없습니다.');
            const data = await res.json();

            const userData = {
                id: data.id || data.userId,
                userId: data.userId || data.id,
                userName: data.userName || data.name,
                phone: data.phone || '',
                address: data.address || '',
                detailAddress: data.detailAddress || '',
                role: data.role,
                jobLevel: data.jobLevel,
                deptCode: data.deptCode,
                email: data.email,
                signatureUrl: data.signatureUrl || '',
                signimage: data.signimage || null,
                signpath: data.signpath || null,
                privacyConsent: data.privacyConsent ?? false,
                notificationConsent: data.notificationConsent ?? false,
            };
            setUser(userData);
            setFormData(prev => ({
                ...prev,
                userName: userData.userName || '',
                phone: userData.phone || '',
                address: userData.address || '',
                detailAddress: userData.detailAddress || '',
                privacyConsent: userData.privacyConsent ?? false,
                notificationConsent: userData.notificationConsent ?? false,
            }));
        } catch (e: any) {
            setError(e.message || '프로필 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleAddressSearch = () => {
        if (typeof window.daum === 'undefined' || !window.daum.Postcode) {
            alert('주소 검색 스크립트 로드 실패');
            return;
        }
        new window.daum.Postcode({
            oncomplete: function(data: any) {
                // 건물명이 있으면 포함, 없으면 도로명 주소만
                let fullAddress = data.roadAddress;
                if (data.buildingName) {
                    fullAddress += ` (${data.buildingName})`;
                }

                setFormData(prev => ({
                    ...prev,
                    address: fullAddress,
                    detailAddress: ''
                }));
                document.getElementById('detail-address')?.focus();
            }
        }).open();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = e.target;
        if (name === 'phone') {
            setFormData(prev => ({...prev, [name]: formatPhoneNumber(value)}));
        } else if (name === 'notificationConsent') {
            setFormData(prev => ({...prev, [name]: e.target.checked}));
        } else {
            setFormData(prev => ({...prev, [name]: value}));
        }
    };

    const handleSave = async () => {
        if (formData.newPassword && formData.newPassword !== formData.confirmNewPassword) {
            alert('새 비밀번호가 일치하지 않습니다.');
            return;
        }
        if (formData.newPassword && formData.newPassword.length < 4) {
            alert('새 비밀번호는 4자 이상이어야 합니다.');
            return;
        }

        try {
            const body: any = {
                userName: formData.userName,
                phone: formData.phone,
                address: formData.address,
                detailAddress: formData.detailAddress,
                privacyConsent: formData.privacyConsent,
                notificationConsent: formData.notificationConsent
            };
            if (formData.newPassword) {
                body.currentPassword = formData.currentPassword;
                body.newPassword = formData.newPassword;
            }

            const res = await fetch(`/api/v1/user/update-profile/${user?.userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                credentials: 'include',
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error('프로필 수정 실패');
            const updated = await res.json();
            setUser(prev => prev ? {...prev, ...updated} : updated);
            // ✅ 비밀번호 필드 초기화 (보안)
            setFormData(prev => ({
                ...prev,
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: ''
            }));
            setIsEditMode(false);
            alert('프로필이 성공적으로 업데이트되었습니다.');
        } catch (e: any) {
            alert(e.message);
        }
    };

    // 2. 파일 업로드 핸들러 추가
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
            setSigError('PNG, JPG, JPEG 파일만 업로드 가능합니다.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setSigError('파일 크기는 5MB를 초과할 수 없습니다.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            setUploadedImage(event.target?.result as string);
            setSigError('');
        };
        reader.readAsDataURL(file);
    };

// 3. 저장 핸들러 수정
    const handleSaveSignature = async () => {
        let blob: Blob | null = null;

        if (signatureMode === 'draw') {
            if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
                setSigError('서명을 입력해주세요.');
                return;
            }

            const canvas = sigCanvas.current.getCanvas();
            blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((b) => resolve(b), 'image/png');
            });
        } else {
            if (!uploadedImage) {
                setSigError('이미지를 선택해주세요.');
                return;
            }

            const response = await fetch(uploadedImage);
            blob = await response.blob();
        }

        if (!blob) {
            setSigError('서명 저장에 실패했습니다.');
            return;
        }

        setSigError('');
        const form = new FormData();
        form.append('file', blob, `${user?.userId}_signature.png`);

        try {
            const resp = await fetch(`/api/v1/user/${user?.userId}/signature`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: form,
                credentials: 'include',
            });

            if (!resp.ok) throw new Error('서명 업로드 실패');

            alert('서명이 등록되었습니다.');
            setShowSignatureModal(false);
            setUploadedImage(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            window.location.reload();
        } catch (e: any) {
            setSigError(e.message);
        }
    };

// 4. 모드 변경 핸들러
    const handleModeChange = (mode: 'draw' | 'upload') => {
        setSignatureMode(mode);
        setSigError('');

        if (mode === 'draw') {
            setUploadedImage(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
            sigCanvas.current?.clear();
        }
    };

    return (
        <Layout>
            <div className="mypage-wrapper">
                <div className="page-header">
                    <div className="page-title">
                        <h1>마이 페이지</h1>
                        <p>계정 정보와 개인 설정을 관리하세요.</p>
                    </div>
                    <div className="action-buttons">
                        {!isEditMode ? (
                            <button className="btn btn-primary" onClick={() => setIsEditMode(true)}>
                                정보 수정
                            </button>
                        ) : (
                            <div className="header-btn-group">
                                <button className="btn btn-secondary" onClick={() => setIsEditMode(false)}>
                                    취소
                                </button>
                                <button className="btn btn-primary" onClick={handleSave}>
                                    저장하기
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="state-message">
                        <div className="loading">로딩중...</div>
                    </div>
                ) : error ? (
                    <div className="state-message error-text">{error}</div>
                ) : user ? (
                    <div className="dashboard-grid">
                        <aside className="card profile-summary-card">
                            <div className="avatar-circle">
                                {user.userName ? user.userName.charAt(0) : 'U'}
                            </div>
                            <div className="user-name">{user.userName}</div>
                            <div className="user-role">
                                {user?.deptCode ? (departmentNames[user.deptCode] ?? user.deptCode) : '-'} / {getPositionByJobLevel(user.jobLevel)}
                            </div>

                            <div className="summary-stats">
                                <div className="stat-item">
                                    <span className="stat-label">사번</span>
                                    <span className="stat-value">{user.userId}</span>
                                </div>
                            </div>
                        </aside>

                        <main className="card detail-card">
                            <div className="section-header">
                                <h3 className="section-title">기본 정보</h3>
                            </div>
                            <div className="section-body">
                                <div className="form-grid">
                                    <div className="form-group full-width">
                                        <label className="label">핸드폰 번호</label>
                                        {isEditMode ? (
                                            <input
                                                className="input-control"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                placeholder="010-0000-0000"
                                            />
                                        ) : (
                                            <div className="value-display">{user.phone || '-'}</div>
                                        )}
                                    </div>

                                    <div className="form-group full-width">
                                        <label className="label">주소</label>
                                        {isEditMode ? (
                                            <div className="input-group">
                                                <input
                                                    className="input-control"
                                                    value={formData.address}
                                                    readOnly
                                                    placeholder="주소 검색"
                                                />
                                                <button type="button" className="btn-addon" onClick={handleAddressSearch}>
                                                    검색
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="value-display">{user.address || '-'}</div>
                                        )}
                                    </div>

                                    <div className="form-group full-width">
                                        <label className="label">상세 주소</label>
                                        {isEditMode ? (
                                            <input
                                                id="detail-address"
                                                className="input-control"
                                                name="detailAddress"
                                                value={formData.detailAddress}
                                                onChange={handleChange}
                                                placeholder="상세 주소 입력"
                                            />
                                        ) : (
                                            <div className="value-display">{user.detailAddress || '-'}</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="section-header">
                                <h3 className="section-title">전자 서명</h3>
                            </div>
                            <div className="section-body">
                                <div className="form-group full-width">
                                    <div className="up-signature-box">
                                        <div className="up-signature-display">
                                            {user.signimage ? (
                                                <img
                                                    src={`data:image/png;base64,${user.signimage.replace(/\s/g, '')}`}
                                                    alt="서명"
                                                    className="up-signature-img"
                                                />
                                            ) : user.signpath ? (
                                                <img
                                                    src={`${process.env.REACT_APP_SERVER_URL || ''}${user.signpath}`}
                                                    alt="서명"
                                                    className="up-signature-img"
                                                />
                                            ) : (
                                                <span className="up-no-signature">등록된 서명이 없습니다.</span>
                                            )}
                                        </div>

                                        {isEditMode && (
                                            <div className="up-signature-action">
                                                <button
                                                    className="btn btn-secondary up-signature-manage-btn"
                                                    onClick={() => setShowSignatureModal(true)}
                                                >
                                                    서명 관리
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {isEditMode && (
                                <>
                                    <div className="section-header">
                                        <h3 className="section-title">보안 설정</h3>
                                    </div>
                                    <div className="section-body">
                                        <div className="form-grid">
                                            <div className="form-group full-width">
                                                <label className="label">현재 비밀번호</label>
                                                <input
                                                    type="password"
                                                    className="input-control"
                                                    name="currentPassword"
                                                    value={formData.currentPassword}
                                                    onChange={handleChange}
                                                    placeholder="비밀번호 변경 시 입력"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="label">새 비밀번호</label>
                                                <input
                                                    type="password"
                                                    className="input-control"
                                                    name="newPassword"
                                                    value={formData.newPassword}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="label">비밀번호 확인</label>
                                                <input
                                                    type="password"
                                                    className="input-control"
                                                    name="confirmNewPassword"
                                                    value={formData.confirmNewPassword}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="section-header">
                                <h3 className="section-title">알림 설정</h3>
                            </div>
                            <div className="section-body">
                                {isEditMode ? (
                                    <div className="consent-box">
                                        <label className="checkbox-wrapper">
                                            <input
                                                type="checkbox"
                                                name="notificationConsent"
                                                checked={formData.notificationConsent}
                                                onChange={handleChange}
                                            />
                                            <span>SMS/알림톡 문서 도착 알림 수신 동의</span>
                                        </label>
                                        <button
                                            type="button"
                                            className="link-btn"
                                            onClick={() => setShowNotificationPolicyModal(true)}
                                        >
                                            약관 보기
                                        </button>
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <span className={`badge ${user.notificationConsent ? 'success' : 'error'}`}>
                                            {user.notificationConsent ? '🔔 알림 수신 동의 중' : '🔕 알림 수신 거부 중'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>
                ) : (
                    <div className="state-message">사용자 정보를 찾을 수 없습니다.</div>
                )}
            </div>

            {showSignatureModal && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h3>서명 등록</h3>
                            <button className="close-btn" onClick={() => {
                                setShowSignatureModal(false);
                                setUploadedImage(null);
                                setSigError('');
                            }}>×</button>
                        </div>

                        {/* 탭 버튼 */}
                        <div className="signature-mode-tabs">
                            <button
                                type="button"
                                className={`tab-btn ${signatureMode === 'draw' ? 'active' : ''}`}
                                onClick={() => handleModeChange('draw')}
                            >
                                직접 그리기
                            </button>
                            <button
                                type="button"
                                className={`tab-btn ${signatureMode === 'upload' ? 'active' : ''}`}
                                onClick={() => handleModeChange('upload')}
                            >
                                이미지 업로드
                            </button>
                        </div>

                        <div className="modal-signature-canvas">
                            {/* 그리기 모드 */}
                            {signatureMode === 'draw' && (
                                <SignatureCanvas
                                    ref={sigCanvas}
                                    penColor="black"
                                    canvasProps={{
                                        width: 400,
                                        height: 200,
                                        className: 'signature-canvas'
                                    }}
                                />
                            )}

                            {/* 업로드 모드 */}
                            {signatureMode === 'upload' && (
                                <div className="upload-section">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg"
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        📁 파일 선택
                                    </button>

                                    {uploadedImage && (
                                        <div className="image-preview">
                                            <img src={uploadedImage} alt="업로드된 서명" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {sigError && <p className="error-message">{sigError}</p>}

                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    if (signatureMode === 'draw') {
                                        sigCanvas.current?.clear();
                                    } else {
                                        setUploadedImage(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }
                                }}
                            >
                                초기화
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveSignature}>
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showNotificationPolicyModal && (
                <div className="modal-overlay">
                    <div className="modal-container modal-container-large">
                        <div className="modal-header">
                            <h3>알림 수신 약관</h3>
                            <button className="close-btn" onClick={() => setShowNotificationPolicyModal(false)}>×</button>
                        </div>
                        <div className="modal-body-scroll">
                            <NotificationPolicy />
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default MyPage;