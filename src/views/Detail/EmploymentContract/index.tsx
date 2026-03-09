import React, {ChangeEvent, useCallback, useEffect, useRef, useState} from 'react';
import {useCookies} from "react-cookie";
import {SignatureState} from '../../../types/signature';
import './style.css';
import {useNavigate, useParams, useSearchParams} from "react-router-dom";
import Layout from "../../../components/Layout";
import {
    returnToAdmin, sendContract, signContract, updateContract,
    fetchContract, fetchCurrentUser, fetchUserSignature, downloadContract, deleteContract, rejectCompletedContract
} from "../../../apis/contract";
import RejectModal from "../../../components/RejectModal";
import CeoDirectorSignImage from './assets/images/선한병원직인.png';
import { Document, Page, pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
interface PageData {
    id: number;
    title: string;
    content: React.ReactNode;
}

interface User {
    id: string;
    name: string;
    jobLevel: string; // 0: 직원, 1 : 부서장, 2: 센터장, 3:원장, 4 : 행정원장, 5 : 대표원장, 6 : Admin
    role: string;
    userId?: string;
    userName?: string;
    deptCode?: string;
    jobType?: string;
    phone?: string | null;
    address?: string | null;
    detailAddress?: string | null;
    permissions?: string[];
}

interface Contract {
    id: number;
    creatorId: string;
    employeeId: string;
    status: string;
    formDataJson: string;
    pdfUrl?: string;
    jpgUrl?: string;
    createdAt: string;
    updatedAt: string;
    employeeName?: string;
    creatorName?: string;
    rejectionReason?: string;
}

interface FormDataFields {
    contractTitle: string;
    employerName: string;
    employerAddress: string;
    employerPhone: string;
    employeeName: string;
    employeeAddress: string;
    employeePhone: string;
    employeeSSN: string;
    startDate: string;
    contractDate: string;
    conditionApplyDate: string;
    salaryContractDate: string;
    workTimeList: string[];
    breakTimeList: string[];
    workingHours: string;
    salaryMonths: string;
    totalAnnualSalary: string;
    basicSalary: string;
    positionAllowance: string;
    licenseAllowance: string;
    hazardPay: string;
    treatmentImprovementExpenses: string;
    adjustmentAllowance: string;
    overtime:string;
    nDuty:string;
    overtimePay: string;
    nDutyAllowance: string;
    overtimeDescription: string;  // 연장/야간근로 설명
    dutyDescription: string;      // 의무나이트 설명
    regularHourlyWage: string;
    employmentOccupation: string;
    dutyNight: string;
    receiptConfirmation1: string;
    receiptConfirmation2: string;
    employeeSignatureUrl?: string;
    ceoSignatureUrl?: string;  // 추가
    ceoName?: string;          // 추가
    contractSignDate: string;
}


const EmploymentContract = () => {
    const {id} = useParams<{ id: string }>();
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;
    const [contract, setContract] = useState<Contract | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const navigate = useNavigate();
    const [userSignatureImage, setUserSignatureImage] = useState<string | null>(null);
    const addressTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchParams] = useSearchParams();
    const loadFromId = searchParams.get('loadFrom');
    const [formData, setFormData] = useState<FormDataFields>({
        contractTitle: '',
        employerName: '',
        employerAddress: '',
        employerPhone: '',
        employeeName: '',
        employeeAddress: '',
        employeePhone: '',
        employeeSSN: '',
        startDate: '',
        contractDate: '',
        conditionApplyDate: '',
        salaryContractDate: '',
        workTimeList: ['', '', ''],
        breakTimeList: ['', '', '', ''],
        workingHours: '209',
        salaryMonths: '12',
        totalAnnualSalary: '',
        basicSalary: '',
        positionAllowance: '',
        licenseAllowance: '',
        hazardPay: '',
        treatmentImprovementExpenses: '',
        adjustmentAllowance: '',
        overtime:'',
        nDuty:'',
        overtimePay: '',
        nDutyAllowance: '',
        overtimeDescription: '',
        dutyDescription: '',
        regularHourlyWage: '',
        employmentOccupation: '',
        dutyNight: '',
        receiptConfirmation1: '',
        receiptConfirmation2: '',
        employeeSignatureUrl: '', // 서명 이미지 URL 초기값
        ceoSignatureUrl: '',  // 추가
        ceoName: '',           // 추가
        contractSignDate: '',
    });
    const isDraft = status === 'DRAFT'; //DRAFT에서만 수정할 수 있도록하기
    // 모달용 state
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [viewRejectReasonModalOpen, setViewRejectReasonModalOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [currentPage, setCurrentPage] = useState<number>(0);
    const [isAnimating, setIsAnimating] = useState<boolean>(false);
    const [agreements, setAgreements] = useState<{ [page: string]: 'agree' | 'disagree' | '' }>({
        page1: '',
        page4: '',
    });
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [signatures, setSignatures] = useState<SignatureState>({
        page1: [{text: '', imageUrl: undefined, isSigned: false}],
        page2: [{text: '', imageUrl: undefined, isSigned: false}],
        page3: [{text: '', imageUrl: undefined, isSigned: false}],
        // 새로운 키들 추가
        page4_consent: [{text: '', imageUrl: undefined, isSigned: false}],
        page4_receipt: [{text: '', imageUrl: undefined, isSigned: false}],
        page4_final: [{text: '', imageUrl: undefined, isSigned: false}],
    });

    //목록으로 이동
    const goToList = () => {
        navigate("/detail/employment-contract"); // 목록 페이지 경로에 맞게 수정
    };

// handleSave: 임시저장 함수 수정
    const handleSave = useCallback(async () => {
        if (!contract || !id) return;

        // 저장할 모든 데이터를 하나의 객체로 통합
        const saveData = {
            ...formData,
            signatures: signatures || {}, // 안전한 기본값 제공
            agreements: agreements || {}, // 안전한 기본값 제공
        };

        try {
            // updateContract API는 ID와 저장할 데이터 객체를 인자로 받도록 구현해야 합니다.
            // 이 API는 내부적으로 데이터를 JSON 문자열로 변환하여 서버에 보냅니다.
            // 🚨 updateContract는 apis/contract.ts에서 AxiosResponse 전체를 반환하도록 되어 있어야 합니다.
            const response = await updateContract(parseInt(id), saveData, token);

            // 🚨 응답 상태 코드를 확인하여 성공 여부를 판단합니다 (200-299가 성공 범위).
            if (response.status >= 200 && response.status < 300) {
                alert('임시저장 되었습니다.');
                // 🚨 실제 데이터는 response.data에 있습니다. setContract(response.data)로 수정합니다.
                const updatedContractData: Contract = response.data; // 타입 캐스팅 (Contract 인터페이스와 백엔드 DTO가 일치해야 함)
                setContract(updatedContractData);

                // 🚨 저장 후 서버로부터 받은 최신 데이터(response.data)로 프론트엔드 상태 업데이트
                // response.formDataJson -> response.data.formDataJson으로 수정합니다.
                const responseData = JSON.parse(updatedContractData.formDataJson);
                setFormData(responseData);
                if (responseData.signatures) setSignatures(responseData.signatures);
                if (responseData.agreements) setAgreements(responseData.agreements);
                navigate("/detail/employment-contract");
            } else {
                // 서버에서 성공 응답(2xx)이 아닌 다른 상태 코드를 보낸 경우
                throw new Error(`저장 중 오류가 발생했습니다: 상태 코드 ${response.status}`);
            }
        } catch (error: unknown) { // 🚨 error 타입을 unknown으로 명시 (TS18046 해결)
            console.error('Failed to save contract:', error);
            let errorMessage = '알 수 없는 오류';
            // 에러 객체의 타입을 안전하게 확인하여 메시지 추출
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null && 'response' in error && typeof (error as any).response === 'object' && (error as any).response !== null && 'data' in (error as any).response && typeof ((error as any).response as any).data === 'object' && ((error as any).response as any).data !== null && 'message' in ((error as any).response as any).data) {
                // AxiosError의 경우 (error.response.data.message)
                errorMessage = String(((error as any).response as any).data.message);
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            alert(`저장 중 오류가 발생했습니다: ${errorMessage}`);
        }
    }, [id, contract, formData, signatures, agreements, token, navigate, setContract, setFormData, setSignatures, setAgreements]); // 의존성 배열에 모든 외부 변수 포함

    // 모든 페이지에 대해 최소 한 개의 서명이 있고, 필수 동의가 'agree'인지 확인
    const validateAllSignedAndAgreed = (): boolean => {
        // 1) 서명 검사
        // page1~3 검사
        for (const pageKey of ['page1', 'page2', 'page3']) {
            if (!signatures[pageKey] || !signatures[pageKey].some(sig => sig.isSigned)) {
                alert(`'${pageKey}' 페이지에 서명이 필요합니다.`);
                return false;  // 이제 제대로 작동!
            }
        }

        // page4 서명 3개 검사
        const page4Sigs = ['page4_consent', 'page4_receipt', 'page4_final'];
        for (const sigKey of page4Sigs) {
            if (!signatures[sigKey] || !signatures[sigKey].some(sig => sig.isSigned)) {
                alert(`page4 페이지에 서명이 필요합니다.`);
                return false;
            }
        }

        // 2) 동의 검사
        for (const [page, status] of Object.entries(agreements)) {
            if (status !== 'agree') {
                alert(`'${page}' 페이지의 동의 체크박스를 선택해주세요.`);
                return false;
            }
        }

        // 3) 근로계약서 교부 확인 검사
        if (formData.receiptConfirmation1 !== '교부') {
            alert('근로계약서 교부 확인란에 "교부"를 정확히 입력해주세요.');
            return false;
        }

        if (formData.receiptConfirmation2 !== '확인') {
            alert('근로계약서 교부 확인란에 "확인"을 정확히 입력해주세요.');
            return false;
        }

        return true;
    };

    const handleDelete = useCallback(async () => {
        if (!contract || !id) return;

        // 삭제 확인 다이얼로그
        const isConfirmed = window.confirm('정말로 이 근로계약서를 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.');

        if (!isConfirmed) return;

        try {
            const response = await deleteContract(parseInt(id), token);

            if (response.status >= 200 && response.status < 300) {
                alert('근로계약서가 성공적으로 삭제되었습니다.');
                navigate('/detail/employment-contract'); // 목록 페이지로 이동
            } else {
                throw new Error(`삭제 실패 (상태 코드: ${response.status})`);
            }
        } catch (error: unknown) {
            console.error('근로계약서 삭제 실패:', error);

            let errorMessage = '알 수 없는 오류';

            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null && 'response' in error) {
                const axiosError = error as any;
                if (axiosError.response?.data?.error) {
                    errorMessage = axiosError.response.data.error;
                } else if (axiosError.response?.status === 404) {
                    errorMessage = '근로계약서를 찾을 수 없습니다.';
                } else if (axiosError.response?.status === 400) {
                    errorMessage = '삭제할 수 없는 상태입니다. (작성중 상태만 삭제 가능)';
                } else if (axiosError.response?.status === 403) {
                    errorMessage = '삭제 권한이 없습니다.';
                }
            }

            alert(`근로계약서 삭제 중 오류가 발생했습니다: ${errorMessage}`);
        }
    }, [contract, id, token, navigate]);


    // 반려 버튼 클릭 시 모달 열기
    const handleRejectClick = () => {
        setRejectModalOpen(true);
    };

    useEffect(() => {
        const textarea = addressTextareaRef.current;
        if (textarea && formData.employeeAddress !== undefined) {
            // 높이를 초기화하고 다시 계산
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    }, [formData.employeeAddress, currentPage]); // employeeAddress가 변경될 때마다 실행

    // 배열 필드 변경 핸들러
    const handleArrayInputChange = useCallback((
        fieldName: 'workTimeList' | 'breakTimeList',
        index: number,
        value: string
    ) => {
        setFormData(prev => {
            const newArray = [...prev[fieldName]];
            newArray[index] = value;
            return { ...prev, [fieldName]: newArray };
        });
    }, []);

// 엔터 키 핸들러 (새 줄 추가)
    const handleArrayInputKeyDown = useCallback((
        e: React.KeyboardEvent<HTMLInputElement>,
        fieldName: 'workTimeList' | 'breakTimeList',
        index: number
    ) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setFormData(prev => {
                const newArray = [...prev[fieldName]];
                newArray.splice(index + 1, 0, '');  // 현재 위치 다음에 빈 줄 추가
                return { ...prev, [fieldName]: newArray };
            });

            // 다음 input으로 포커스 이동
            setTimeout(() => {
                const inputs = document.querySelectorAll(`input[name="${fieldName}"]`);
                if (inputs[index + 1]) {
                    (inputs[index + 1] as HTMLInputElement).focus();
                }
            }, 0);
        } else if (e.key === 'Backspace' && formData[fieldName][index] === '' && formData[fieldName].length > 1) {
            e.preventDefault();
            setFormData(prev => {
                const newArray = [...prev[fieldName]];
                newArray.splice(index, 1);  // 현재 줄 삭제
                return { ...prev, [fieldName]: newArray };
            });
            // 이전 input으로 포커스 이동
            setTimeout(() => {
                const inputs = document.querySelectorAll(`input[name="${fieldName}"]`);
                if (inputs[index - 1]) {
                    (inputs[index - 1] as HTMLInputElement).focus();
                }
            }, 0);
        }
    }, [formData]);

    // ① 관리자 전송
    const handleInitialSend = async () => {
        if (!contract) return;
        try {
            // 🚨 1. 폼 데이터 저장을 다시 추가합니다. 이전에 누락되었습니다.
            const saveResponse = await updateContract(contract.id, formData, token);

            if (saveResponse.status < 200 || saveResponse.status >= 300) {
                throw new Error('폼 데이터 저장 실패 (상태 코드: ' + saveResponse.status + ')');
            }

            // 🚨 2. 데이터 저장이 성공하면, 계약서 상태를 변경하여 직원에게 보냅니다.
            const sendResponse = await sendContract(contract.id, token);

            if (sendResponse.status >= 200 && sendResponse.status < 300) {
                const updatedContract: Contract = sendResponse.data; // 🚨 .data 사용 및 타입 명시 (TS2345 해결)
                setContract(updatedContract);
                setStatus(updatedContract.status);
                alert('계약서가 성공적으로 전송되었습니다.');
                navigate('/detail/employment-contract');
            } else {
                throw new Error('계약서 전송 실패 (상태 코드: ' + sendResponse.status + ')');
            }
        } catch (error: unknown) { // 🚨 error 타입을 unknown으로 명시 (TS18046 해결)
            console.error('계약서 전송 처리 중 오류 발생:', error);
            let errorMessage = '알 수 없는 오류';
            if (error instanceof Error) { // 타입 가드
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
                errorMessage = String((error as { message: unknown }).message);
            }
            alert(`계약서 전송에 실패했습니다: ${errorMessage}`);
        }
    };

