import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCookies } from 'react-cookie';
import axios from 'axios';
import './style.css';
import defaultProfileImage from './assets/images/profile.png';

// 아이콘 라이브러리 도입
import {
    Home,
    FileText,
    Calendar,
    ClipboardList,
    Users,
    ShieldCheck,
    BarChart3,
    RefreshCcw,
    UserCircle,
    LogOut, Shield, FileSignature, UserPlus, Building
} from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
    const navigate = useNavigate();
    const location = useLocation(); // 현재 URL 경로 파악용
    const [cookies, , removeCookie] = useCookies(["accessToken"]);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;

    const [profileName, setProfileName] = useState<string>('사용자');
    const [profileDepartment, setProfileDepartment] = useState<string>('');
    const [profileImage, setProfileImage] = useState<string>('');
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [jobLevel, setJobLevel] = useState<number>(0);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [canCreateConsent, setCanCreateConsent] = useState<boolean>(false);
    const [canManageConsent, setCanManageConsent] = useState<boolean>(false);

    const API_BASE_URL = process.env.REACT_APP_API_URL;

    // 현재 페이지 활성화 체크 함수
    const isActive = (path: string) => location.pathname === path;


    useEffect(() => {
        const currentToken = localStorage.getItem('accessToken') || cookies.accessToken;

        if (!currentToken) {
            console.log('⚠️ Sidebar: accessToken 없음');
            localStorage.removeItem('userCache');
            return;
        }

        // 1️⃣ 캐시만 로드 (API 호출 제거)
        const cachedUser = localStorage.getItem('userCache');
        if (cachedUser) {
            try {
                const userData = JSON.parse(cachedUser);
                // ✅ 캐시된 토큰과 현재 토큰 비교 (불일치하면 캐시 무효화)
                const cachedToken = localStorage.getItem('cachedTokenHash');
                const currentTokenHash = currentToken.substring(0, 50); // 토큰 일부를 해시로 사용

                if (cachedToken !== currentTokenHash) {
                    console.log('🔄 토큰 변경 감지 - 캐시 무효화');
                    localStorage.removeItem('userCache');
                    localStorage.removeItem('cachedTokenHash');
                    checkUserStatus();
                    checkConsentPermissions();
                    return;
                }

                console.log('📦 Sidebar: 캐시된 데이터 로드:', userData);

                setProfileName(userData.userName || '사용자');
                setProfileDepartment(userData.deptName || '');
                setJobLevel(Number(userData.jobLevel) || 0);
                setIsAdmin(userData.role === 'ADMIN');
                setPermissions(userData.permissions || []);

                console.log('✅ Sidebar: 캐시 복원 완료');

                // ✅ 프로필 이미지만 별도 로드
                if (userData.userId) {
                    fetchProfileImage(userData.userId);
                }

                // ✅ 동의서 권한만 별도 확인 (캐시 없으면)
                if (!userData.consentPermissions) {
                    checkConsentPermissions();
                } else {
                    setCanCreateConsent(userData.consentPermissions.canCreate);
                    setCanManageConsent(userData.consentPermissions.canManage);
                }

                return; // ✅ API 호출 생략
            } catch (e) {
                console.error('❌ Sidebar: 캐시 파싱 실패:', e);
                localStorage.removeItem('userCache');
            }
        }

        // 2️⃣ 캐시 없으면만 API 호출
        checkUserStatus();
        checkConsentPermissions();
    }, [token]); // ✅ 빈 배열 유지

    const checkUserStatus = () => {
        const token = localStorage.getItem('accessToken') || cookies.accessToken;
        axios.get(`${API_BASE_URL}/user/me`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => {
                const userData = res.data;
                console.log("📥 받은 사용자 데이터:", userData);
                console.log("🔍 타입 확인:", {
                    jobLevel: userData.jobLevel,
                    jobLevelType: typeof userData.jobLevel,
                    role: userData.role,
                    roleType: typeof userData.role
                });

                // ✅ 수정된 매핑
                setProfileName(userData.userName || '사용자');
                setProfileDepartment(userData.deptName || userData.deptCode || ''); // deptName 우선

                // ⚠️ jobLevel 처리 개선
                const level = userData.jobLevel ?? userData.joblevel ?? 0; // 대소문자 모두 체크
                setJobLevel(Number(level));

                // ⚠️ role 처리 개선
                setIsAdmin(userData.role === 'ADMIN');

                // ⚠️ permissions 처리 개선
                setPermissions(Array.isArray(userData.permissions) ? userData.permissions : []);

                console.log("✅ State 업데이트 완료:", {
                    name: userData.userName,
                    dept: userData.deptName || userData.deptCode,
                    level: Number(level),
                    isAdmin: userData.role === 'ADMIN',
                    permissions: userData.permissions
                });

                // 캐시 저장
                localStorage.setItem('userCache', JSON.stringify({
                    userName: userData.userName,
                    deptName: userData.deptName || userData.deptCode,
                    jobLevel: Number(level),
                    role: userData.role,
                    permissions: userData.permissions || [],
                    userId: userData.userId
                }));
                // ✅ 현재 토큰 해시도 함께 저장
                const currentTokenHash = (localStorage.getItem('accessToken') || cookies.accessToken || '').substring(0, 50);
                localStorage.setItem('cachedTokenHash', currentTokenHash);
                if (userData.userId) fetchProfileImage(userData.userId);
            })
            .catch((err) => {
                console.error('❌ 사용자 정보 로드 실패', err);
                console.error('응답:', err.response?.data);
            });
    };

    const fetchProfileImage = (userId: string) => {
        if (userId === 'administrator') {
            setProfileImage(defaultProfileImage);
            return;
        }
        axios.get(`${API_BASE_URL}/user/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => {
                const imageData = res.data?.profile_image;
                setProfileImage(imageData ? `data:image/png;base64,${imageData}` : defaultProfileImage);
            })
            .catch(() => setProfileImage(defaultProfileImage));
    };

    const handleLogout = async () => {
        const token = localStorage.getItem('accessToken') || cookies.accessToken;

        try {
            await axios.post(`${API_BASE_URL}/auth/logout/web`, {}, {
                headers: { "Authorization": `Bearer ${token}` },
                withCredentials: true
            });
        } finally {
            // ✅ 모든 저장소 클리어
            removeCookie("accessToken", {
                path: "/",
                secure: false,
                sameSite: "lax"
            });
            localStorage.removeItem('accessToken');
            localStorage.removeItem('tokenExpires');
            localStorage.removeItem('userCache');
            localStorage.removeItem('cachedTokenHash');
            navigate("/");
        }
    };

    // 권한 계산
    const canViewContractMemoAdmin = (permissions.includes('HR_CONTRACT')) || jobLevel === 6;
    const canViewVacationAdmin = (permissions.includes('HR_LEAVE_APPLICATION')) || jobLevel === 6;
    const canCreatePositionAdmin = jobLevel === 6 || permissions.includes("WORK_SCHEDULE_CREATE");
// ✅ 동의서 권한 체크 추가
    const checkConsentPermissions = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/consents/permissions`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setCanCreateConsent(response.data.canCreate);
            setCanManageConsent(response.data.canManage);

            // ✅ 캐시에 권한 정보 추가
            const cached = localStorage.getItem('userCache');
            if (cached) {
                const userData = JSON.parse(cached);
                userData.consentPermissions = {
                    canCreate: response.data.canCreate,
                    canManage: response.data.canManage
                };
                localStorage.setItem('userCache', JSON.stringify(userData));
            }
        } catch (error) {
            console.error('동의서 권한 확인 실패:', error);
        }
    };

    useEffect(() => {
        console.log("현재 직급(jobLevel):", jobLevel, typeof jobLevel);
        console.log("보유 권한(permissions):", permissions);
        console.log("관리자 여부(isAdmin):", isAdmin);
    }, [jobLevel, permissions, isAdmin]);

    return (
        <div className={`sidebar ${isOpen ? "active" : ""}`}>
            {/* 1. 프로필 섹션 */}
            <div className="profile-section">
                <div className="profile-header">
                    <img src={profileImage || defaultProfileImage} alt="Profile" className="profile-img"/>
                    <div className="profile-info">
                        <div className="profile-name">{profileName}</div>
                        <div className="profile-title">{profileDepartment}</div>
                    </div>
                </div>
                <div className="profile-buttons">
                    <button className="info-button" onClick={() => navigate("/detail/my-page")}>
                        <UserCircle size={14} style={{marginRight: '4px'}} /> 정보
                    </button>
                    <button className="logout-button" onClick={handleLogout}>
                        <LogOut size={14} style={{marginRight: '4px'}} /> 로그아웃
                    </button>
                </div>
            </div>

            {/* 2. 메인 메뉴 섹션 */}
            <ul className="main-menu">
                <div className="menu-section-label">General</div>

                <li onClick={() => navigate('/detail/main-page')}
                    className={`menu-item ${isActive('/detail/main-page') ? 'active' : ''}`}>
                    <Home size={18}/> <span>메인 화면</span>
                </li>

                {/* ✅ 동의서 메뉴 추가 */}
                <li onClick={() => navigate('/detail/consent/my-list')}
                    className={`menu-item ${isActive('/detail/consent/my-list') ? 'active' : ''}`}>
                    <FileSignature size={18}/> <span>동의서</span>
                </li>

                <li onClick={() => navigate('/detail/employment-contract')}
                    className={`menu-item ${isActive('/detail/employment-contract') ? 'active' : ''}`}>
                    <FileText size={18}/> <span>근로계약서</span>
                </li>

                <li onClick={() => navigate('/detail/leave-application')}
                    className={`menu-item ${isActive('/detail/leave-application') ? 'active' : ''}`}>
                    <Calendar size={18}/> <span>휴가원</span>
                </li>

                <li onClick={() => navigate('/detail/work-schedule')}
                    className={`menu-item ${isActive('/detail/work-schedule') ? 'active' : ''}`}>
                    <ClipboardList size={18}/> <span>근무현황표</span>
                </li>

                <li onClick={() => navigate('/detail/approval-lines')}
                    className={`menu-item ${isActive('/detail/approval-lines') ? 'active' : ''}`}>
                    <ShieldCheck size={18}/> <span>결재라인 관리</span>
                </li>

                {/* 3. 관리자 메뉴 섹션 (조건부 렌더링) */}
                {(isAdmin) && (
                    <>
                        <div className="menu-section-label">Administration</div>

                        {isAdmin && jobLevel >= 1 && (
                            <li onClick={() => navigate('/admin/dashboard')}
                                className={`menu-item admin ${isActive('/admin/dashboard') ? 'active' : ''}`}>
                                <ShieldCheck size={18}/> <span>권한 관리자</span>
                            </li>
                        )}

                        {/* ✅ 회원 등록 메뉴 (MANAGE_USERS 권한) */}
                        {permissions.includes('MANAGE_USERS') && (
                            <li onClick={() => navigate('/admin/users/register')}
                                className={`menu-item admin ${isActive('/admin/users/register') ? 'active' : ''}`}>
                                <UserPlus size={18}/> <span>회원 등록</span>
                            </li>
                        )}

                        {/* ✅ 부서 관리 메뉴 (MANAGE_USERS 권한) */}
                        {permissions.includes('MANAGE_USERS') && (
                            <li onClick={() => navigate('/admin/departments/manage')}
                                className={`menu-item admin ${isActive('/admin/departments/manage') ? 'active' : ''}`}>
                                <Building size={18}/> <span>부서 관리</span>
                            </li>
                        )}

                        {/* ✅ 동의서 발송 메뉴 (생성 권한) */}
                        {canCreateConsent && (
                            <>
                                <li onClick={() => navigate('/admin/consent/issue')}
                                    className={`menu-item admin ${isActive('/admin/consent/issue') ? 'active' : ''}`}>
                                    <FileSignature size={18}/> <span>동의서 발송</span>
                                </li>
                                <li onClick={() => navigate('/admin/consent/my-issued')}
                                    className={`menu-item admin ${isActive('/admin/consent/my-issued') ? 'active' : ''}`}>
                                    <FileText size={18}/> <span>발송 현황</span>
                                </li>
                            </>
                        )}

                        {/* ✅ 동의서 관리 메뉴 (관리 권한) */}
                        {canManageConsent && (
                        <li onClick={() => navigate('/admin/consent/management')}
                            className={`menu-item admin ${isActive('/admin/consent/management') ? 'active' : ''}`}>
                                    <BarChart3 size={18}/> <span>동의서 관리</span>
                                </li>
                        )}

                        {canViewContractMemoAdmin && (
                            <li onClick={() => navigate('/admin/memo-management')}
                                className={`menu-item admin ${isActive('/admin/memo-management') ? 'active' : ''}`}>
                            <BarChart3 size={18}/> <span>근로계약서 메모 관리</span>
                            </li>
                        )}

                        {canViewVacationAdmin && (
                            <>
                                <li onClick={() => navigate('/admin/vacation')}
                                    className={`menu-item admin ${isActive('/admin/vacation') ? 'active' : ''}`}>
                                    <BarChart3 size={18}/> <span>휴가원 관리</span>
                                </li>
                                <li onClick={() => navigate('/admin/vacation-statistics')}
                                    className={`menu-item admin ${isActive('/admin/vacation-statistics') ? 'active' : ''}`}>
                                    <BarChart3 size={18}/> <span>휴가 통계</span>
                                </li>
                            </>
                        )}

                        {canCreatePositionAdmin && (
                            <li onClick={() => navigate('/detail/positions')}
                                className={`menu-item admin ${isActive('/detail/positions') ? 'active' : ''}`}>
                                <Users size={18}/> <span>직책 관리</span>
                            </li>
                        )}
                    </>
                )}
            </ul>
        </div>
    );
};

export default Sidebar;