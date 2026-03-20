import React, { ChangeEvent, KeyboardEvent, useRef, useState } from 'react';
import './style.css';
import InputBox from "../../../components/InputBox";
import { SignInRequestDto } from "../../../apis/request/auth";
import { ResponseBody } from "../../../types";
import { SignInResponseDto } from "../../../apis/response/auth";
import { ResponseCode } from "../../../types/enums";
import { useNavigate } from "react-router-dom";
import { signInRequest } from "../../../apis";
import { LogIn } from 'lucide-react';

export default function SignIn() {
    const idRef = useRef<HTMLInputElement | null>(null);
    const passwdRef = useRef<HTMLInputElement | null>(null);
    const [id, setId] = useState<string>('');
    const [passwd, setPasswd] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const navigate = useNavigate();

    const signInResponse = (responseBody: ResponseBody<SignInResponseDto>) => {
        if (!responseBody) return;
        const { code } = responseBody;
        if (code === ResponseCode.VALIDATION_FAIL) alert('아이디와 비밀번호를 입력하세요.');
        if (code === ResponseCode.SIGN_IN_FAIL) setMessage('로그인 정보가 일치하지 않습니다.');
        if (code === ResponseCode.DATABASE_ERROR) alert('데이터베이스 오류입니다.');
        if (code !== ResponseCode.SUCCESS) return;

        // 이전 캐시 제거 후 이동 (토큰은 서버가 httpOnly 쿠키로 처리)
        localStorage.removeItem('userCache');
        navigate('/detail/main-page');
    };

    const onIdChangeHandler = (event: ChangeEvent<HTMLInputElement>) => {
        setId(event.target.value);
        setMessage('');
    };

    const onPasswordChangeHandler = (event: ChangeEvent<HTMLInputElement>) => {
        setPasswd(event.target.value);
        setMessage('');
    };

    const onSignInButtonClickHandler = async () => {
        if (!id || !passwd) {
            alert('아이디와 비밀번호 모두 입력하세요.');
            return;
        }
        const requestBody: SignInRequestDto = { id: id.trim(), passwd: passwd.trim() };
        try {
            const response = await signInRequest(requestBody);
            signInResponse(response);
        } catch (error: any) {
            setMessage('서버 연결에 문제가 발생했습니다.');
        }
    };

    const onIdKeyDownHandler = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        if (!passwdRef.current) return;
        passwdRef.current.focus();
    };

    const onPasswordKeyDownHandler = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') onSignInButtonClickHandler();
    };

    return (
        <div id='sign-in-wrapper'>
            <div className='sign-in-image'></div>
            <div className='sign-in-container'>
                <div className='sign-in-box'>
                    <div className="sign-in-header">
                        <div className='sign-in-title'>Welcome Back</div>
                        <div className='sign-in-subtitle'>선한병원 전자결재 시스템에 로그인하세요.</div>
                    </div>
                    <div className='sign-in-content-box'>
                        <div className='sign-in-content-input-box'>
                            <InputBox ref={idRef} title='사원번호 (ID)' placeholder='아이디를 입력하세요'
                                      type='text' value={id} onChange={onIdChangeHandler} onKeyDown={onIdKeyDownHandler} />
                            <InputBox ref={passwdRef} title='비밀번호 (Password)' placeholder='비밀번호를 입력하세요'
                                      type='password' value={passwd} onChange={onPasswordChangeHandler}
                                      isErrorMessage message={message} onKeyDown={onPasswordKeyDownHandler} />
                        </div>
                        <div className='sign-in-content-button-box'>
                            <button className='primary-button-lg' onClick={onSignInButtonClickHandler}>
                                <LogIn size={18} style={{marginRight: '8px'}} /> 로그인
                            </button>
                        </div>
                    </div>
                    <div className="sign-in-footer">
                        © {new Date().getFullYear()} 선한병원 전산팀. All rights reserved.
                    </div>
                </div>
            </div>
        </div>
    );
}