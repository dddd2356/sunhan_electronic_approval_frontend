// src/components/ProfileCompletionPopup.tsx
import React, {useState, useEffect, useRef} from 'react';
import './style.css';
import SignatureCanvas from "react-signature-canvas";
import PrivacyPolicy from "../PrivacyPolicy";
import NotificationPolicy from "../NotificationPolicy";

interface ProfileCompletionPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdateSuccess: (updatedUser: any) => void; // 업데이트된 사용자 객체를 전달하도록 수정
    userId: string;
    initialPhone?: string | null;
    initialAddress?: string | null;
    initialDetailAddress?: string | null;
    requirePasswordChange?: boolean;
    initialPrivacyConsent?: boolean;  // 새로 추가: DB에서 가져온 초기 개인정보 동의 값
    initialNotificationConsent?: boolean;  // 새로 추가: DB에서 가져온 초기 알림 동의 값
}

declare global {
    interface Window {
        daum: any;
    }
}

const ProfileCompletionPopup: React.FC<ProfileCompletionPopupProps> = ({
                                                                           isOpen,
                                                                           onClose,
                                                                           onUpdateSuccess,
                                                                           userId,
                                                                           initialPhone,
                                                                           initialAddress,
                                                                           initialDetailAddress,
                                                                           requirePasswordChange = false,
                                                                           initialPrivacyConsent = false,
                                                                           initialNotificationConsent = false,
                                                                       }) => {
    const [phone, setPhone] = useState(initialPhone || '');
    const [address, setAddress] = useState(initialAddress || '');
    const [originalPhone, setOriginalPhone] = useState(initialPhone || '');
    const [editingPhone, setEditingPhone] = useState(false);
    // 새로운 상태: 상세 주소 (동, 호수 등)
    const [detailAddress, setDetailAddress] = useState(initialDetailAddress || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSignature, setShowSignature] = useState(false);
    const sigCanvas = useRef<SignatureCanvas>(null);
    const [sigError, setSigError] = useState<string>('');

    // 개인정보 동의 관련 상태
    const [privacyConsent, setPrivacyConsent] = useState(initialPrivacyConsent);  // 수정: initial 값으로 설정
    const [notificationConsent, setNotificationConsent] = useState(initialNotificationConsent);  // 수정: initial 값으로 설정
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);

    useEffect(() => {
        setPhone(initialPhone || '');
        setOriginalPhone(initialPhone || '');
        setEditingPhone(false);
        setAddress(initialAddress || '');
        setDetailAddress(initialDetailAddress || '');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setError('');
        // 동의 상태 초기화
        setPrivacyConsent(initialPrivacyConsent);
        setNotificationConsent(initialNotificationConsent);
        setShowPrivacyModal(false);
        setShowNotificationModal(false);
    }, [initialPhone, initialAddress, initialDetailAddress, initialPrivacyConsent, initialNotificationConsent, isOpen]);


    if (!isOpen) {
        return null;
    }

    const isPhoneValid = (input: string) => {
        const digits = input.replace(/\D/g, '');
        return /^010\d{8}$/.test(digits); // 한국 휴대폰 번호 형식으로 더 엄격하게
    };

    const formatPhoneNumber = (value: string) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 3) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setPhone(formatted);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    //npm install react-signature-canvas 설치 필요함
    const handleSaveSignature = async () => {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
            setSigError('서명을 해주세요.');
            return;
        }
        setSigError('');
        // 캔버스를 Blob으로 변환
        sigCanvas.current.getCanvas().toBlob(async (blob) => {
            if (!blob) return;
            const form = new FormData();
            form.append('file', blob, `${userId}_signature.png`);
            try {
                const resp = await fetch(`/api/v1/user/${userId}/signature`, {
                    method: 'POST',
                    body: form,
                    credentials: 'include',
                });
                if (!resp.ok) throw new Error('서명 업로드 실패');
                alert('서명이 등록되었습니다.');
                setShowSignature(false);
            } catch (e: any) {
                setSigError(e.message);
            }
        }, 'image/jpg');
    };

    const handleAddressSearch = () => {
        if (typeof window.daum === 'undefined' || !window.daum.Postcode) {
            alert('주소 검색 스크립트를 불러오지 못했습니다. `public/index.html` 파일을 확인해주세요.');
            return;
        }

        new window.daum.Postcode({
            oncomplete: function(data: any) {
                // 도로명 주소만 address 상태에 저장합니다.
                setAddress(data.roadAddress);
                // 상세 주소 필드에 포커스를 맞춥니다.
                const detailAddressInput = document.getElementById('detail-address');
                if (detailAddressInput) {
                    detailAddressInput.focus();
                }
            }
        }).open();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        // 개인정보 동의 확인
        if (!privacyConsent) {
            setError('개인정보 수집·이용에 동의해주세요.');
            return;
        }

        if (requirePasswordChange || (newPassword && newPassword.length > 0)) {
            if (newPassword !== confirmNewPassword) {
                setError('새 비밀번호가 일치하지 않습니다.');
                return;
            }
            if (newPassword.length < 4) {
                setError('새 비밀번호는 최소 4자 이상이어야 합니다.');
                return;
            }
            if (!currentPassword || currentPassword.trim() === '') {
                setError('비밀번호 변경을 위해 현재 비밀번호를 입력해 주세요.');
                return;
            }
        }

        setLoading(true);
        try {
            const requestBody: {
                phone?: string;
                address?: string;
                detailAddress?: string;
                currentPassword?: string;
                newPassword?: string;
                privacyConsent?: boolean;
                notificationConsent?: boolean;
            } = {};

            // phone과 address는 값이 있을 경우에만 포함
            if (phone.trim() !== '') requestBody.phone = phone.trim();
            if (address.trim() !== '') requestBody.address = address.trim();
            if (detailAddress.trim() !== '') requestBody.detailAddress = detailAddress.trim(); // <-- 이 로직 추가

            // 개인정보 동의는 필수이므로 항상 포함
            requestBody.privacyConsent = privacyConsent;

            // 알림 동의 정보 포함
            requestBody.notificationConsent = notificationConsent;

            // newPassword가 입력되었을 때만 currentPassword와 newPassword 포함
            if (newPassword.trim() !== '') {
                requestBody.currentPassword = currentPassword.trim();
                requestBody.newPassword = newPassword.trim();
            }

            const response = await fetch(`/api/v1/user/update-profile/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // 중요: 쿠키를 포함하여 요청을 보낼 때 필요
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '프로필 업데이트에 실패했습니다.');
            }

            const updatedUser = await response.json(); // 업데이트된 사용자 객체를 받음
            alert('프로필 정보가 성공적으로 업데이트되었습니다.');
            onUpdateSuccess(updatedUser); // 업데이트 성공 콜백 호출, 업데이트된 사용자 정보 전달
            onClose(); // 팝업 닫기

        } catch (err: any) {
            setError(err.message || '알 수 없는 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="popup-overlay">
            <div className="popup-content">
                <h2>프로필 정보 업데이트{<span style={{color: 'red'}}>(필수)</span>}</h2>
                <p>{requirePasswordChange ? '보안을 위해 비밀번호 및 필수 정보를 업데이트해 주세요.' : '필요한 프로필 정보를 업데이트해 주세요.'}</p>
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="phone">핸드폰 번호:</label>
                        <input
                            type="text"
                            id="phone"
                            value={phone}
                            onChange={handlePhoneChange}
                            placeholder="예: 010-0000-0000"
                            style={{flex: 1}}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="address">주소:</label>
                        <div style={{display: 'flex', alignItems: 'center'}}>
                            <input
                                type="text"
                                id="address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="주소 검색 버튼을 눌러주세요"
                                readOnly // 추가
                                style={{flex: 1, marginRight: '10px'}}
                            />
                            <button
                                type="button"
                                onClick={handleAddressSearch} // 추가
                                className="address-search-btn"
                            >
                                주소 검색
                            </button>
                        </div>
                    </div>
                    {/* 상세 주소 입력 필드 */}
                    <div className="form-group">
                        <label htmlFor="detail-address">상세 주소:</label>
                        <input
                            type="text"
                            id="detail-address"
                            value={detailAddress}
                            onChange={(e) => setDetailAddress(e.target.value)}
                            placeholder="예: 101동 101호"
                        />
                    </div>
                    <div className="password-change-section">
                        <h3>비밀번호 변경 {requirePasswordChange && <span style={{color: 'red'}}>(필수)</span>}</h3>
                        <div className="form-group">
                            <label htmlFor="currentPassword">현재 비밀번호:</label>
                            <input
                                type="password"
                                id="currentPassword"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required={requirePasswordChange || newPassword.length > 0}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="newPassword">새 비밀번호:</label>
                            <input
                                type="password"
                                id="newPassword"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required={requirePasswordChange}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="confirmNewPassword">새 비밀번호 확인:</label>
                            <input
                                type="password"
                                id="confirmNewPassword"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                required={requirePasswordChange || newPassword.length > 0}
                            />
                        </div>
                    </div>

                    <h3>서명 등록</h3>
                    {/* 1) 서명 등록 버튼 */}
                    <div className="form-group" style={{textAlign: "center"}}>
                        <button
                            type="button"
                            onClick={() => setShowSignature(true)}
                            className="signature-btn"
                        >
                            서명 등록하기
                        </button>
                    </div>

                    {/* 2) 서명 캔버스 모달 */}
                    {showSignature && (
                        <div className="signature-modal">
                            <h3>서명을 해주세요</h3>
                            <SignatureCanvas
                                ref={sigCanvas}
                                penColor="black"
                                canvasProps={{width: 400, height: 200, className: 'sigCanvas'}}
                            />
                            {sigError && <p className="error-message">{sigError}</p>}
                            <div className="signature-actions">
                                <button type="button" onClick={() => sigCanvas.current?.clear()}>
                                    지우기
                                </button>
                                <button type="button" onClick={handleSaveSignature}>
                                    저장
                                </button>
                                <button type="button" onClick={() => setShowSignature(false)}>
                                    취소
                                </button>
                            </div>
                        </div>
                    )}


                    {/* 개인정보 동의 섹션 */}
                    <div className="consent-section"
                         style={{border: '1px solid #ddd', padding: '15px', margin: '20px 0'}}>
                        <h3>개인정보 수집·이용 동의</h3>

                        {/* 필수 동의 */}
                        <div className="consent-item">
                            <label style={{display: 'flex', alignItems: 'center', marginBottom: '10px'}}>
                                <input
                                    type="checkbox"
                                    checked={privacyConsent}
                                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                                    style={{marginRight: '8px'}}
                                />
                                <span><strong>[필수]</strong> 개인정보 수집·이용 동의 (본인인증, 서비스 이용)</span>
                                <button
                                    type="button"
                                    onClick={() => setShowPrivacyModal(true)}
                                    className="detail-btn"
                                    style={{marginLeft: '10px', fontSize: '12px'}}
                                >
                                    자세히 보기
                                </button>
                            </label>
                        </div>

                        {/* 선택 동의 */}
                        <div className="consent-item">
                            <label style={{display: 'flex', alignItems: 'center'}}>
                                <input
                                    type="checkbox"
                                    checked={notificationConsent}
                                    onChange={(e) => setNotificationConsent(e.target.checked)}
                                    style={{marginRight: '8px'}}
                                />
                                <span><strong>[선택]</strong> 알림 수신동의 (SMS/알림톡)</span>
                                <button
                                    type="button"
                                    onClick={() => setShowNotificationModal(true)}
                                    className="detail-btn"
                                    style={{marginLeft: '10px', fontSize: '12px'}}
                                >
                                    자세히 보기
                                </button>
                            </label>
                        </div>
                    </div>

                    {/* 개인정보 동의서 모달 */}
                    {showPrivacyModal && (
                        <div className="policy-modal-overlay">
                            <div className="policy-modal-content">
                                <div className="policy-modal-header">
                                    <button
                                        type="button"
                                        onClick={() => setShowPrivacyModal(false)}
                                        className="policy-modal-close-btn"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="policy-modal-body">
                                    <PrivacyPolicy/>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 마케팅 수신동의서 모달 */}
                    {showNotificationModal && (
                        <div className="policy-modal-overlay">
                            <div className="policy-modal-content">
                                <div className="policy-modal-header">
                                    <button
                                        type="button"
                                        onClick={() => setShowNotificationModal(false)}
                                        className="policy-modal-close-btn"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="policy-modal-body">
                                    <NotificationPolicy/>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="popup-actions">
                        <button type="submit" disabled={loading}>
                            {loading ? '저장 중...' : '정보 업데이트'}
                        </button>
                        {!requirePasswordChange && (
                            <button type="button" onClick={onClose} disabled={loading}>닫기</button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileCompletionPopup;