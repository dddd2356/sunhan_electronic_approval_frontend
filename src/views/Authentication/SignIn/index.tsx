import React, { ChangeEvent, KeyboardEvent, useRef, useState } from 'react';
import './style.css';
import InputBox from "../../../components/InputBox";
import { SignInRequestDto } from "../../../apis/request/auth";
import { ResponseBody } from "../../../types";
import { SignInResponseDto } from "../../../apis/response/auth";
import { ResponseCode } from "../../../types/enums";
import { useCookies } from "react-cookie";
import { useNavigate } from "react-router-dom";
import { signInRequest } from "../../../apis";
import { LogIn } from 'lucide-react';

export default function SignIn() {
    const idRef = useRef<HTMLInputElement | null>(null);
    const passwdRef = useRef<HTMLInputElement | null>(null);
    const [cookies, setCookie] = useCookies(['accessToken']);
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

        const { token, expiresIn } = responseBody as SignInResponseDto;
        const now = new Date().getTime();
        const expires = new Date(now + expiresIn * 1000);

        localStorage.removeItem('userCache');

        console.log("🔐 토큰 저장 시도:", {
            token: token.substring(0, 20) + "...",
            expiresIn,
            expires: expires.toISOString()
        });

        // ✅ localStorage를 메인 저장소로 사용
        try {
            localStorage.setItem('accessToken', token);
            localStorage.setItem('tokenExpires', expires.toISOString());
            console.log("✅ localStorage에 토큰 저장 완료");
        } catch (e) {
            console.error("❌ localStorage 저장 실패:", e);
            alert("토큰 저장에 실패했습니다.");
            return;
        }

        // 쿠키도 시도 (작동하지 않아도 무방)
        try {
            setCookie('accessToken', token, {
                expires,
                path: '/',
                secure: false,
                sameSite: 'lax'
            });
            console.log("🍪 쿠키 저장 시도 완료 (선택사항)");
        } catch (e) {
            console.log("⚠️ 쿠키 저장 실패 (무시됨):", e);
        }

        // 저장 성공 후 즉시 이동
        console.log("🚀 메인 페이지로 이동");
        navigate('/detail/main-page');
    };


    const onIdChangeHandler = (event: ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target;
        setId(value);
        setMessage('');
    };

    const onPasswordChangeHandler = (event: ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target;
        setPasswd(value);
        setMessage('');
    };

    const onSignInButtonClickHandler = async () => {
        if (!id || !passwd) {
            alert('아이디와 비밀번호 모두 입력하세요.');
            return;
        }

        const trimmedId = id.trim();
        const trimmedPasswd = passwd.trim();

        const requestBody: SignInRequestDto = {
            id: trimmedId,
            passwd: trimmedPasswd
        };

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
                            <InputBox
                                ref={idRef}
                                title='사원번호 (ID)'
                                placeholder='아이디를 입력하세요'
                                type='text'
                                value={id}
                                onChange={onIdChangeHandler}
                                onKeyDown={onIdKeyDownHandler}
                            />
                            <InputBox
                                ref={passwdRef}
                                title='비밀번호 (Password)'
                                placeholder='비밀번호를 입력하세요'
                                type='password'
                                value={passwd}
                                onChange={onPasswordChangeHandler}
                                isErrorMessage
                                message={message}
                                onKeyDown={onPasswordKeyDownHandler}
                            />
                        </div>

                        <div className='sign-in-content-button-box'>
                            <button className='primary-button-lg' onClick={onSignInButtonClickHandler}>
                                <LogIn size={18} style={{marginRight: '8px'}} />
                                로그인
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