// ② 직원 승인 (서명 + 승인을 한번에 처리)
    const handleApprove = useCallback(async () => {
        if (!contract || !id) return;

        if (!validateAllSignedAndAgreed()) {
            return;
        }

        // ✅ 중복 호출 방지
        if (isSubmitting) {
            console.warn('이미 제출 중입니다.');
            return;
        }
        setIsSubmitting(true);

        try {
            // 🚨 이 부분이 핵심입니다! 현재의 signatures와 agreements 상태를 formData에 통합해야 합니다.
            // formData는 일반 텍스트 입력 필드를, signatures는 서명 데이터를, agreements는 체크박스 동의를 담고 있다고 가정합니다.
            const payloadData = {
                ...formData,    // 기존의 폼 데이터 필드들 (ex: 고용주 이름, 주소 등)
                signatures,     // 현재 서명 상태 객체
                agreements      // 현재 동의 체크박스 상태 객체
            };

            // signContract 함수는 payloadData를 formDataJson으로 직렬화하여 보냅니다.
            const response = await signContract(parseInt(id), payloadData, token);

            if (response.status >= 200 && response.status < 300) {
                const completed: Contract = response.data; // 서버에서 반환된 최신 계약서 데이터
                setContract(completed); // 전체 계약서 객체 업데이트

                // 🚨 중요: 서버에서 반환된 completed.formDataJson으로 프론트엔드 상태를 다시 초기화합니다.
                // 이로써 서버에 저장된 signatures와 agreements가 UI에 반영됩니다.
                const parsedFormData = JSON.parse(completed.formDataJson);
                setFormData(parsedFormData); // 새로운 폼 데이터 전체를 설정 (텍스트 필드 포함)

                // parsedFormData 안에 signatures와 agreements가 있다면 각각의 상태를 업데이트
                if (parsedFormData.signatures) {
                    setSignatures(parsedFormData.signatures);
                }
                if (parsedFormData.agreements) {
                    setAgreements(parsedFormData.agreements);
                }

                alert('계약서가 승인되어 완료 처리되었습니다.');
                navigate('/detail/employment-contract');
            } else {
                throw new Error('승인 처리 실패 (상태 코드: ' + response.status + ')');
            }
        } catch (error: unknown) {
            console.error('승인 처리 실패:', error);
            let errorMessage = '알 수 없는 오류';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null && 'response' in error && typeof (error as any).response === 'object' && (error as any).response !== null && 'data' in (error as any).response && typeof ((error as any).response as any).data === 'object' && ((error as any).response as any).data !== null && 'message' in ((error as any).response as any).data) {
                errorMessage = String(((error as any).response as any).data.message);
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            alert(`계약서 승인 중 오류가 발생했습니다: ${errorMessage}`);
        }
        finally {
            setIsSubmitting(false);
        }
    }, [id, contract, formData, signatures, agreements, token, navigate, setContract, setFormData, setSignatures, setAgreements]); // 의존성 배열 확인

