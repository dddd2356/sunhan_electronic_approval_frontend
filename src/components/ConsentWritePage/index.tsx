import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, AlertCircle, Send, Loader, Trash2 } from 'lucide-react';
import Layout from '../Layout';
import {
    fetchConsentAgreement,
    submitConsentAgreement,
    ConsentAgreement
} from '../../apis/consent';

const ConsentWritePage: React.FC = () => {
    const { agreementId } = useParams<{ agreementId: string }>();
    const navigate = useNavigate();

    const [agreement, setAgreement] = useState<ConsentAgreement | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // 폼 데이터
    const [formData, setFormData] = useState<Record<string, any>>({
        agreementDate: new Date().toISOString().split('T')[0]
    });

    const [signature, setSignature] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loadingSignature, setLoadingSignature] = useState(false);
    const [hasExistingSignature, setHasExistingSignature] = useState(false); // ✅ 추가

// 서명 캔버스
    const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const saveSignatureToProfile = async () => {
        if (!signature) return;

        try {
            // Base64를 Blob으로 변환
            const base64Data = signature.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });

            // FormData 생성
            const formData = new FormData();
            formData.append('file', blob, 'signature.png');

            // API 호출
            const API_BASE = process.env.REACT_APP_API_URL || '';
            const response = await fetch(`${API_BASE}/user/me/signature`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (response.ok) {
                alert('서명이 프로필에 저장되었습니다.');
                setHasExistingSignature(true);
            } else {
                throw new Error('저장 실패');
            }
        } catch (error) {
            console.error('서명 저장 실패:', error);
            alert('서명 저장에 실패했습니다.');
        }
    };

    useEffect(() => {
        loadAgreement();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agreementId]);

    // ✅ 서명 자동 로드 추가
    useEffect(() => {
        if (agreement) {
            loadUserSignature();
        }
    }, [agreement]);

    const loadAgreement = async () => {
        try {
            const data = await fetchConsentAgreement(Number(agreementId));

            if (data.status === 'COMPLETED') {
                alert('이미 작성 완료된 동의서입니다.');
                navigate('/detail/consent/my-list');
                return;
            }

            setAgreement(data);
            initializeFormData(data.type);
        } catch (error) {
            console.error('동의서 조회 실패:', error);
            alert('동의서를 불러올 수 없습니다.');
            navigate('/detail/consent/my-list');
        } finally {
            setLoading(false);
        }
    };

    // ✅ DB 저장 서명 불러오기
    const loadUserSignature = async () => {
        setLoadingSignature(true);
        try {
            const API_BASE = process.env.REACT_APP_API_URL || '';

            // ✅ /user/me/signature 엔드포인트만 사용
            const response = await fetch(`${API_BASE}/user/me/signature`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();

                // ✅ imageUrl(signatureUrl)이 있으면 자동 설정
                if (data.imageUrl && data.imageUrl.trim() !== '') {
                    setSignature(data.imageUrl);
                    setHasExistingSignature(true);
                } else if (data.signatureUrl && data.signatureUrl.trim() !== '') {
                    setSignature(data.signatureUrl);
                    setHasExistingSignature(true);
                }
            }
        } catch (error) {
            console.log('저장된 서명 없음 (정상)');
        } finally {
            setLoadingSignature(false);
        }
    };

    const initializeFormData = (type: string) => {
        const baseData: Record<string, any> = {
            agreementDate: new Date().toISOString().split('T')[0]
        };

        switch(type) {
            case 'PRIVACY_POLICY':
                setFormData({
                    ...baseData,
                    essentialInfoAgree: '',
                    optionalInfoAgree: '',
                    uniqueIdAgree: '',
                    sensitiveInfoAgree: ''
                });
                break;
            case 'SOFTWARE_USAGE':
                setFormData(baseData);
                break;
            case 'MEDICAL_INFO_SECURITY':
                setFormData({
                    ...baseData,
                    jobType: '',
                    residentNumber: '',
                    email: ''
                });
                break;
            default:
                setFormData(baseData);
        }
    };

    // 서명 캔버스 관련
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const canvas = signatureCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
    };

    const endDrawing = () => {
        setIsDrawing(false);

        const canvas = signatureCanvasRef.current;
        if (canvas) {
            const dataUrl = canvas.toDataURL('image/png');
            setSignature(dataUrl);
        }
    };

    const clearSignature = () => {
        const canvas = signatureCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        setSignature(null);
        setHasExistingSignature(false);
    };

    // 폼 검증
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!agreement) return false;

        // 타입별 검증
        switch(agreement.type) {
            case 'PRIVACY_POLICY':
                if (!formData.essentialInfoAgree) newErrors.essentialInfoAgree = '필수적 정보 동의 여부를 선택해주세요.';
                if (!formData.optionalInfoAgree) newErrors.optionalInfoAgree = '선택적 정보 동의 여부를 선택해주세요.';
                if (!formData.uniqueIdAgree) newErrors.uniqueIdAgree = '고유식별정보 동의 여부를 선택해주세요.';
                if (!formData.sensitiveInfoAgree) newErrors.sensitiveInfoAgree = '민감정보 동의 여부를 선택해주세요.';
                break;

            case 'MEDICAL_INFO_SECURITY':
                if (!formData.jobType) newErrors.jobType = '직종을 선택해주세요.';
                if (!formData.residentNumber) newErrors.residentNumber = '주민등록번호를 입력해주세요.';
                if (!formData.email) newErrors.email = '이메일을 입력해주세요.';
                break;
        }

        // 공통 검증
        if (!formData.agreementDate) newErrors.agreementDate = '작성일을 입력해주세요.';
        if (!signature) newErrors.signature = '서명은 필수입니다.';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const removeVariablesFromHtml = (html: string): string => {
        return html
            // 개인정보 동의서 변수 제거
            .replace(/\{\{essentialInfoAgree\}\}/g, '')
            .replace(/\{\{optionalInfoAgree\}\}/g, '')
            .replace(/\{\{uniqueIdAgree\}\}/g, '')
            .replace(/\{\{sensitiveInfoAgree\}\}/g, '')
            // 의료정보 서약서 직종 변수 제거
            .replace(/\{\{jobType_doctor\}\}/g, '')
            .replace(/\{\{jobType_nurse\}\}/g, '')
            .replace(/\{\{jobType_nurseAide\}\}/g, '')
            .replace(/\{\{jobType_admin\}\}/g, '')
            .replace(/\{\{jobType_pharmacist\}\}/g, '')
            .replace(/\{\{jobType_nutritionist\}\}/g, '')
            .replace(/\{\{jobType_medTech\}\}/g, '')
            .replace(/\{\{jobType_facility\}\}/g, '')
            .replace(/\{\{jobType_reception\}\}/g, '')
            .replace(/\{\{jobType_it\}\}/g, '')
            .replace(/\{\{jobType_other\}\}/g, '')
            // 공통 변수 제거
            .replace(/\{\{date\}\}/g, '')
            .replace(/\{\{userName\}\}/g, '')
            .replace(/\{\{userId\}\}/g, '')
            .replace(/\{\{deptName\}\}/g, '')
            .replace(/\{\{phone\}\}/g, '')
            .replace(/\{\{signature\}\}/g, '')
            .replace(/\{\{residentNumber\}\}/g, '')
            .replace(/\{\{email\}\}/g, '');
    };

    // 제출 처리
    const handleSubmit = async () => {
        if (!validateForm()) {
            alert('필수 항목을 모두 입력해주세요.');
            return;
        }

        if (!window.confirm('동의서를 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.')) {
            return;
        }

        setSubmitting(true);

        try {
            const submitData = {
                formData: formData,
                signature: signature
            };

            await submitConsentAgreement(
                Number(agreementId),
                submitData
            );
            window.dispatchEvent(new Event('pendingCountsChanged'));
            alert('동의서가 제출되었습니다.');
            navigate('/detail/consent/my-list');
        } catch (error: any) {
            console.error('동의서 제출 실패:', error);
            alert(error?.response?.data?.error || '제출 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    // 렌더링 보조 함수들
    const renderPrivacyPolicyInputs = () => (
        <div className="consent-agreement-section">
            <h3 className="section-title">📋 동의 여부 선택</h3>
            <p className="section-description">
                위 동의서 내용을 확인하셨다면, 아래 각 항목에 대한 동의 여부를 선택해주세요.
            </p>

            <div className="agreement-item">
                <div className="agreement-header">
                    <span className="agreement-label">1. 필수적 정보 수집·이용 동의</span>
                    <span className="required-badge">필수</span>
                </div>
                <div className="agreement-options">
                    <label className="radio-option">
                        <input
                            type="radio"
                            name="essential"
                            checked={formData.essentialInfoAgree === 'agree'}
                            onChange={() => setFormData({...formData, essentialInfoAgree: 'agree'})}
                        />
                        <span className="radio-label">✓ 동의함</span>
                    </label>
                    <label className="radio-option">
                        <input
                            type="radio"
                            name="essential"
                            checked={formData.essentialInfoAgree === 'disagree'}
                            onChange={() => setFormData({...formData, essentialInfoAgree: 'disagree'})}
                        />
                        <span className="radio-label">✗ 동의하지 않음</span>
                    </label>
                </div>
                {errors.essentialInfoAgree && (
                    <span className="error-message">{errors.essentialInfoAgree}</span>
                )}
            </div>

            <div className="agreement-item">
                <div className="agreement-header">
                    <span className="agreement-label">2. 선택적 정보 수집·이용 동의</span>
                    <span className="required-badge">필수</span>
                </div>
                <div className="agreement-options">
                    <label className="radio-option">
                        <input
                            type="radio"
                            name="optional"
                            checked={formData.optionalInfoAgree === 'agree'}
                            onChange={() => setFormData({...formData, optionalInfoAgree: 'agree'})}
                        />
                        <span className="radio-label">✓ 동의함</span>
                    </label>
                    <label className="radio-option">
                        <input
                            type="radio"
                            name="optional"
                            checked={formData.optionalInfoAgree === 'disagree'}
                            onChange={() => setFormData({...formData, optionalInfoAgree: 'disagree'})}
                        />
                        <span className="radio-label">✗ 동의하지 않음</span>
                    </label>
                </div>
                {errors.optionalInfoAgree && (
                    <span className="error-message">{errors.optionalInfoAgree}</span>
                )}
            </div>

            <div className="agreement-item">
                <div className="agreement-header">
                    <span className="agreement-label">3. 고유식별정보 수집·이용 동의</span>
                    <span className="required-badge">필수</span>
                </div>
                <div className="agreement-description">
                    고유식별정보: 성명, 주민등록번호, 운전면허번호, 여권번호, 외국인등록번호
                </div>
                <div className="agreement-options">
                    <label className="radio-option">
                        <input
                            type="radio"
                            name="uniqueId"
                            checked={formData.uniqueIdAgree === 'agree'}
                            onChange={() => setFormData({...formData, uniqueIdAgree: 'agree'})}
                        />
                        <span className="radio-label">✓ 동의함</span>
                    </label>
                    <label className="radio-option">
                        <input
                            type="radio"
                            name="uniqueId"
                            checked={formData.uniqueIdAgree === 'disagree'}
                            onChange={() => setFormData({...formData, uniqueIdAgree: 'disagree'})}
                        />
                        <span className="radio-label">✗ 동의하지 않음</span>
                    </label>
                </div>
                {errors.uniqueIdAgree && (
                    <span className="error-message">{errors.uniqueIdAgree}</span>
                )}
            </div>

            <div className="agreement-item">
                <div className="agreement-header">
                    <span className="agreement-label">4. 민감정보 수집·이용 동의</span>
                    <span className="required-badge">필수</span>
                </div>
                <div className="agreement-description">
                    민감정보: 신체장애, 병력, 국가보훈대상, 범죄 경력
                </div>
                <div className="agreement-options">
                    <label className="radio-option">
                        <input
                            type="radio"
                            name="sensitive"
                            checked={formData.sensitiveInfoAgree === 'agree'}
                            onChange={() => setFormData({...formData, sensitiveInfoAgree: 'agree'})}
                        />
                        <span className="radio-label">✓ 동의함</span>
                    </label>
                    <label className="radio-option">
                        <input
                            type="radio"
                            name="sensitive"
                            checked={formData.sensitiveInfoAgree === 'disagree'}
                            onChange={() => setFormData({...formData, sensitiveInfoAgree: 'disagree'})}
                        />
                        <span className="radio-label">✗ 동의하지 않음</span>
                    </label>
                </div>
                {errors.sensitiveInfoAgree && (
                    <span className="error-message">{errors.sensitiveInfoAgree}</span>
                )}
            </div>
        </div>
    );

    const renderMedicalInfoInputs = () => (
        <div className="consent-agreement-section">
            <h3 className="section-title">📝 추가 정보 입력</h3>
            <p className="section-description">
                의료정보 보호 및 보안 서약서 작성을 위한 추가 정보를 입력해주세요.
            </p>

            {/* ✅ 입력 필드 (UserEntity에 없는 정보) */}
            <div style={{marginTop: '24px'}}>
                <div className="form-row">
                    <label className="form-label">
                    직종 선택 <span className="required">*</span>
                    </label>
                    <select
                        value={formData.jobType || ''}
                        onChange={(e) => setFormData({...formData, jobType: e.target.value})}
                        className={`form-select ${errors.jobType ? 'error' : ''}`}
                    >
                        <option value="">선택하세요</option>
                        <option value="의사">의사</option>
                        <option value="간호사">간호사</option>
                        <option value="간호조무사">간호조무사</option>
                        <option value="행정직">행정직</option>
                        <option value="약사">약사</option>
                        <option value="영양사">영양사</option>
                        <option value="의료기사직">의료기사직</option>
                        <option value="시설관리직">시설관리직</option>
                        <option value="원무직">원무직</option>
                        <option value="전산직">전산직</option>
                        <option value="기타직종">기타직종</option>
                    </select>
                    {errors.jobType && <span className="error-message">{errors.jobType}</span>}
                </div>

                <div className="form-row">
                    <label className="form-label">
                        주민등록번호 <span className="required">*</span>
                    </label>
                    <input
                        type="text"
                        placeholder="000000-0000000"
                        value={formData.residentNumber || ''}
                        onChange={(e) => setFormData({...formData, residentNumber: e.target.value})}
                        maxLength={14}
                        className={`form-input ${errors.residentNumber ? 'error' : ''}`}
                    />
                    <p className="field-hint">주민등록번호는 암호화되어 안전하게 저장됩니다.</p>
                    {errors.residentNumber && <span className="error-message">{errors.residentNumber}</span>}
                </div>

                <div className="form-row">
                    <label className="form-label">
                        이메일 주소 <span className="required">*</span>
                    </label>
                    <input
                        type="email"
                        placeholder="example@hospital.com"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className={`form-input ${errors.email ? 'error' : ''}`}
                    />
                    {errors.email && <span className="error-message">{errors.email}</span>}
                </div>
            </div>
        </div>
    );

    // --- 렌더링 시작 ---
    if (loading) {
        return (
            <Layout>
                <div className="loading-container">
                    <Loader className="spinner" size={48} />
                    <p>동의서를 불러오는 중...</p>
                </div>
            </Layout>
        );
    }

    if (!agreement) {
        return (
            <Layout>
                <div className="error-container">
                    <AlertCircle size={48} color="#ef4444" />
                    <p>동의서를 찾을 수 없습니다.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="consent-write-page">
                {/* 헤더 */}
                <div className="page-header">
                    <FileText size={32} className="header-icon"/>
                    <h1>{agreement.consentForm.title}</h1>
                    <p className="header-subtitle">
                        아래 내용을 확인하시고 동의 여부를 선택해주세요
                    </p>
                </div>

                {/* ✅ 읽기 전용 동의서 내용 */}
                <div className="consent-content-box">
                    <div className="content-header">
                        <span className="content-badge">📄 동의서 내용</span>
                        <span className="content-hint">아래 내용을 충분히 읽어주세요</span>
                    </div>
                    <div
                        className="consent-html-content"
                        dangerouslySetInnerHTML={{__html: removeVariablesFromHtml(agreement.consentForm.content)}}
                    />
                </div>

                {/* 타입별 동의/입력 섹션 */}
                {agreement.type === 'PRIVACY_POLICY' && renderPrivacyPolicyInputs()}
                {agreement.type === 'MEDICAL_INFO_SECURITY' && renderMedicalInfoInputs()}

                {/* 공통: 작성 정보 */}
                <div className="consent-agreement-section">
                    <h3 className="section-title">✍️ 작성자 정보</h3>

                    <div className="info-grid">
                        <div className="info-item">
                            <span className="info-label">성명</span>
                            <span className="info-value">{agreement.targetUserName}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">소속</span>
                            <span className="info-value">{agreement.deptName || '-'}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">사원번호</span>
                            <span className="info-value">{agreement.targetUserId}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">작성일</span>
                            <input
                                type="date"
                                value={formData.agreementDate || ''}
                                onChange={(e) => setFormData({...formData, agreementDate: e.target.value})}
                                className="form-input"
                            />
                        </div>
                    </div>
                </div>

                {/* 서명 */}
                <div className="consent-agreement-section">
                    <h3 className="section-title">
                        ✍️ 서명 <span className="required">*</span>
                    </h3>
                    <p className="section-description">
                        위 동의서의 내용을 충분히 숙지하였으며, 이에 동의합니다.
                    </p>

                    {loadingSignature ? (
                        <div className="signature-loading">
                            <Loader className="spinner" size={24}/>
                            <p>서명 불러오는 중...</p>
                        </div>
                    ) : signature ? (
                        // ✅ 서명이 있으면 미리보기 표시
                        <div className="signature-preview">
                            <div className="signature-header">
                <span className="signature-status">
                    <CheckCircle size={18} color="#10b981"/>
                    {hasExistingSignature ? '저장된 서명 사용 중' : '서명이 완료되었습니다'}
                </span>
                                <button
                                    onClick={clearSignature}
                                    className="btn-clear-signature"
                                >
                                    <Trash2 size={16}/>
                                    다시 작성
                                </button>
                            </div>
                            <img
                                src={signature}
                                alt="서명"
                                className="signature-image"
                            />
                        </div>
                    ) : (
                        // ✅ 서명이 없으면 캔버스 표시
                        <div className="signature-canvas-container">
                            <p className="canvas-hint">
                                ✏️ 아래 영역에 마우스로 서명을 그려주세요
                            </p>
                            <canvas
                                ref={signatureCanvasRef}
                                width={700}
                                height={150}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={endDrawing}
                                onMouseLeave={endDrawing}
                                className="signature-canvas"
                            />
                        </div>
                    )}
                    {errors.signature && <span className="error-message">{errors.signature}</span>}
                </div>

                {/* 제출 버튼 */}
                <div className="form-actions">
                    <button
                        onClick={() => navigate('/detail/consent/my-list')}
                        disabled={submitting}
                        className="btn-cancel"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="btn-submit"
                    >
                        {submitting ? (
                            <>
                                <Loader className="spinner" size={18}/>
                                제출 중...
                            </>
                        ) : (
                            <>
                                <Send size={18}/>
                                동의서 제출
                            </>
                        )}
                    </button>
                </div>

                <style>{`
                    .consent-write-page {
                        max-width: 900px;
                        margin: 0 auto;
                        padding: 24px;
                    }

                    /* 헤더 */
                    .page-header {
                        text-align: center;
                        margin-bottom: 32px;
                    }
                    .header-icon {
                        color: #3b82f6;
                        margin-bottom: 12px;
                    }
                    .page-header h1 {
                        font-size: 24px;
                        font-weight: 700;
                        color: #1f2937;
                        margin: 0 0 8px 0;
                    }
                    .header-subtitle {
                        color: #6b7280;
                        font-size: 14px;
                        margin: 0;
                    }

                    /* ✅ 읽기 전용 콘텐츠 박스 */
                    .consent-content-box {
                        background: white;
                        border: 2px solid #e5e7eb;
                        border-radius: 12px;
                        overflow: hidden;
                        margin-bottom: 32px;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }
                    .content-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 16px 20px;
                        background: #f9fafb;
                        border-bottom: 1px solid #e5e7eb;
                    }
                    .content-badge {
                        font-weight: 600;
                        color: #1f2937;
                        font-size: 15px;
                    }
                    .content-hint {
                        font-size: 13px;
                        color: #6b7280;
                    }
                    .consent-html-content {
                        padding: 24px;
                        max-height: 500px;
                        overflow-y: auto;
                        line-height: 1.7;
                    }

                    /* 동의 섹션 */
                    .consent-agreement-section {
                        background: white;
                        border: 1px solid #e5e7eb;
                        border-radius: 12px;
                        padding: 24px;
                        margin-bottom: 24px;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #1f2937;
                        margin: 0 0 8px 0;
                    }
                    .section-description {
                        font-size: 14px;
                        color: #6b7280;
                        margin: 0 0 20px 0;
                        padding: 12px;
                        background: #f9fafb;
                        border-left: 3px solid #3b82f6;
                        border-radius: 4px;
                    }

                    /* 동의 항목 */
                    .agreement-item {
                        padding: 20px;
                        background: #f9fafb;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        margin-bottom: 16px;
                    }
                    .agreement-item:last-child {
                        margin-bottom: 0;
                    }
                    .agreement-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 12px;
                    }
                    .agreement-label {
                        font-weight: 600;
                        color: #374151;
                        font-size: 15px;
                    }
                    .required-badge {
                        display: inline-block;
                        padding: 4px 10px;
                        background: #fee2e2;
                        color: #dc2626;
                        font-size: 12px;
                        font-weight: 600;
                        border-radius: 12px;
                    }
                    .agreement-description {
                        font-size: 13px;
                        color: #6b7280;
                        margin-bottom: 12px;
                        padding: 8px 12px;
                        background: white;
                        border-radius: 4px;
                    }
                    .agreement-options {
                        display: flex;
                        gap: 20px;
                    }
                    .radio-option {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        cursor: pointer;
                        padding: 10px 16px;
                        background: white;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        transition: all 0.2s;
                    }
                    .radio-option:has(input:checked) {
                        border-color: #3b82f6;
                        background: #eff6ff;
                    }
                    .radio-option input[type="radio"] {
                        width: 18px;
                        height: 18px;
                        cursor: pointer;
                    }
                    .radio-label {
                        font-size: 14px;
                        font-weight: 500;
                        color: #374151;
                    }

                    /* 폼 필드 */
                    .form-row {
                        margin-bottom: 20px;
                    }
                    .form-label {
                        display: block;
                        font-weight: 500;
                        font-size: 14px;
                        color: #374151;
                        margin-bottom: 8px;
                    }
                    .form-input,
                    .form-select {
                        width: 100%;
                        padding: 10px 14px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                        transition: all 0.2s;
                        box-sizing: border-box;
                    }
                    .form-input:focus,
                    .form-select:focus {
                        outline: none;
                        border-color: #3b82f6;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    }
                    .form-input.error,
                    .form-select.error {
                        border-color: #ef4444;
                    }

                    /* 정보 그리드 */
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 16px;
                    }
                    .info-item {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .info-label {
                        font-size: 13px;
                        color: #6b7280;
                        font-weight: 500;
                    }
                    .info-value {
                        font-size: 15px;
                        color: #1f2937;
                        font-weight: 500;
                        padding: 10px 14px;
                        background: #f9fafb;
                        border-radius: 6px;
                        border: 1px solid #e5e7eb;
                    }

                    /* 서명 */
                    .signature-preview {
                        border: 2px solid #10b981;
                        border-radius: 8px;
                        padding: 16px;
                        background: #f0fdf4;
                        display: flex;              
                        flex-direction: column;     
                        align-items: center;        
                    }
                    .signature-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 12px;
                    }
                    .signature-status {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        color: #059669;
                        font-weight: 500;
                        font-size: 14px;
                    }
                    .btn-clear-signature {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 8px 14px;
                        background: white;
                        border: 1px solid #dc2626;
                        color: #dc2626;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                        transition: all 0.2s;
                    }
                    .btn-clear-signature:hover {
                        background: #fee2e2;
                    }
                    .signature-image {
                        max-width: 100%;
                        width: 400px;
                        height: auto;
                        display: block;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        background: white;
                        margin: 0 auto;
                    }

                    .signature-canvas-container {
                        border: 2px dashed #d1d5db;
                        border-radius: 8px;
                        padding: 16px;
                        background: white;
                    }
                    .canvas-hint {
                        text-align: center;
                        color: #6b7280;
                        font-size: 14px;
                        margin: 0 0 12px 0;
                        font-weight: 500;
                    }
                    .signature-canvas {
                        border: 1px solid #e5e7eb;
                        cursor: crosshair;
                        display: block;
                        margin: 0 auto;
                        background: white;
                        border-radius: 4px;
                    }

                    /* 액션 버튼 */
                    .form-actions {
                        display: flex;
                        gap: 12px;
                        justify-content: flex-end;
                        margin-top: 32px;
                        padding-top: 24px;
                        border-top: 1px solid #e5e7eb;
                    }
                    .btn-cancel,
                    .btn-submit {
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 15px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-cancel {
                        background: white;
                        border: 1px solid #d1d5db;
                        color: #374151;
                    }
                    .btn-cancel:hover:not(:disabled) {
                        background: #f9fafb;
                    }
                    .btn-submit {
                        background: #3b82f6;
                        border: none;
                        color: white;
                    }
                    .btn-submit:hover:not(:disabled) {
                        background: #2563eb;
                    }
                    .btn-submit:disabled,
                    .btn-cancel:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }

                    /* 에러 메시지 */
                    .error-message {
                        display: block;
                        color: #ef4444;
                        font-size: 12px;
                        margin-top: 6px;
                        font-weight: 500;
                    }

                    /* 필드 힌트 */
                    .field-hint {
                        font-size: 12px;
                        color: #6b7280;
                        margin-top: 4px;
                        margin-bottom: 0;
                    }

                    /* 필수 표시 */
                    .required {
                        color: #ef4444;
                    }

                    .consent-html-content .print-only {
                         display: none !important;
                    }

                    /* 로딩/에러 */
                    .loading-container,
                    .error-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 400px;
                        gap: 16px;
                    }

                    .spinner {
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        </Layout>
    );
};

export default ConsentWritePage;