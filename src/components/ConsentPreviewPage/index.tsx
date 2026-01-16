import React, { useState } from 'react';
import { useCookies } from 'react-cookie';
import Layout from '../Layout';
import { Eye, Code, FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import './style.css';

const API_BASE = process.env.REACT_APP_API_URL || '';

interface ConsentType {
    value: string;
    label: string;
}

const CONSENT_TYPES: ConsentType[] = [
    { value: 'PRIVACY_POLICY', label: '개인정보 수집·이용 동의서' },
    { value: 'SOFTWARE_USAGE', label: '소프트웨어 사용 서약서' },
    { value: 'MEDICAL_INFO_SECURITY', label: '의료정보 보호 및 보안(교육)서약서' }
];

const ConsentPreviewPage: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);

    const [selectedType, setSelectedType] = useState<string>('PRIVACY_POLICY');
    const [htmlContent, setHtmlContent] = useState<string>('');
    const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);

    // 기본 HTML 템플릿
    const getDefaultTemplate = (type: string) => {
        switch (type) {
            case 'PRIVACY_POLICY':
                return `<div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px; line-height: 1.8;">
    <h1 style="text-align: center; margin-bottom: 30px;">개인정보 수집 및 이용·제공 동의서</h1>
    <div>선한병원은 개인정보보호법 제 15조 및 같은 법 제 22조에 근거하여 다음과 같이 채용 절차를 위한 응시자의 개인정보를 수집 및 이용하거나, 제 3자에게 제공하는데 동의를 받고자 합니다.</div>
   
    <table border="1" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tbody>
            <tr>
                <td style="padding: 10px; background-color: #f0f0f0;">목적</td>
                <td style="padding: 10px;">
                    <span>
                        채용절차의 진행 및 관리, 본인확인, 경력·자격 등 확인(조히 및 검증), 채용여부의 결정, 우선채용대상 자격 판단
                    </span>
                </td>
            </tr>
             <tr>
                <td rowspan="2" style="padding: 10px; background-color: #f0f0f0;">수집항목</td>
                <td style="padding: 10px;">
                    <div style="font-weight: bold;">·필수적 정보: 개인식별정보</div>
                    <span>성명, 주민등록번호 등 고유식별정보, 국적, 주소 및 거주지, 이메일 주소, 전화번호, 휴대폰 번호 등 연락처</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 10px;">
                    <div style="font-weight: bold;">·선택적 정보: 개인식별정보 외에 입사지원서 등에 제공한 정보</div>
                    <span>학력사항(학교명, 전공, 재학기간, 소재지, 취득학점), 외국어사항(외국어성적관련정보), 자격사항(보유 자격증 관련정보), 연구실적물, 수상경력(대회명, 대히주체, 수상내용,
                    수상일 등 관련정보), 보훈/장애 관련정보, 병역사항, 리더십 및 사회봉사활동 관련정보, 해외체류 및 교환학생 관련정보, 경력사항(회사명, 직위, 직무, 연봉 등 관련정보),
                    지원경로, 자기소개 관련정보, 기타 채용을 위해 본인이 작성한 관련정보 등
                    </span>
                </td>
            </tr>
            <tr>
                <td rowspan="2" style="padding: 10px; background-color: #f0f0f0;">보유 이용기간</td>
                <td style="padding: 10px;">
                    <div style="font-weight: bold;">·채용된 입사지원자의 개인정보: 영구보유</div>
                    <span>보유목적: 재직 중 인사관리, 복리후생, 경력증명서 발급 등</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 10px;">
                    <div style="font-weight: bold;">·채용되지 아니한 입사지원자의 개인정보: 채용절차 종료 후 1년</div>
                    <span>
                        보유목적: 추가 채용 또는 수시채용 등 향후 채용 가능 자원의 관리
                    </span>
                </td>
            </tr>
            <tr>
                <td style="padding: 10px; background-color: #f0f0f0;">동의를 거부할 권리</td>
                <td style="padding: 10px;">
                    <span>
                        위 개인정보 중 필수적 정보의 수집·이용에 관한 동의는 채용심사를 위하여 필수적이므로, 위 사항에 동의하셔야만 채용심사가 가능합니다.
                        위 개인정보 중 선택적 정보의 수집·이용에 관한 동의는 거부하실 수 있으며, 다만 동의하지 않으시는 경우 채용심사시 불이익을 받으실 수 있습니다.    
                    </span>
                </td>
            </tr>
            <tr>
                <td style="padding: 10px; background-color: #f0f0f0;">수집·이용 동의 여부</td>
                <td style="padding: 10px;">
                    <span>위와 같이 본인의 개인정보를 수집·이용하는 것에 동의합니다.</span>
                   
                    <div style="text-align: end;">
                        <strong>필수적 정보:</strong>
                        <label><input type="checkbox" name="essential_agree"> 동의함</label>
                        <label><input type="checkbox" name="essential_disagree"> 동의하지 않음</label>
                    </div>
                    <div style="text-align: end;">
                        <strong>선택적 정보:</strong>
                        <label><input type="checkbox" name="optional_agree"> 동의함</label>
                        <label><input type="checkbox" name="optional_disagree"> 동의하지 않음</label>
                    </div>
                
                </td>
            </tr>
            <tr>
                <td style="padding: 10px; background-color: #f0f0f0;">고유식별정보 동의 여부</td>
                <td style="padding: 10px;">
                    <div>
                        위 목적으로 다음과 같은 본인의 고유식별정보를 수집·이용하는 것에 동의합니다.
                    </div>
                    <div>
                        고유식별정보: 성명, 주민등록번호, 운전면허번호, 여권번호, 외국인등록번호
                    </div>
                    <div style="text-align: end;">
                        <label><input type="checkbox" name="unique_agree"> 동의함</label>
                        <label><input type="checkbox" name="unique_disagree"> 동의하지 않음</label>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="padding: 10px; background-color: #f0f0f0;">민감정보 동의 여부</td>
                <td style="padding: 10px;">
                    <div>
                        위 목적으로 다음과 같은 본인의 민감정보를 수집·이용하는 것에 동의합니다.
                    </div>
                    <div>
                        민감정보: 신체장애, 병력, 국가보훈대상, 범죄 경력
                    </div>
                    <div style="text-align: end;">
                        <label><input type="checkbox" name="unique_agree"> 동의함</label>
                        <label><input type="checkbox" name="unique_disagree"> 동의하지 않음</label>
                    </div>
                </td>
            </tr>
        </tbody>
    </table>
    
    <!-- 날짜/서명 부분 수정 -->
   <div style="margin-top: 50px; text-align: center;">
        <div style="margin-bottom: 30px;">
            <strong>작성일:</strong> {{date}}
        </div>
        <div style="margin-bottom: 20px; text-align: end;">
            <strong>성명:</strong> {{userName}}
        </div>
        <div style="text-align: end;">
            <strong>서명:</strong>
            <div style="display: inline-block; min-width: 200px; min-height: 80px; border: 1px solid #ccc; margin-left: 10px; padding: 5px;">
                {{signature}}
            </div>
        </div>
    </div>
    
    <div style="margin-top: 80px; text-align: center; font-size: 22px; font-weight: bold; letter-spacing: 12px;">
        선 한 병 원
    </div>
</div>`;

            case 'SOFTWARE_USAGE':
                return `<div style="font-family: 'Malgun Gothic', sans-serif; padding: 10px 40px; line-height: 1.6; color: #000; background: white;">
    <h1 style="text-align: center; margin-top: 20px; margin-bottom: 40px; font-size: 26px; font-weight: bold;">소프트웨어 사용 서약서</h1>
    
    <div style="margin-bottom: 15px; padding-left: 25px; text-indent: -25px;">
        1. 본인은 원내에서 사용이 허가되지 않은 불법 소프트웨어를 설치하거나 사용하지 않으며 인터넷을 통해 허가되지 않은 소프트웨어를 다운로드 또는 업로드하지 않겠습니다.
    </div>
    
    <div style="margin-bottom: 15px; padding-left: 25px; text-indent: -25px;">
        2. 원내에서 소프트웨어의 불법 사용을 인지하게되면 전산정보과에 고지해야 함을 알고 있으며 이를 이행할 것입니다.
    </div>
    
    <div style="margin-bottom: 15px; padding-left: 25px; text-indent: -25px;">
        3. 직원이 소프트웨어 불법 복제에 관련될 경우 해당 저작권법에 따라서 벌금형이나 구속 등을 포함해 민 · 형사상 처벌이나 그에 상응하는 징계를 받을 수 있음을 알고 있습니다.
    </div>
    
    <div style="margin-bottom: 15px; padding-left: 25px; text-indent: -25px;">
        4. 본인이 사용하는 PC에 대한 철저한 관리와 점검으로 불법 복제 소프트웨어 근절을 위해 최선을 다할 것입니다.
    </div>
    
    <div style="margin-bottom: 25px; padding-left: 25px; text-indent: -25px;">
        5. 부서의 공용PC는 해당 부서장에게 개인업무용 PC는 개인에게 소프트웨어 설치 및 사용의 책임이 있습니다.
    </div>
    
    <div style="margin-top: 30px; margin-bottom: 30px; color: #444; font-size: 14px;">
        ※ 본 서약서는 국제적인 소프트웨어 저작권 보호 단체인 BSA(Business Software Alliance) Korea Committee에서 권장한 소프트웨어 사용에 관한 서약서에서 발췌한 내용입니다.
    </div>
    
    <div style="margin-top: 40px; margin-bottom: 60px;">
        본인은 위의 소프트웨어 이용 지침을 분명히 이해하고 이 지침을 따를 것을 약속합니다.
    </div>
    
    <div style="margin-top: 40px;">
        <p style="text-align: center; font-size: 16px; margin-bottom: 20px;">
            작성일: {{date}}
        </p>
        <div style="text-align: right; padding-right: 10px;">
            <p style="font-size: 16px;">
                성명: {{userName}} 
                <span style="border-bottom: 2px solid #000; padding: 0 20px; display: inline-block; min-width: 100px;">{{signature}}</span>
            </p>
        </div>
    </div>
    
    <div style="margin-top: 80px; text-align: center; font-size: 22px; font-weight: bold; letter-spacing: 12px;">
        선 한 병 원
    </div>
</div>`;

            case 'MEDICAL_INFO_SECURITY':
                return `<div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px; line-height: 1.8;">
    <h1 style="text-align: center; margin-bottom: 30px;">의료정보 보호 및 보안(교육)서약서</h1>
    
    <p>
        본인은 선한병원의 의료정보 보호 및 보안을 위하여 다음의 사항을 준수하고, 직무수행 과정을 통해 알게 된 환자 개인에 관한 정보를
        진료 및 업무 목적으로만 이용하며, 불법공개나 부주의한 사용 노출로 인한 문제 발생 시 법적 처벌도 감수할 것을 서약합니다.
    </p>
    
    <div>
        <strong>1. 의료법 제19조(비밀누설금지)</strong> 의료인은 이 법이나 다른 법령에 특별히 규정된 경우 외에는 의료조산 또는 간호를 하면서 알게 된 다른 사람의 비밀을 누설하거나 발표하지 못한다. 
    </div>
    <div>
        <strong>2. 의료법 제21조의(기록 열람 등)1항</strong> 의료인이나 의료기간 종사자는 환자가 아닌 다른 사람에게 환자에 관한 기록을 열람하게 하거나 그 사본은 내주는 등의 내용을 확인할 수 있게 하여서는 아니된다.
    </div>
    <div>
        <strong>3. 의료법 제23조의(전자의무기록)3항</strong> 누구든지 정당한 사유 없이 전자의무기록에 저장된 개인정보를 유출하거나 누출 · 변조 또는 훼손하여서는 아니 된다.
    </div>
    <div>
        4. 병원 내의 모든 의료정보와 의료자원은 병원 당국이 본인에게 부여한 사용권한 내에서만 접근 및 사용하며, 허락 받은 사용 목적과 용도로만 사용하여야 한다.
    </div>
    <div>
        5. 병원 내의 모든 의료정보와 의료자원은 업무이외의 다른 목적으로 이용될 수 없다. 
    </div>
    <div>
        6. 병원 내의 모든 의료정보와 의료자원의 사용권을 소유하고 있는 자는 책임있고 윤리적인 태도로 사용권을 행사하여야 한다.
    </div>
    <div>
        7. 인가 받은 사용자는 비인가자의 불법적 사용을 막기 위해 개인 비밀번호관리에 주의를 기울이며, 자신의 ID에서의 모든 사용에 대한 책임을 져야 한다.
    </div>
    
    <p style="font-weight: bold;">본인은 의료정보보호 및 보안 서약서 내용을 숙지하고, 책임과 권한 이용에 관한 사항을 준수할 것을 약속합니다.</p>
    
    <div style="font-weight: bold;">
        정보보호 및 정보보안 정책
    </div>
    <div>
        1. 정당한 사유 없이 영상의무기록에 저장된 개인정보를탐지하거나, 누출 · 변조 또는 훼손하지 않는다. 
    </div>
    <div>
        2. 공개된 장소에서 환자 개인정보를 대화하지 않는다.
    </div>
        3. 환자 개인신상 정보가 모니터상에서 노출되지 않도록 자리를 이탈할 경우 Log-out한다.
    <div>
        4. 공개된 장소 게시물에 환자성명, 주민등록번호 및 진단명을 함께 게시하지 않는다.
    </div>
    <div>
        5. 환자의 개인정보 보호 요청에 적극 대응하며 신속하게 처리한다.
    </div>
    <div>
        <table border="1" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tbody>
                <tr>
                    <td style="padding: 10px; background-color: #f0f0f0; width: 15%;">직종</td>
                    <td style="padding: 10px;" colspan="3">
                        <label><input type="checkbox" name="job_doctor"> 의사</label>
                        <label><input type="checkbox" name="job_nurse"> 간호사</label>
                        <label><input type="checkbox" name="job_nursing_aide"> 간호조무사</label>
                        <label><input type="checkbox" name="job_admin"> 행정직</label>
                        <label><input type="checkbox" name="job_pharmacist"> 약사</label>
                        <label><input type="checkbox" name="job_nutritionist"> 영양사</label>
                        <label><input type="checkbox" name="job_medical_tech"> 의료기사직</label>
                        <label><input type="checkbox" name="job_facility"> 시설관리직</label>
                        <label><input type="checkbox" name="job_reception"> 원무직</label>
                        <label><input type="checkbox" name="job_it"> 전산직</label>
                        <label><input type="checkbox" name="job_other"> 기타직종</label>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px; background-color: #f0f0f0;">소속부서</td>
                    <td style="padding: 10px;">{{deptName}}</td>
                    <td style="padding: 10px; background-color: #f0f0f0;">사원번호</td>
                    <td style="padding: 10px;">{{userId}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; background-color: #f0f0f0;">성명</td>
                    <td style="padding: 10px;">{{userName}}</td>
                    <td style="padding: 10px; background-color: #f0f0f0;">주민등록번호</td>
                    <td style="padding: 10px;">
                        <input type="text" name="residentNumber" placeholder="000000-0000000" style="border: none; border-bottom: 1px solid #000; width: 100%;">
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px; background-color: #f0f0f0;">연락처</td>
                    <td style="padding: 10px;">{{phone}}</td>
                    <td style="padding: 10px; background-color: #f0f0f0;">E-mail 주소</td>
                    <td style="padding: 10px;">
                        <input type="text" name="email" placeholder="email@example.com" style="border: none; border-bottom: 1px solid #000; width: 100%;">
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    
  <!-- 날짜/서명 부분 수정 -->
   <div style="margin-top: 40px;">
        <p style="text-align: center; font-size: 16px; margin-bottom: 20px;">
            작성일: {{date}}
        </p>
        <div style="text-align: right; padding-right: 10px;">
            <p style="font-size: 16px;">
                성명: {{userName}} 
                <span style="border-bottom: 2px solid #000; padding: 0 20px; display: inline-block; min-width: 100px;">{{signature}}</span>
            </p>
        </div>
    </div>
    <div style="margin-top: 80px; text-align: center; font-size: 22px; font-weight: bold; letter-spacing: 12px;">
        선 한 병 원
    </div>
</div>`;

            default:
                return '';
        }
    };

    // HTML 유효성 검사
    const validateHtml = (html: string): { valid: boolean; message: string } => {
        if (!html.trim()) {
            return { valid: false, message: 'HTML 내용이 비어있습니다.' };
        }

        // 필수 변수 체크 - date와 signature 포함
        const requiredVars = ['{{userName}}', '{{date}}', '{{signature}}'];
        const missingVars = requiredVars.filter(v => !html.includes(v));

        if (missingVars.length > 0) {
            return {
                valid: false,
                message: `필수 변수가 누락되었습니다: ${missingVars.join(', ')}`
            };
        }

        // 기본 HTML 구조 체크
        const hasOpeningDiv = html.includes('<div');
        const hasClosingDiv = html.includes('</div>');

        if (!hasOpeningDiv || !hasClosingDiv) {
            return { valid: false, message: 'HTML 구조가 올바르지 않습니다. <div> 태그를 확인하세요.' };
        }

        return { valid: true, message: 'HTML이 올바르게 작성되었습니다.' };
    };

    // 템플릿 로드
    const handleLoadTemplate = () => {
        const template = getDefaultTemplate(selectedType);
        setHtmlContent(template);
        setValidationResult(null);
    };

    // 미리보기 데이터 생성
    const getPreviewHtml = () => {
        let preview = htmlContent;

        // 변수 치환 (예시 데이터)
        preview = preview.replace(/\{\{userName\}\}/g, '홍길동');
        preview = preview.replace(/\{\{userId\}\}/g, 'test123');
        preview = preview.replace(/\{\{deptName\}\}/g, '정형외과');
        preview = preview.replace(/\{\{phone\}\}/g, '010-1234-5678');
        preview = preview.replace(/\{\{date\}\}/g, new Date().toLocaleDateString('ko-KR'));
        // ✅ 서명을 이미지로 변환 (예시)
        const signatureImg = '<img src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'60\'%3E%3Ctext x=\'10\' y=\'40\' font-family=\'Arial\' font-size=\'24\' fill=\'%23000\'%3E홍길동%3C/text%3E%3C/svg%3E" style="max-width: 180px; height: auto;" />';
        preview = preview.replace(/\{\{signature\}\}/g, signatureImg);
        preview = preview.replace(/\{\{signature\}\}/g, '홍길동');
        preview = preview.replace(/\{\{residentNumber\}\}/g, '123456-1234567');
        preview = preview.replace(/\{\{email\}\}/g, 'hong@example.com');

        return preview;
    };

    // 유효성 검사 실행
    const handleValidate = () => {
        const result = validateHtml(htmlContent);
        setValidationResult(result);
    };

    // PDF 테스트 생성
    const handleTestPdf = async () => {
        const validation = validateHtml(htmlContent);
        if (!validation.valid) {
            alert(validation.message);
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 실제 API 호출 (백엔드에 테스트 엔드포인트 필요)
            const response = await fetch(`${API_BASE}/consents/test-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${cookies.accessToken}`
                },
                body: JSON.stringify({
                    htmlContent,
                    type: selectedType
                })
            });

            if (!response.ok) throw new Error('PDF 생성 실패');

            // PDF 다운로드
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `test_consent_${selectedType}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // HTML 복사
    const handleCopyHtml = () => {
        navigator.clipboard.writeText(htmlContent);
        alert('HTML이 클립보드에 복사되었습니다.');
    };

    return (
        <Layout>
            <div className="consent-preview-page">
                <div className="preview-header">
                    <div>
                        <h1>동의서 템플릿 미리보기</h1>
                        <p className="preview-subtitle">
                            HTML 템플릿을 작성하고 실시간으로 미리보기할 수 있습니다
                        </p>
                    </div>
                </div>

                {/* 컨트롤 바 */}
                <div className="preview-controls">
                    <div className="control-group">
                        <label>동의서 타입</label>
                        <select
                            value={selectedType}
                            onChange={(e) => {
                                setSelectedType(e.target.value);
                                setValidationResult(null);
                            }}
                        >
                            {CONSENT_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button onClick={handleLoadTemplate} className="btn-secondary">
                        <FileText size={16} />
                        템플릿 불러오기
                    </button>

                    <button onClick={handleValidate} className="btn-secondary">
                        <CheckCircle size={16} />
                        유효성 검사
                    </button>

                    <button onClick={handleCopyHtml} className="btn-secondary" disabled={!htmlContent}>
                        <Code size={16} />
                        HTML 복사
                    </button>

                    <button
                        onClick={handleTestPdf}
                        className="btn-primary"
                        disabled={loading || !htmlContent}
                    >
                        <Download size={16} />
                        {loading ? 'PDF 생성 중...' : 'PDF 테스트'}
                    </button>
                </div>

                {/* 유효성 검사 결과 */}
                {validationResult && (
                    <div className={`validation-result ${validationResult.valid ? 'valid' : 'invalid'}`}>
                        {validationResult.valid ? (
                            <CheckCircle size={20} />
                        ) : (
                            <AlertCircle size={20} />
                        )}
                        <span>{validationResult.message}</span>
                    </div>
                )}

                {error && (
                    <div className="error-message">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                {/* 뷰 모드 전환 */}
                <div className="view-mode-toggle">
                    <button
                        className={viewMode === 'preview' ? 'active' : ''}
                        onClick={() => setViewMode('preview')}
                    >
                        <Eye size={16} />
                        미리보기
                    </button>
                    <button
                        className={viewMode === 'code' ? 'active' : ''}
                        onClick={() => setViewMode('code')}
                    >
                        <Code size={16} />
                        HTML 편집
                    </button>
                </div>

                {/* 메인 컨텐츠 */}
                <div className="preview-content-wrapper">
                    {viewMode === 'code' ? (
                        <div className="code-editor-section">
                            <div className="editor-header">
                                <h3>HTML 편집</h3>
                                <p className="editor-hint">
                                    사용 가능한 변수:
                                    <code>{'{{userName}}'}</code>,
                                    <code>{'{{userId}}'}</code>,
                                    <code>{'{{date}}'}</code>,
                                    <code>{'{{signature}}'}</code>
                                    {selectedType === 'PRIVACY_POLICY' && <>, <code>{'{{residentNumber}}'}</code></>}
                                    {selectedType === 'SOFTWARE_USAGE' && <>, <code>{'{{deviceSerial}}'}</code></>}
                                </p>
                            </div>
                            <textarea
                                value={htmlContent}
                                onChange={(e) => {
                                    setHtmlContent(e.target.value);
                                    setValidationResult(null);
                                }}
                                placeholder="HTML 내용을 입력하세요..."
                                className="html-editor"
                            />
                        </div>
                    ) : (
                        <div className="preview-section">
                            <div className="preview-header-bar">
                                <h3>미리보기</h3>
                                <span className="preview-note">
                                    * 실제 데이터는 예시 값으로 표시됩니다
                                </span>
                            </div>
                            <div className="preview-frame">
                                {htmlContent ? (
                                    <div
                                        className="preview-content"
                                        dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                                    />
                                ) : (
                                    <div className="preview-empty">
                                        <FileText size={64} />
                                        <p>템플릿을 불러오거나 HTML을 입력해주세요</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 도움말 */}
                <div className="preview-help-section">
                    <h3>사용 가이드</h3>
                    <ul>
                        <li>동의서 타입을 선택하고 "템플릿 불러오기"를 클릭하면 기본 템플릿이 로드됩니다.</li>
                        <li>HTML 편집 모드에서 자유롭게 수정할 수 있습니다.</li>
                        <li>변수는 이중 중괄호로 감싸야 합니다 (예: <code>{'{{userName}}'}</code>)</li>
                        <li>"유효성 검사"로 필수 변수 누락 여부를 확인하세요.</li>
                        <li>"PDF 테스트"로 실제 PDF 생성 결과를 확인할 수 있습니다.</li>
                        <li>완성된 HTML은 복사하여 데이터베이스에 직접 입력할 수 있습니다.</li>
                    </ul>
                </div>
            </div>
        </Layout>
    );
};

export default ConsentPreviewPage;