// ③ 반려 사유 제출
    const handleRejectSubmit = async (reason: string) => {
        if (!contract || !reason.trim()) {
            alert('반려 사유를 입력해주세요.');
            return;
        }

        try {
            // 🚨 returnToAdmin 헬퍼 함수를 사용하도록 변경하고, 응답 처리 방식 수정
            let response;
            if (status === 'COMPLETED') {
                response = await rejectCompletedContract(contract.id, reason, token);
            } else {
                response = await returnToAdmin(contract.id, reason, token);
            }
            if (response.status >= 200 && response.status < 300) {
                const updated: Contract = response.data; // 🚨 .data 사용 및 타입 명시
                setContract(updated);
                setRejectModalOpen(false);
                alert('계약서가 반려되었습니다.');
                navigate('/detail/employment-contract'); // 목록으로 이동
            } else {
                throw new Error('반려 처리 실패 (상태 코드: ' + response.status + ')');
            }
        } catch (error: unknown) { // 🚨 error 타입을 unknown으로 명시 (TS18046 해결)
            console.error('반려 처리 실패:', error);
            let errorMessage = '알 수 없는 오류';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
                errorMessage = String((error as { message: unknown }).message);
            }
            alert(`반려 처리 중 오류가 발생했습니다: ${errorMessage}`);
        }
    };

    // 사용자 정보 가져오기
    useEffect(() => {
        const loadUserInfo = async () => {
            try {
                const userData = await fetchCurrentUser(token);
                setCurrentUser(userData);
            } catch (error) {
                console.error("사용자 정보 가져오기 실패", error);
            }
        };

        if (token) {
            loadUserInfo();
        }
    }, [token]);

    const formatSSN = (value: string): string => {
        // 숫자만 추출
        const numbersOnly = value.replace(/[^\d]/g, '');

        // 최대 13자리까지만 허용
        const limitedNumbers = numbersOnly.slice(0, 13);

        // 6자리-7자리 형식으로 포맷팅
        if (limitedNumbers.length <= 6) {
            return limitedNumbers;
        } else {
            return `${limitedNumbers.slice(0, 6)}-${limitedNumbers.slice(6)}`;
        }
    };

    const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const {name, value} = e.target;
        // 주민등록번호 필드인 경우 포맷팅 적용
        const formattedValue = name === 'employeeSSN' ? formatSSN(value) : value;

        if (name === 'employeeAddress' && e.target instanceof HTMLTextAreaElement) {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
        }

        setFormData((prevData: FormDataFields) => { // prevData에 타입 적용
            const updatedData = {...prevData, [name]: formattedValue};
            setContract((prevContract: Contract | null) => { // prevContract에 타입 적용
                if (!prevContract) return null;
                return {
                    ...prevContract,
                    formDataJson: JSON.stringify(updatedData), // JSON 문자열로 변환하여 formDataJson에 저장
                };
            });
            return updatedData;
        });
    }, []);

    const handleAgreementChange = (page: string, newStatus: 'agree' | 'disagree' | '') => {
        if (status !== 'SENT_TO_EMPLOYEE') return;
        // 체크박스 누를 때마다 확인창 띄우기 (체크 해제할 때는 확인창 생략)
        if (newStatus === 'agree') {
            const confirmed = window.confirm('동의하시겠습니까?');
            if (!confirmed) {
                // 사용자가 취소하면 상태를 변경하지 않고 리턴
                return;
            }
        }
        setAgreements(prev => ({...prev, [page]: newStatus}));
    };

    // 사용자 서명 가져오는 함수
    const fetchUserSignatureData = async (): Promise<string | undefined> => {
        try {
            const signatureData = await fetchUserSignature(token);
            const signatureUrl = signatureData.imageUrl || signatureData.signatureUrl;
            setUserSignatureImage(signatureUrl || null);
            return signatureUrl || undefined;
        } catch (error) {
            console.error('서명 이미지 조회 실패:', error);
            return undefined;
        }
    };

    // useEffect로 컴포넌트 로드 시 서명 가져오기
    useEffect(() => {
        if (token) {
            fetchUserSignatureData();
        }
    }, [token]);

    // 수정된 handleSignatureClick 함수
    const handleSignatureClick = (page: string, idx: number) => async () => {
        const currentSignature = signatures[page][idx];
        if (status !== 'SENT_TO_EMPLOYEE') return;

        if (currentSignature.isSigned) {
            // 이미 서명된 경우 - 삭제 확인
            if (window.confirm('서명을 취소하시겠습니까?')) {
                setSignatures(prev => ({
                    ...prev,
                    [page]: prev[page].map((sig, i) =>
                        i === idx
                            ? {text: formData.employeeName, imageUrl: undefined, isSigned: false}
                            : sig
                    )
                }));
            }
        } else {
            // 서명되지 않은 경우 - 서명 확인
            if (window.confirm('서명하시겠습니까?')) {
                // DB에서 사용자 서명 가져오기
                let signatureToUse = userSignatureImage || undefined;

                // 서명이 없는 경우 다시 조회 시도
                if (!signatureToUse) {
                    signatureToUse = await fetchUserSignatureData();
                }

                if (signatureToUse) {
                    // DB에 저장된 서명 사용
                    setSignatures(prev => ({
                        ...prev,
                        [page]: prev[page].map((sig, i) =>
                            i === idx
                                ? {
                                    text: formData.employeeName,
                                    imageUrl: signatureToUse || undefined,
                                    isSigned: true
                                }
                                : sig
                        )
                    }));
                } else {
                    // 서명이 없는 경우 사용자에게 안내
                    if (window.confirm('등록된 서명이 없습니다. 서명을 먼저 등록하시겠습니까?')) {
                        // 서명 등록 페이지로 이동하거나 모달 열기
                        navigate('/profile/signature'); // 또는 서명 등록 페이지 경로
                        // 또는 서명 등록 모달 열기
                        // openSignatureModal();
                    }
                }
            }
        }
    };

    const handleDownload = useCallback(
        async (type: 'pdf') => {
            if (!id || !token) return;

            try {
                const blob = await downloadContract(parseInt(id), type, token);

                // 파일명은 Content-Disposition 헤더에서 가져와도 되지만, 여기선 간단히
                const filename = `contract_${id}.${type}`;

                // Blob → ObjectURL → a 태그로 자동 클릭
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (e: any) {
                console.error(e);
                alert(e.message || '다운로드 중 오류가 발생했습니다.');
            }
        },
        [id, token]
    );

    const loadPreviousContractData = async (previousId: string) => {
        try {
            const previousContract = await fetchContract(parseInt(previousId), token);
            const previousData = JSON.parse(previousContract.formDataJson);

            // 서명과 동의 초기화
            const cleanedData = {
                ...previousData,
                signatures: {
                    page1: [{text: '', imageUrl: undefined, isSigned: false}],
                    page2: [{text: '', imageUrl: undefined, isSigned: false}],
                    page3: [{text: '', imageUrl: undefined, isSigned: false}],
                    page4_consent: [{text: '', imageUrl: undefined, isSigned: false}],
                    page4_receipt: [{text: '', imageUrl: undefined, isSigned: false}],
                    page4_final: [{text: '', imageUrl: undefined, isSigned: false}],
                },
                agreements: {
                    page1: '',
                    page4: ''
                },
                receiptConfirmation1: '',
                receiptConfirmation2: '',
                contractSignDate: new Date().toISOString().split('T')[0]
            };

            // 상태 업데이트
            setFormData(cleanedData);
            setSignatures(cleanedData.signatures);
            setAgreements(cleanedData.agreements);

            // ✅ 서버에 즉시 저장 (임시저장)
            await updateContract(parseInt(id!), cleanedData, token);

            alert('이전 계약서 데이터를 불러왔습니다.');
        } catch (error) {
            console.error('이전 계약서 로드 실패:', error);
            alert('이전 계약서 데이터를 불러오는데 실패했습니다.');
        }
    };

    // ✅ 통합된 하나의 useEffect
    useEffect(() => {
        if (!token || !id) return;

        const loadContractDetails = async () => {
            try {
                const contractData = await fetchContract(parseInt(id), token);
                setContract(contractData);
                setStatus(contractData.status);

                const dto = JSON.parse(contractData.formDataJson);

                setFormData({
                    ...dto,
                    workTimeList: dto.workTimeList?.length > 0 ? dto.workTimeList : ['', '', ''],
                    breakTimeList: dto.breakTimeList?.length > 0 ? dto.breakTimeList : ['', '', '', ''],
                    workingHours: dto.workingHours?.trim() || '209',
                    salaryMonths: dto.salaryMonths?.trim() || '12',
                    employeeName: contractData.employeeName ?? dto.employeeName,
                    employerName: contractData.creatorName ?? dto.employerName,
                    contractSignDate: dto.contractSignDate || new Date().toISOString().split('T')[0]
                });

                if (dto.signatures) setSignatures(dto.signatures);
                if (dto.agreements) setAgreements(dto.agreements);

                // ✅ 이전 계약서 ID가 있으면 데이터 로드
                if (loadFromId) {
                    await loadPreviousContractData(loadFromId);
                }
            } catch (error) {
                console.error('계약서 상세 정보 로드 실패:', error);
            }
        };

        loadContractDetails();
    }, [token, id, loadFromId]);  // ✅ loadFromId 의존성 추가

    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState<boolean>(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number>(0); // ✅ 추가
    const [pageNumber, setPageNumber] = useState<number>(1); // ✅ 추가
    const [isMobile, setIsMobile] = useState(false); // ✅ 추가

    /* ✅ 모바일 감지 useEffect 추가 (다른 useEffect들 근처) */
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    /* ✅ 기존 PDF useEffect 수정 */
    useEffect(() => {
        if (status === 'COMPLETED' && contract?.pdfUrl && id && token) {
            setPdfLoading(true);
            setPdfError(null);

            fetch(`/api/v1/employment-contract/${id}/pdf`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(res => {
                    if (!res.ok) throw new Error(`PDF 로드 실패 (상태: ${res.status})`);
                    return res.blob();
                })
                .then(blob => {
                    console.log('PDF Blob 크기:', blob.size, 'Blob 타입:', blob.type);

                    if (blob.size === 0) {
                        throw new Error('PDF 파일이 비어있습니다.');
                    }

                    const pdfBlob = blob.type === 'application/pdf'
                        ? blob
                        : new Blob([blob], { type: 'application/pdf' });

                    const url = URL.createObjectURL(pdfBlob);
                    console.log('생성된 Blob URL:', url);
                    setPdfBlobUrl(url);
                    setPdfLoading(false);
                })
                .catch(err => {
                    console.error('PDF 로드 에러:', err);
                    setPdfError(err.message || 'PDF를 불러올 수 없습니다.');
                    setPdfLoading(false);
                });

            // ✅ 클린업 함수 수정
            return () => {
                setPdfBlobUrl(prevUrl => {
                    if (prevUrl) {
                        console.log('Blob URL 정리:', prevUrl);
                        URL.revokeObjectURL(prevUrl);
                    }
                    return null;
                });
            };
        }
    }, [status, contract?.pdfUrl, id, token]); // ✅ pdfBlobUrl 제거

    const isAdmin = currentUser?.role === 'ADMIN';
    const isEmployee = currentUser?.id === contract?.employeeId;

    const nextPage = useCallback(() => {
        if (currentPage < pages.length - 1 && !isAnimating) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentPage(prev => prev + 1);
                setIsAnimating(false);
            }, 300);
        }
    }, [currentPage, isAnimating]);

    const prevPage = useCallback(() => {
        if (currentPage > 0 && !isAnimating) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentPage(prev => prev - 1);
                setIsAnimating(false);
            }, 300);
        }
    }, [currentPage, isAnimating]);

    const pages: PageData[] = [
        {
            id: 1,
            title: "근로계약서 -1페이지",
            content:
                <>
                    <div className="contract-header">
                        <input
                            type="text"
                            name="contractTitle"
                            value={formData.contractTitle}
                            onChange={handleInputChange}
                            placeholder="근로계약서【연봉제】"
                            disabled={!isDraft}
                            className="ec-contract-title-input"
                        />
                    </div>
                    <div style={{textAlign: "left"}}>
                        선한병원(이하 '사용자'라 한다)과
                        <input
                            type="text"
                            name="employeeName"
                            value={formData.employeeName}
                            onChange={handleInputChange}
                            placeholder=""
                            disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                            style={{textAlign: 'center', border: 'none', borderBottom: ''}}
                        />
                        (이하 '근로자'라 한다)는(은) 다음과 같이 근로 계약을 체결하고 상호 성실히 준수할 것을 확약한다.
                    </div>
                    <div className="parties-table">
                        <table>
                            <thead>
                            <tr>
                                <th className="section-header">구분</th>
                                <th className="content-header" colSpan={5}>내용</th>
                            </tr>
                            </thead>
                            <tbody>
                            <tr>
                                <th rowSpan={5} className="party-header">당사자</th>
                            </tr>
                            <tr>
                                <th rowSpan={2} className="party-header">사용자</th>
                                <th className="field-header">사업체명</th>
                                <td className="input-cell">
                                    선한병원
                                </td>
                                <th className="field-header">대표자</th>
                                <td className="input-cell">
                                    최민선
                                </td>
                            </tr>
                            <tr>
                                <th className="field-header">소재지</th>
                                <td className="input-cell">
                                    광주광역시 서구 무진대로 975(광천동)
                                </td>
                                <th className="field-header">전화</th>
                                <td className="input-cell">
                                    062-466-1000
                                </td>
                            </tr>

                            <tr>
                                <th rowSpan={2} className="party-header">근로자</th>
                                <th className="field-header">성명</th>
                                <td className="input-cell">
                                    <input
                                        type="text"
                                        name="employeeName"
                                        value={formData.employeeName}
                                        onChange={handleInputChange}
                                        placeholder=""
                                        disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                    />
                                </td>
                                <th className="field-header">주민번호</th>
                                <td className="input-cell">
                                    <input
                                        type="text"
                                        name="employeeSSN"
                                        value={formData.employeeSSN || ''}
                                        onChange={handleInputChange}
                                        placeholder="000000-0000000"  // ← 플레이스홀더 추가
                                        maxLength={14}  // ← 하이픈 포함 최대 14자리
                                        disabled={!isDraft}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <th className="field-header">주소</th>
                                <td className="input-cell">
                                    <textarea
                                        ref={addressTextareaRef}
                                        name="employeeAddress"
                                        value={formData.employeeAddress}
                                        onChange={handleInputChange}
                                        placeholder=""
                                        disabled={!isDraft}
                                        rows={1}  // ← 이거 추가
                                        style={{
                                            width: '100%',
                                            wordBreak: 'break-word',
                                            whiteSpace: 'pre-wrap',
                                            overflow: 'hidden',
                                            resize: 'none',
                                            padding: '6px 8px',
                                            fontFamily: 'inherit',
                                            fontSize: 'inherit',
                                            lineHeight: '1.4',
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            boxSizing: 'border-box',
                                            outline: 'none',
                                            textAlign: 'center'
                                        }}
                                    />
                                </td>
                                <th className="field-header">전화</th>
                                <td className="input-cell">
                                    <input
                                        type="text"
                                        name="employeePhone"
                                        value={formData.employeePhone}
                                        onChange={handleInputChange}
                                        placeholder=""
                                        disabled={!isDraft}
                                    />
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="contract-content">
                        <div className="clause">
                            <h3>제 1 조 【취업 장소 및 취업직종】</h3>
                            <p className="input-group">
                                ① 취업장소 : 사업장 소재지 및 회사가 지정한 소재지 &nbsp;&nbsp;&nbsp;&nbsp;
                                ② 취업직종 &nbsp;&nbsp;:
                                <input
                                    type="text"
                                    name="employmentOccupation"
                                    value={formData.employmentOccupation}
                                    onChange={handleInputChange}
                                    placeholder=" "
                                    disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                    className="wide-input"
                                    style={{margin: 0}}
                                />
                            </p>
                            <p>
                                ③ '사용자'는 업무상 필요에 의해서 '근로자'의 근무장소 및 부서 또는 담당업무를 변경할 수 있으며 근로자는 이에 성실히 따라야 한다.
                            </p>
                        </div>

                        <div className="clause">
                            <h3>제 2 조 【근로계약기간】</h3>
                            <div className="input-group">
                                <p>① 최초입사일 &nbsp;&nbsp;:</p>
                                <input
                                    type="text"
                                    name="startDate"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                    placeholder=" "
                                    disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                    className="wide-input"
                                />
                            </div>
                            <div className="input-group">
                                <p>② 근로계약기간 &nbsp;&nbsp;:</p>
                                <input
                                    type="text"
                                    name="contractDate"
                                    value={formData.contractDate}
                                    onChange={handleInputChange}
                                    placeholder=" "
                                    disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                    className="wide-input"
                                />
                            </div>
                            <div className="input-group">
                                <p>③ 근로조건 적용기간 &nbsp;&nbsp;:</p>
                                <input
                                    type="text"
                                    name="conditionApplyDate"
                                    value={formData.conditionApplyDate}
                                    onChange={handleInputChange}
                                    placeholder=" "
                                    disabled={!isDraft}
                                    className="wide-input"
                                />
                            </div>
                            <p>
                                ④ 본 계약의 유효기간은 제 ②항을 원칙으로 하며 매년 연봉 등 근로 조건에 대한 재계약을 체결하고 재계약 체결 시에는 '사용자'는
                                '근로자'에게 30일 전에 재계약 체결에 대한 기일 통보를 한다. 또한 매년 재계약 체결 시 '사용자'가 제시한 기일 내에 '근로자'가
                                재계약에 응하지 않을 때에는 근로계약의 해지의사로 간주하여 근로계약은 자동으로 종료된다.
                            </p>
                            <p>
                                ⑤ 계약기간 중 '근로자'가 계약을 해지하고자 할 때에는 30일 전에 사직서를 제출하여 업무인수인계가 원활히 이루어지도록 하여야
                                하며, 만약 사직서가 수리되기 전에 출근 명령 등에 불응하였을 때에는 그 기간에 대하여 결근 처리한다.
                            </p>
                            <h3>제 3 조 【근로시간 및 휴게시간】</h3>
                            <div style={{marginBottom: '10px'}}>
                                <div className="input-group">
                                    <p>① 근로시간 &nbsp;&nbsp;:</p>
                                    <input
                                        type="text"
                                        name="workTimeList"
                                        value={formData.workTimeList[0]}
                                        placeholder=" "
                                        disabled={!isDraft}
                                        onChange={(e) => handleArrayInputChange('workTimeList', 0, e.target.value)}
                                        onKeyDown={(e) => handleArrayInputKeyDown(e, 'workTimeList', 0)}
                                        className="wide-input"
                                    />
                                </div>
                                {formData.workTimeList.slice(1).map((time, index) => (
                                    <div key={index + 1} className="input-group">
                                        <p style={{visibility: 'hidden'}}>① 근로시간 &nbsp;&nbsp;:</p>
                                        <input
                                            type="text"
                                            name="workTimeList"
                                            value={time}
                                            placeholder=" "
                                            disabled={!isDraft}
                                            onChange={(e) => handleArrayInputChange('workTimeList', index + 1, e.target.value)}
                                            onKeyDown={(e) => handleArrayInputKeyDown(e, 'workTimeList', index + 1)}
                                            className="wide-input"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div style={{marginBottom: '10px'}}>
                                <div className="input-group">
                                    <p>② 휴게시간 &nbsp;&nbsp;:</p>
                                    <input
                                        type="text"
                                        name="breakTimeList"
                                        value={formData.breakTimeList[0]}
                                        placeholder=" "
                                        disabled={!isDraft}
                                        onChange={(e) => handleArrayInputChange('breakTimeList', 0, e.target.value)}
                                        onKeyDown={(e) => handleArrayInputKeyDown(e, 'breakTimeList', 0)}
                                        className="wide-input"
                                    />
                                </div>
                                {formData.breakTimeList.slice(1).map((time, index) => (
                                    <div key={index + 1} className="input-group">
                                        <p style={{visibility: 'hidden'}}>② 휴게시간 &nbsp;&nbsp;:</p>
                                        <input
                                            type="text"
                                            name="breakTimeList"
                                            value={time}
                                            placeholder=" "
                                            disabled={!isDraft}
                                            onChange={(e) => handleArrayInputChange('breakTimeList', index + 1, e.target.value)}
                                            onKeyDown={(e) => handleArrayInputKeyDown(e, 'breakTimeList', index + 1)}
                                            className="wide-input"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p>③ 제 ①항 및 ②항은 '사용자'의 병원운영상 필요와 계절의 변화에 의해 변경할 수 있으며 '근로자'는 근로형태에 따라 1주일에
                                12시간 한도로 근로를 연장할 수 있으며, 근로자는 발생할 수 있는 연장, 야간 및 휴일근로를 시행하는 것에 동의한다.</p>
                            <div className="consent-container">
                                <div className="consent-row">
                                    <div className="checkbox-section">
                                        <label className="checkbox-item">
                                            <input
                                                type="checkbox"
                                                checked={agreements.page1 === 'agree'}
                                                onChange={() => handleAgreementChange('page1', agreements.page1 === 'agree' ? '' : 'agree')}
                                                className="checkbox-input"
                                            />
                                            <span className="checkbox-text">동의</span>
                                        </label>

                                        <label className="checkbox-item">
                                            <input
                                                type="checkbox"
                                                checked={agreements.page1 === 'disagree'}
                                                onChange={() => handleAgreementChange('page1', agreements.page1 === 'disagree' ? '' : 'disagree')}
                                                className="checkbox-input"
                                            />
                                            <span className="checkbox-text">동의하지 않음</span>
                                        </label>
                                    </div>

                                    <label className="signature-section">
                                        <span className="signature-label">동의자 :</span>
                                        {signatures.page1.map((sig, idx) => (
                                            <React.Fragment key={idx}>
                                                <input
                                                    type="text"
                                                    value={formData.employeeName}
                                                    readOnly
                                                    className="signature-input"
                                                    placeholder={`서명 ${idx + 1}`}
                                                />
                                                <span
                                                    className="signature-suffix-container clickable"
                                                    onClick={handleSignatureClick('page1', idx)}
                                                >
                                             {sig.isSigned && sig.imageUrl ? (
                                                 <img
                                                     src={sig.imageUrl}
                                                     alt="서명"
                                                     className="signature-image"
                                                 />
                                             ) : (
                                                 <span className="signature-text">(서명/인)</span>
                                             )}
                                            </span>
                                            </React.Fragment>
                                        ))}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
        },
        {
            id: 2,
            title: "근로계약서 -2페이지",
            content:
                <>
                    <div className="contract-content">
                        <div className="clause">
                            <h3>제 4 조 【연봉계약】</h3>
                            <div className="input-group">
                                <p>① 연봉계약 기간 : </p>
                                <input
                                    type="text"
                                    name="salaryContractDate"
                                    value={formData.salaryContractDate}
                                    placeholder=" "
                                    disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                    onChange={handleInputChange}
                                    className="wide-input"
                                />
                            </div>
                            <div>
                                <p>② 연봉계약의 종료일까지 재계약이 체결되지 않을 경우 재계약 체결일까지 동일한 조건으로 재계약이 체결된 것으로 한다.</p>
                            </div>
                        </div>
                        <div className="clause">
                            <h3>제 5 조 【임금 및 구성항목】</h3>
                            <p>① 연봉은 아래의 각 수당을 포함하고,
                                <input
                                    type="text"
                                    name="salaryMonths"
                                    value={formData.salaryMonths}
                                    onChange={handleInputChange}
                                    placeholder="12"
                                    disabled={!isDraft}
                                    style={{
                                        width: '30px',
                                        border: 'none',
                                        borderBottom: '1px solid #333',
                                        textAlign: 'center',
                                        display: 'inline',
                                        padding: '0 2px'
                                    }}
                                />
                                개월 균등 분할하여 매월 지급한다.
                            </p>
                            <div className="parties-table">
                                <table>
                                    <thead>
                                    <tr>
                                        <th className="section-header" colSpan={3}>항목</th>
                                        <th className="content-header" colSpan={1}>금액</th>
                                        <th className="content-header" colSpan={3}>산정근거</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    <tr>
                                        <th style={{borderTop: "3px double #333"}} colSpan={3}
                                            className="party-header">연봉총액
                                        </th>
                                        <td style={{borderTop: "3px double #333"}} colSpan={1}
                                            className="input-cell">
                                            <input
                                                type="text"
                                                name="totalAnnualSalary"
                                                value={formData.totalAnnualSalary}
                                                onChange={handleInputChange}
                                                placeholder=""
                                                disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                            />
                                        </td>
                                        <td style={{borderTop: "3px double #333"}} colSpan={3} className="section-body">
                                            월급여총액 x {formData.salaryMonths || '12'}개월
                                        </td>
                                    </tr>
                                    <tr>
                                        <th rowSpan={11} className="party-header">연봉</th>
                                    </tr>
                                    <tr>
                                        <th style={{fontWeight: "bolder"}} rowSpan={7} className="party-header">표준<br/>연봉총액
                                        </th>
                                    </tr>
                                    <tr>
                                        <th className="party-header">기본급</th>
                                        <td className="input-cell">
                                            <input
                                                type="text"
                                                name="basicSalary"
                                                value={formData.basicSalary}
                                                onChange={handleInputChange}
                                                placeholder=""
                                                disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                            />

                                        </td>
                                        <td colSpan={1} rowSpan={6} className="input-cell" style={{padding: '4px 3px'}}>
                                            <input
                                                type="text"
                                                name="workingHours"
                                                value={formData.workingHours}
                                                onChange={handleInputChange}
                                                placeholder="209"
                                                disabled={!isDraft}
                                                style={{
                                                    width: '40px',
                                                    border: 'none',
                                                    textAlign: 'center',
                                                    padding: '0',
                                                    margin: '0'
                                                }}
                                            />
                                            <span style={{marginLeft: '-6px'}}>시간</span>
                                        </td>
                                        <td colSpan={2} rowSpan={6} className="section-body"
                                            style={{textAlign: "center"}}>소정근로시간 x 통상시급 x 1.0
                                        </td>
                                    </tr>
                                    <tr>
                                        <th className="party-header">직책수당</th>
                                        <td className="input-cell">
                                        <input
                                                type="text"
                                                name="positionAllowance"
                                                value={formData.positionAllowance}
                                                onChange={handleInputChange}
                                                placeholder=""
                                                disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <th className="party-header">면허/자격수당</th>
                                        <td className="input-cell">
                                            <input
                                                type="text"
                                                name="licenseAllowance"
                                                value={formData.licenseAllowance}
                                                onChange={handleInputChange}
                                                placeholder=""
                                                disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <th className="party-header">위험수당</th>
                                        <td className="input-cell">
                                            <input
                                                type="text"
                                                name="hazardPay"
                                                value={formData.hazardPay}
                                                onChange={handleInputChange}
                                                placeholder=""
                                                disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <th className="party-header">처우개선비</th>
                                        <td className="input-cell">
                                            <input
                                                type="text"
                                                name="treatmentImprovementExpenses"
                                                value={formData.treatmentImprovementExpenses}
                                                onChange={handleInputChange}
                                                placeholder=""
                                                disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                            />
                                        </td>
                                    </tr>

                                    <tr>
                                        <th className="party-header">조정수당</th>
                                        <td className="input-cell">
                                            <input
                                                type="text"
                                                name="adjustmentAllowance"
                                                value={formData.adjustmentAllowance}
                                                onChange={handleInputChange}
                                                placeholder=""
                                                disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <th style={{fontWeight: "bolder"}} rowSpan={3} className="party-header">변동<br/>연봉총액
                                        </th>
                                    </tr>
                                    <tr>
                                        <th className="party-header">
                                            <input
                                                type="text"
                                                name="overtime"
                                                value={formData.overtime}
                                                onChange={handleInputChange}
                                                placeholder="연장/야간수당(고정)"
                                                disabled={!isDraft}
                                            />
                                        </th>
                                        <td className="input-cell">
                                            <input
                                                type="text"
                                                name="overtimePay"
                                                value={formData.overtimePay}
                                                onChange={handleInputChange}
                                                placeholder=""
                                                disabled={!isDraft}
                                            />
                                        </td>
                                        {/*<td colSpan={3} className="section-body">월 소정근로시간 209시간을 초과한 연장근로, 야간근로 가산</td>*/}
                                        <td colSpan={3} className="input-cell">
                                            <input
                                                type="text"
                                                name="overtimeDescription"
                                                value={formData.overtimeDescription}
                                                onChange={handleInputChange}
                                                placeholder="월 소정근로시간 209시간을 초과한 연장근로, 야간근로 가산"
                                                disabled={!isDraft}
                                                style={{width: '100%', border: 'none', textAlign: 'left'}}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <th className="party-header">
                                            <input
                                                type="text"
                                                name="nDuty"
                                                value={formData.nDuty}
                                                onChange={handleInputChange}
                                                placeholder="N/당직수당"
                                                disabled={!isDraft}
                                            />
                                        </th>
                                        <td className="input-cell">
                                            <input
                                                type="text"
                                                name="nDutyAllowance"
                                                value={formData.nDutyAllowance}
                                                onChange={handleInputChange}
                                                placeholder=""
                                                disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                            />
                                        </td>
                                        {/*<td colSpan={3} className="section-body">의무나이트 이행 수당(의무 나이트 미수행 시 차감)</td>*/}
                                        <td colSpan={3} className="input-cell">
                                            <input
                                                type="text"
                                                name="dutyDescription"
                                                value={formData.dutyDescription}
                                                onChange={handleInputChange}
                                                placeholder="의무나이트 이행 수당(의무 나이트 미수행 시 차감)"
                                                disabled={!isDraft}
                                                style={{width: '100%', border: 'none', textAlign: 'left'}}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <th colSpan={3} className="party-header">통상시급</th>
                                        <td className="input-cell">
                                            <input
                                                type="text"
                                                name="regularHourlyWage"
                                                value={formData.regularHourlyWage}
                                                onChange={handleInputChange}
                                                placeholder=""
                                                disabled={!isDraft}
                                            />
                                        </td>
                                        <td colSpan={3} className="section-body">통상시급은 표준연봉총액을 기준으로 한다.</td>
                                    </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p>② 추가적인 연장, 야간 및 휴일근로수당은 근로기준법이 정하는 바에 따라 가산하여 지급한다.</p>
                            <p>③ 임금은 매월 1일부터 말일까지를 산정기간으로 하고, <u>익월 15일</u>에 지급한다.</p>
                            <p>④ 매월 임금 정산 시에는 소득세와 사회보험료 등을 원천징수한 후 지급한다.</p>
                            <p>⑤ 근로자의 의무나이트(당직) 개수를 지정하여 지정 개수만큼의 수당을 연봉에 포함한다.</p>
                            <p className="input-group" style={{display: 'block', lineHeight: '1.6'}}>⑥ 근로자의 의무나이트(당직)개수는
                                <u>
                                    <input
                                        type="text"
                                        name="dutyNight"
                                        value={formData.dutyNight}
                                        onChange={handleInputChange}
                                        placeholder=""
                                        disabled={!isDraft} // ← DRAFT가 아니면 편집 금지
                                        maxLength={3}                // 두 글자까지만 허용
                                        size={Math.max((formData.dutyNight || "").length, 1)}
                                        className="ch-input"         // 전용 클래스
                                        style={{
                                            margin: 0,
                                            fontWeight: "bolder",
                                            display: 'inline',
                                            textAlign: 'center'
                                        }}        // 필요하면 추가 스타일
                                    />
                                </u>
                                <strong>개</strong>로 지정하고, 의무나이트(당직)개수를 기준으로 매월 부족한 개수에 대해서는 ①항의 연봉에서 삭감하고 초과한 개수에 대해서는
                                추가 지급한다.
                            </p>
                            <p>⑦ 제 ①항의 임금에 관한 내용은 다른 직원들에게 비밀을 유지하며, 이를 위반할 경우 중징계 대상이 될수 있다.</p>
                            <p>⑧ 3개월 미만 재직 후 퇴사할 경우 유니폼 구입비용(업체 거래명세서 금액) 100%와 채용 시 지출했던 특수검진비 100%를 퇴직 월급여에서 공제 후
                                지급한다.</p>
                            <p>⑨ 이외의 사항은 급여규정에 따른다.</p>
                        </div>
                        <div className="clause">
                            <h3>제 6 조 【임금의 차감】</h3>
                            <p>
                                ① 제 3조(근로시간 및 휴게)에서 정한 근로시간에 '사용자'의 근무지시에도 불구하고 지각, 조퇴 및 결근한 경우에는 「근로 기준법」이 정하는 바에 따라
                                지급될 수 있고,
                                결근 1일에 대해서는 근로자 통상시급에 시간을 비례해서 공제하며, 제5조(임금 및 구성항목) 제 ①항에서 정한 급여를 차감하여 지급한다.
                            </p>
                            <p>
                            ② '근로자'가 월 중 신규채용, 중도퇴사, 휴직, 복직 등의 사유로 그 월의 근무일수가 1개월에 미달할 경우에는 임금 및 구성항목별 임금액을 최종 근로일까지의
                                일수에 비례하여
                                해당 월의 총 일수로 일할 계산한 후 지급하며, 주휴수당은 만근 시에만 지급한다.
                            </p>
                        </div>
                        <label className="signature-section" style={{justifyContent: 'flex-end', width: '100%'}}>
                            <span className="signature-label">확인 :</span>
                            {signatures.page2.map((sig, idx) => (
                                <React.Fragment key={idx}>
                                    <input
                                        type="text"
                                        value={formData.employeeName}
                                        readOnly
                                        className="signature-input"
                                        placeholder={`서명 ${idx + 1}`}
                                    />
                                    <span
                                        className="signature-suffix-container clickable"
                                        onClick={handleSignatureClick('page2', idx)}
                                    >
                                    {sig.isSigned && sig.imageUrl ? (
                                        <img
                                            src={sig.imageUrl}
                                            alt="서명"
                                            className="signature-image"
                                        />
                                    ) : (
                                        <span className="signature-text">(서명/인)</span>
                                    )}
                                    </span>
                                </React.Fragment>
                            ))}
                        </label>
                    </div>
                </>
        },
        {
            id: 3,
            title: "근로계약서 -3페이지",
            content:
                <>
                    <div className="contract-content">
                        <div className="clause">
                            <h3>제 7 조 【휴일 및 휴가】</h3>
                            <p>
                                ① 휴일 : 주휴일(주1회), 근로자의 날, 「근로 기준법」에서 정한 날, 기타 취업규칙에서 정한 날. 다만, 주휴일은 회사업무의 특성상 부서별 또는
                                근로자별로 다른 날을
                                지정할 수 있다.
                            </p>
                            <p>
                                -주휴일은 1주 동안의 소정근로일을 개근한 자에게 유급으로 하며, 개근하지 않은 근로자는 무급으로 한다.
                            </p>
                            <p>
                                -유급 휴일이 중복될 경우에는 하나의 유급 휴일만 인정한다.
                            </p>
                            <p>
                                ② '사용자'는 '근로자'에게 「근로 기준법」에서 정하는 바에 따라 연차유급휴가 및 생리휴가(무급)를 부여한다.
                            </p>
                            <p>
                                ③ 연차 유급휴가는 회계연도 기준(매년 01월 01일부터 12월 31일)으로 산정하여 부여한다.
                            </p>
                        </div>
                        <div className="clause">
                            <h3>제 8 조 【퇴직급여】</h3>
                            <p>
                                ① 퇴직급여는 근로기준법 및 근로자퇴직급여보장법이 정하는 바에 따른다.
                            </p>
                        </div>

                        <div className="clause">
                            <h3>제 9 조 【정년】</h3>
                            <p>
                                ① 정년은 만 60세에 도달한 날로 한다.
                            </p>
                        </div>

                        <div className="clause">
                            <h3>제 10 조 【안전관리】</h3>
                            <p>
                                ① '근로자'는 '사용자'가 정한 안전관리에 관한 제규칙과 관리자의 지시 사항을 준수하고 재해 발생시에는 산업재해 보상보험법에 의한다.
                            </p>
                        </div>
                        <div className="clause">
                            <h3>제 11 조 【근로계약해지】</h3>
                            <p>
                                ① '근로자'가 취업규칙 또는 다음 각 호에 해당하는 경우에 대해서는 '사용자'는 '근로자'를 징계위원회의에 회부하여 징계위원회의 결정에 따라 처리한다.
                            </p>
                            <p style={{marginLeft: '20px'}}>
                                1. '근로자'가 직원을 선동하여 업무를 방해하고 불법으로 유인물을 배포할 때.
                            </p>
                            <p style={{marginLeft: '20px'}}>
                                2. '근로자'가 무단결근을 계속해서 연속 3일, 월간 5일 또는 년 20일 이상 무단결근한 경우.
                            </p>
                            <p style={{marginLeft: '20px'}}>
                                3. '근로자'가 근무성적 또는 능력이 현저하게 불량하여 업무수행이 불가능하다고 인정될 때.
                            </p>
                            <p style={{marginLeft: '20px'}}>
                                4. '사용자'의 허가 없이 '근로자' 문서, 비품, 자산 등을 외부로 반출하거나 대여 했을 때.
                            </p>
                            <p style={{marginLeft: '20px'}}>
                                5. 기타 이에 준하는 행위를 하였다고 판단 되었을 때.
                            </p>
                            <p>
                                ② '근로자'가 30일 전 사직서를 제출하고 후임자에게 인수인계를 완료한 경우.
                            </p>
                            <p>
                                ③ 제 2조 제②항에서 정한 근로계약기간이 만료된 때.
                            </p>
                            <p>
                                ④ 제 9조에서 규정한 정년에 도달한 때.
                            </p>
                            <p>
                                ⑤ 채용조건에 갖춰진 각종 문서의 위조, 변조 또는 허위사실이 발견되었을 때.
                            </p>
                            <p>
                                ⑥ 퇴직하는 달의 월급은 급여일인 익월 15일에 지급하고, 퇴직금은 퇴직일로부터 1개월 이내에 지급한다.
                            </p>
                        </div>
                        <div className="clause">
                            <h3> 제12 조 【손해배상】</h3>
                            <p>
                            다음 각 호의 1에 해당하는 경우에는 '근로자'는 '사용자'에게 손해를 배상하여야 한다.
                            </p>
                            <p>
                                ① '근로자'가 고의 또는 과실로 '사용자'에게 손해를 끼친 경우.
                            </p>
                        </div>
                        <label className="signature-section" style={{justifyContent: 'flex-end', width: '100%'}}>
                            <span className="signature-label">확인 :</span>
                            {signatures.page3.map((sig, idx) => (
                                <React.Fragment key={idx}>
                                    <input
                                        type="text"
                                        value={formData.employeeName}
                                        readOnly
                                        className="signature-input"
                                        placeholder={`서명 ${idx + 1}`}
                                    />
                                    <span
                                        className="signature-suffix-container clickable"
                                        onClick={handleSignatureClick('page3', idx)}
                                    >
                                    {sig.isSigned && sig.imageUrl ? (
                                        <img
                                            src={sig.imageUrl}
                                            alt="서명"
                                            className="signature-image"
                                        />
                                    ) : (
                                        <span className="signature-text">(서명/인)</span>
                                    )}
                                    </span>
                                </React.Fragment>
                            ))}
                        </label>
                    </div>
                </>
        },
        {
            id: 4,
            title: "근로계약서 -4페이지",
            content:
                <>
                    <div className="contract-content">
                        <div className="clause">
                            <p>
                                ② '근로자'가 재직 중 또는 퇴직 후라도 병원, 관련 회사 및 업무상 관계자에 대한 기밀 정보를 누설한 경우.
                            </p>
                            <p>
                                ③ '근로자'가 병원에 근무 중 얻은 비밀 정보나 지식을 이용하여 병원 및 관련 회사에 손해를 끼친 경우.
                            </p>
                            <p>
                                ④ '사용자'의 사직서 수리 전에 퇴사함으로써 병원에 손해를 끼친 경우.
                            </p>
                        </div>

                        <div className="clause">
                            <h3>제 13 조 【개인정보의 수집이용에 대한 동의】</h3>
                            <div className="parties-table">
                                <table>
                                    <thead>
                                    <tr>
                                        <th className="section-header">정보의 수집, 이용목적</th>
                                        <td className="section-body">당사의 인적자원관리, 노동법률자문사제출, 세무사무대행사제출</td>
                                    </tr>
                                    <tr>
                                        <th rowSpan={4} className="section-header">개인정보의 항목</th>
                                        <td className="section-body">1. 성명, 주민번호, 가족사항</td>
                                    </tr>
                                    <tr>
                                        <td className="section-body">2. 주소, 이메일, 휴대전화 번호 등 연락처</td>
                                    </tr>
                                    <tr>
                                        <td className="section-body">3. 학력, 근무경력</td>
                                    </tr>
                                    <tr>
                                        <td className="section-body">4. 기타 근로와 관련된 개인정보</td>
                                    </tr>
                                    <tr>
                                        <th className="section-header">보유 및 이용기간</th>
                                        <td className="section-body">근로관계가 유지되는 기간</td>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    <tr>
                                        <td colSpan={2} className="section-body">'사용자'는 개인정보를 다른 목적으로 이용하거나 노동법률자문사,
                                            세무대행 외 제 3자에게 제공하지 않습니다.
                                            <br/>
                                            위 내용을 충분히 숙지하고 개인정보의 수집 및 이용에 대하여 동의합니다.
                                            <br/>
                                            <div style={{backgroundColor: 'transparent', border: 'none'}}
                                                 className="consent-row">
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '10px'
                                                }} className="checkbox-section">
                                                    <label className="checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={agreements.page4 === 'agree'}
                                                            onChange={() => handleAgreementChange('page4', agreements.page4 === 'agree' ? '' : 'agree')}
                                                            className="checkbox-input"
                                                        />
                                                        <span className="checkbox-text">동의</span>
                                                    </label>

                                                    <label className="checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={agreements.page4 === 'disagree'}
                                                            onChange={() => handleAgreementChange('page4', agreements.page4 === 'disagree' ? '' : 'disagree')}
                                                            className="checkbox-input"
                                                        />
                                                        <span className="checkbox-text">동의하지 않음</span>
                                                    </label>
                                                </div>

                                                <label className="signature-section">
                                                    {signatures.page4_consent.map((sig, idx) => (
                                                        <React.Fragment key={idx}>
                                                            <input
                                                                type="text"
                                                                value={formData.employeeName}
                                                                readOnly
                                                                className="signature-input"
                                                                placeholder={`서명 ${idx + 1}`}
                                                            />
                                                            <span
                                                                className="signature-suffix-container clickable"
                                                                onClick={handleSignatureClick('page4_consent', idx)}
                                                            >
                                                            {sig.isSigned && sig.imageUrl ? (
                                                                <img
                                                                    src={sig.imageUrl}
                                                                    alt="서명"
                                                                    className="signature-image"
                                                                />
                                                            ) : (
                                                                <span className="signature-text">(서명/인)</span>
                                                            )}
                                                            </span>
                                                        </React.Fragment>
                                                    ))}
                                                </label>
                                            </div>
                                        </td>
                                    </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="clause">
                            <h3>제 14 조 【준용 및 해석】</h3>
                            <p>
                                ① 본 계약서에 명시되지 않은 사항은 취업규칙 및 관계법령에서 정한 바에 따른다.
                            </p>
                        </div>

                        <div className="clause">
                            <h3>제 15 조 【근로계약서 교부】</h3>
                            <p>
                                ① 근로자로 채용된 자는 본 근로계약서에 서명 또는 날인하여 근로계약을 체결하고, 근로자에게 근로계약서 사본 1부를 교부한다.
                            </p>
                        </div>

                        <div className="clause">
                            <p>
                                ※ 아래의 음영부분을 자필로 기재합니다.
                            </p>
                            {/* ✅ input-group을 column으로 변경 */}
                            <div className="input-group" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
                                {/* 첫 번째 줄: 교부/확인 입력 */}
                                <div style={{display: 'flex', alignItems: 'center', gap: '8px', width: '100%'}}>
                                    <span>근로계약서를 </span>
                                    <input
                                        type="text"
                                        name="receiptConfirmation1"
                                        value={formData.receiptConfirmation1 || ''}
                                        onChange={handleInputChange}
                                        placeholder="교부"
                                        className={formData.receiptConfirmation1 === '교부' ? 'receipt-correct' : 'receipt-incorrect'}
                                        style={{
                                            textAlign: "center",
                                            backgroundColor: formData.receiptConfirmation1 === '교부' ? '#e8f5e8' : '#ffe8e8'
                                        }}
                                    />
                                    <span>받았음을 </span>
                                    <input
                                        type="text"
                                        name="receiptConfirmation2"
                                        value={formData.receiptConfirmation2 || ''}
                                        onChange={handleInputChange}
                                        placeholder="확인"
                                        className={formData.receiptConfirmation2 === '확인' ? 'receipt-correct' : 'receipt-incorrect'}
                                        style={{
                                            textAlign: "center",
                                            backgroundColor: formData.receiptConfirmation2 === '확인' ? '#e8f5e8' : '#ffe8e8'
                                        }}
                                    />
                                    <span>합니다.</span>
                                </div>

                                {/* ✅ 두 번째 줄: 서명 영역 - 별도 줄로 분리 */}
                                <label className="signature-section"
                                       style={{justifyContent: 'flex-end', width: '100%', marginTop: '8px'}}>
                                    <span className="signature-label">근로자 :</span>
                                    {signatures.page4_receipt.map((sig, idx) => (
                                        <React.Fragment key={idx}>
                                            <input
                                                type="text"
                                                value={formData.employeeName}
                                                readOnly
                                                className="signature-input"
                                                placeholder={`서명 ${idx + 1}`}
                                            />
                                            <span
                                                className="signature-suffix-container clickable"
                                                onClick={handleSignatureClick('page4_receipt', idx)}
                                            >
                                            {sig.isSigned && sig.imageUrl ? (
                                                <img src={sig.imageUrl} alt="서명" className="signature-image"/>
                                            ) : (
                                                <span className="signature-text">(서명/인)</span>
                                            )}
                                        </span>
                                        </React.Fragment>
                                    ))}
                                </label>
                            </div>
                        </div>

                        <div className="clause"
                             style={{
                                 display: 'flex',
                                 justifyContent: 'center',
                                 marginTop: -25
                             }}>
                            <div style={{justifyContent: 'center', marginTop: '80px', marginBottom: '40px'}}
                                 className="signature-section">
                                <div className="date-section">
                                    <span>작성일자 : </span>
                                    <input type="date" name="contractSignDate" className="input" style={{
                                        border: "none",
                                        fontWeight: "bold",
                                        fontSize: "14px",
                                        textAlign: "end"
                                    }}
                                           value={formData.contractSignDate}  // ← formData에서 가져오기
                                           onChange={handleInputChange}  // ← 기존 핸들러 사용
                                           disabled={!isDraft}  // ← DRAFT가 아니면 수정 불가
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="clause"
                             style={{
                                 display: 'flex',
                                 justifyContent: 'flex-end'
                             }}>
                            <label className="signature-section">
                                <span className="signature-label">회사 : </span>
                                <span style={{fontWeight: "bolder"}} className="signature-label">
                                    선한병원 <br/> 대표원장
                                </span>
                                <span style={{fontWeight: "bolder"}} className="signature-label">
                                    최민선
                                </span>
                                <span className="signature-suffix-container">
                                <span className="signature-suffix-container">
                                    <img
                                        src={CeoDirectorSignImage}
                                        alt="대표원장 서명"
                                        className="signature-image"
                                    />
                                </span>
                            </span>
                            </label>
                        </div>

                        <div className="clause"
                             style={{
                                 display: 'flex',
                                 justifyContent: 'flex-end'
                             }}>
                            <label className="signature-section">
                                <span className="signature-label">근로자 :</span>
                                {signatures.page4_final.map((sig, idx) => (
                                    <React.Fragment key={idx}>
                                        <input
                                            type="text"
                                            value={formData.employeeName}
                                            readOnly
                                            className="signature-input"
                                            placeholder={`서명 ${idx + 1}`}
                                        />
                                        <span
                                            className="signature-suffix-container clickable"
                                            onClick={handleSignatureClick('page4_final', idx)}
                                        >
                                    {sig.isSigned && sig.imageUrl ? (
                                        <img
                                            src={sig.imageUrl}
                                            alt="서명"
                                            className="signature-image"
                                        />
                                    ) : (
                                        <span className="signature-text">(서명/인)</span>
                                    )}
                                    </span>
                                    </React.Fragment>
                                ))}
                            </label>
                        </div>
                    </div>
                </>
        },
    ]

    useEffect(() => {
        console.log("FormData updated:", formData);
    }, [formData]);

    if (status === 'COMPLETED' && contract?.pdfUrl && !pdfBlobUrl && !pdfError) {
        return <Layout>
            <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '60vh', gap: '16px'
            }}>
                <div style={{
                    width: '50px', height: '50px',
                    border: '5px solid #e5e7eb',
                    borderTop: '5px solid #2563eb',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                }}/>
                <div style={{color: '#555', fontSize: '15px', fontWeight: 500}}>문서를 불러오는 중...</div>
                <div style={{color: '#aaa', fontSize: '12px'}}>잠시만 기다려주세요</div>
            </div>
        </Layout>;
    }

    return (
        <Layout>
            {(!contract || status === null) ? (
                <div className="loading">로딩 중...</div>
            ) : (
                <div className="contract-container">
                    {status === 'COMPLETED' && contract?.pdfUrl ? (
                        <div className="pdf-viewer">
                            {pdfLoading && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '50px',
                                    fontSize: '16px',
                                    color: '#666'
                                }}>
                                    <div style={{fontSize: '32px', marginBottom: '15px'}}>📄</div>
                                    <div>PDF 로딩 중...</div>
                                </div>
                            )}

                            {pdfError && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '50px',
                                    color: '#dc3545'
                                }}>
                                    <div style={{fontSize: '32px', marginBottom: '15px'}}>⚠️</div>
                                    <div style={{marginBottom: '20px', fontSize: '16px'}}>{pdfError}</div>
                                    <button
                                        onClick={() => window.location.reload()}
                                        style={{
                                            padding: '10px 20px',
                                            backgroundColor: '#007bff',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '5px',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    새로고침
                                </button>
                            </div>
                        )}

                        {pdfBlobUrl && !pdfLoading && !pdfError && (
                            <div className="pdf-document-container">
                                <Document
                                    file={pdfBlobUrl}
                                    onLoadSuccess={({ numPages }) => {
                                        console.log('PDF 로드 성공, 총 페이지:', numPages);
                                        setNumPages(numPages);
                                    }}
                                    onLoadError={(error) => {
                                        console.error('PDF 로드 실패 상세:', error);
                                        setPdfError(`PDF 로드 실패: ${error?.message || JSON.stringify(error)}`);
                                    }}
                                    loading={
                                        <div style={{
                                            textAlign: 'center',
                                            padding: '50px',
                                            color: '#666'
                                        }}>
                                            <div style={{ fontSize: '32px', marginBottom: '15px' }}>📄</div>
                                            <div>문서 로딩 중...</div>
                                        </div>
                                    }
                                >
                                    <Page
                                        pageNumber={pageNumber}
                                        scale={isMobile ? 0.8 : 1.2}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        loading={
                                            <div style={{
                                                textAlign: 'center',
                                                padding: '100px',
                                                color: '#999'
                                            }}>
                                                페이지 로딩 중...
                                            </div>
                                        }
                                    />
                                </Document>

                                {/* ✅ 페이지 네비게이션 */}
                                <div className="pdf-navigation">
                                    <button
                                        onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                                        disabled={pageNumber <= 1}
                                        className="pdf-nav-button"
                                        style={{
                                            backgroundColor: pageNumber <= 1 ? '#cccccc' : '#007bff'
                                        }}
                                    >
                                        ◀ 이전
                                    </button>

                                    <span className="pdf-page-info">
                        <strong>{pageNumber}</strong> / {numPages}
                    </span>

                                    <button
                                        onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
                                        disabled={pageNumber >= numPages}
                                        className="pdf-nav-button"
                                        style={{
                                            backgroundColor: pageNumber >= numPages ? '#cccccc' : '#007bff'
                                        }}
                                    >
                                        다음 ▶
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // ✅ DRAFT/SENT_TO_EMPLOYEE: HTML 템플릿 + 페이지네이션
                    <>
                        <div className="viewer">
                            <div className="page">
                                {pages[currentPage].content}
                            </div>
                        </div>
                        <div className="pagination-controls">
                            <button onClick={prevPage} disabled={currentPage === 0}>이전</button>
                            <span>
                            {currentPage + 1} / {pages.length}
                        </span>
                            <button
                                onClick={nextPage}
                                disabled={currentPage === pages.length - 1}
                            >
                                다음
                            </button>
                        </div>
                    </>
                )}
                <div className="editor-footer" style={{textAlign: 'center', margin: '20px 0'}}>
                    {/* 1) Draft: 관리자만 */}
                    {(status === 'DRAFT') && isAdmin && (
                        <>
                            <button onClick={goToList} className="btn-list">목록으로</button>
                            <button onClick={handleSave} className="btn-save">임시저장</button>
                            <button onClick={handleInitialSend} className="btn-send">보내기</button>
                            <button onClick={handleDelete} className="btn-delete"
                                    style={{backgroundColor: '#dc3545', color: 'white'}}>
                                삭제
                            </button>
                        </>
                    )}

                    {/* 2) Sent: 직원만 */}
                    {status === 'SENT_TO_EMPLOYEE' && (
                        <>
                            <button onClick={goToList} className="btn-list">목록으로</button>
                            {(currentUser?.permissions?.includes('HR_CONTRACT')) && (
                                <button
                                    onClick={handleDelete}
                                    className="btn-delete"
                                    style={{backgroundColor: '#dc3545', color: 'white'}}
                                >
                                    삭제하기
                                </button>
                            )}
                            <button
                                onClick={handleApprove}
                                className="btn-approve"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? '완료 처리 중...' : '승인하기'}
                            </button>
                        </>
                    )}

                    {/* 3) Returned: 둘다 */}
                    {(status === 'RETURNED_TO_ADMIN') && (
                        <>
                            <button onClick={goToList} className="btn-list">목록으로</button>
                            <button
                                onClick={() => {
                                    setReason(contract?.rejectionReason || '');
                                    setViewRejectReasonModalOpen(true);
                                }}
                                className="btn-view-reason"
                            >
                                반려 사유 확인
                            </button>
                        </>
                    )}

                    {/* 4) Completed: 인쇄만 */}
                    {status === 'COMPLETED' && (
                        <>
                            <button onClick={goToList} className="btn-list">목록으로</button>
                            {(currentUser?.jobLevel === '6' || currentUser?.permissions?.includes('HR_CONTRACT')) && (
                                <button
                                    onClick={() => setRejectModalOpen(true)}
                                    className="btn-reject"
                                    style={{ backgroundColor: '#dc3545', color: 'white', marginLeft: '10px', marginRight: '10px' }}
                                >
                                    취소(반려)
                                </button>
                            )}
                            <button
                                onClick={() => handleDownload('pdf')}
                                className="btn-print"
                            >
                                PDF 다운로드
                            </button>
                        </>
                    )}
                </div>
                </div>
            )}
            <RejectModal
                isOpen={rejectModalOpen}
                onClose={() => setRejectModalOpen(false)}
                onSubmit={handleRejectSubmit}
            />
            <RejectModal
                isOpen={viewRejectReasonModalOpen}
                onClose={() => setViewRejectReasonModalOpen(false)}
                initialReason={reason}
                isReadOnly={true}
                title="반려 사유 확인"
            />
        </Layout>
    );
};

export default EmploymentContract;