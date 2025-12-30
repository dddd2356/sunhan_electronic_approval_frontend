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
    LogOut
} from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
    const navigate = useNavigate();
    const location = useLocation(); // 현재 URL 경로 파악용
    const [cookies, , removeCookie] = useCookies(["accessToken"]);

    const [profileName, setProfileName] = useState<string>('사용자');
    const [profileDepartment, setProfileDepartment] = useState<string>('');
    const [profileImage, setProfileImage] = useState<string>('');
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [jobLevel, setJobLevel] = useState<number>(0);
    const [permissions, setPermissions] = useState<string[]>([]);

    const API_BASE_URL = process.env.REACT_APP_API_URL;

    // 현재 페이지 활성화 체크 함수
    const isActive = (path: string) => location.pathname === path;

    useEffect(() => {
        if (cookies.accessToken) {
            checkUserStatus();
        }
    }, [cookies.accessToken]);

    const checkUserStatus = () => {
        axios.get(`${API_BASE_URL}/user/me`, {
            headers: { Authorization: `Bearer ${cookies.accessToken}` },
        })
            .then((res) => {
                const userData = res.data;
                setProfileName(userData.userName || '사용자');
                setProfileDepartment(userData.dept || '');
                setJobLevel(userData.jobLevel || 0);
                setIsAdmin(userData.role === 'ADMIN');
                setPermissions(userData.permissions || []);

                if (userData.userId) fetchProfileImage(userData.userId);
            })
            .catch((err) => console.error('사용자 정보 로드 실패', err));
    };

    const fetchProfileImage = (userId: string) => {
        if (userId === 'administrator') {
            setProfileImage(defaultProfileImage);
            return;
        }
        axios.get(`${API_BASE_URL}/user/${userId}`, {
            headers: { Authorization: `Bearer ${cookies.accessToken}` },
        })
            .then((res) => {
                const imageData = res.data?.profile_image;
                setProfileImage(imageData ? `data:image/png;base64,${imageData}` : defaultProfileImage);
            })
            .catch(() => setProfileImage(defaultProfileImage));
    };

    const handleLogout = async () => {
        try {
            await axios.post(`${API_BASE_URL}/auth/logout/web`, {}, {
                headers: { "Authorization": `Bearer ${cookies.accessToken}` },
                withCredentials: true
            });
        } finally {
            removeCookie("accessToken", { path: "/", secure: true, sameSite: "none" });
            navigate("/");
        }
    };

    // 권한 계산
    const canViewVacationAdmin = (permissions.includes('HR_LEAVE_APPLICATION')) || jobLevel === 6;
    const canCreatePositionAdmin = jobLevel === 6 || permissions.includes("WORK_SCHEDULE_CREATE");


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
                {(isAdmin || canViewVacationAdmin || canCreatePositionAdmin) && (
                    <>
                        <div className="menu-section-label">Administration</div>

                        {isAdmin && jobLevel >= 1 && (
                            <li onClick={() => navigate('/admin/dashboard')}
                                className={`menu-item admin ${isActive('/admin/dashboard') ? 'active' : ''}`}>
                                <ShieldCheck size={18}/> <span>권한 관리자</span>
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

                        {isAdmin && (
                            <li onClick={() => navigate('/admin/sync-management-dashboard')}
                                className={`menu-item admin ${isActive('/admin/sync-management-dashboard') ? 'active' : ''}`}>
                                <RefreshCcw size={18}/> <span>데이터 동기화</span>
                            </li>
                        )}
                    </>
                )}
            </ul>
        </div>
    );
};

export default Sidebar;