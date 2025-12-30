import Layout from '../../../components/Layout';
import React, { useEffect, useState } from "react";
import "./style.css";
import ProfileCompletionPopup from "../../../components/ProfileCompletionPopup";
import { useCookies } from "react-cookie";
import VacationHistoryPopup from "../../../components/VacationHistoryPopup";
import ReportsModal from "../../../components/ReportsModal";
import axios from "axios";
import { RefreshCw, Calendar, User, ClipboardList, Settings, FileText, Bell, Clock, AlertTriangle, Home, Smartphone } from 'lucide-react';

// --- 원본 인터페이스 유지 ---
interface UserProfile {
    userId: string;
    userName: string;
    phone: string | null;
    address: string | null;
    detailAddress: string | null;
    passwordChangeRequired: boolean;
    deptCode?: string;
    jobType?: string;
    jobLevel?: string;
    useFlag?: string;
    totalVacationDays?: number;
    usedVacationDays?: number;
    privacyConsent?: boolean;
    notificationConsent?: boolean;
}

interface ContractStatus {
    id: number;
    title: string;
    status: 'DRAFT' | 'SENT_TO_EMPLOYEE' | 'SIGNED_BY_EMPLOYEE' | 'RETURNED_TO_ADMIN' | 'COMPLETED' | 'DELETED';
    createdAt: string;
    updatedAt: string;
}

interface VacationHistory {
    id: number;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
    status: 'APPROVED' | 'PENDING' | 'REJECTED';
    createdDate: string;
}

interface VacationStatus {
    userId: string;
    userName: string;
    totalVacationDays: number;
    usedVacationDays: number;
    remainingVacationDays: number;
}

interface RecentActivity {
    type: 'vacation' | 'contract' | 'workSchedule';
    id: number;
    title: string;
    date: string;
    status: string;
}

interface WorkScheduleStatus {
    id: number;
    title: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    updatedAt: string;
    scheduleYearMonth?: string;
}

const MainPage: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const [currentTime] = useState(new Date());

    const [vacationStatus, setVacationStatus] = useState<VacationStatus | null>(null);
    const [vacationHistory, setVacationHistory] = useState<VacationHistory[]>([]);
    const [loadingVacation, setLoadingVacation] = useState(true);
    const [vacationError, setVacationError] = useState('');

    const [showHistoryPopup, setShowHistoryPopup] = useState(false);
    const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [activitiesError, setActivitiesError] = useState('');

    const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
    const [departmentNames, setDepartmentNames] = useState<Record<string, string>>({});
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // --- 원본 헬퍼 함수 유지 ---
    const handleRefreshVacation = () => setRefreshTrigger(prev => prev + 1);
    const handleShowHistoryPopup = () => setShowHistoryPopup(true);
    const handleCloseHistoryPopup = () => setShowHistoryPopup(false);

    const mapStatusToSimpleKorean = (status: string): string => {
        switch (status) {
            case 'DRAFT': return '작성중';
            case 'SENT_TO_EMPLOYEE': case 'SUBMITTED':
            case 'PENDING_SUBSTITUTE': case 'PENDING_DEPT_HEAD':
            case 'PENDING_CENTER_DIRECTOR': case 'PENDING_ADMIN_DIRECTOR':
            case 'PENDING_CEO_DIRECTOR': case 'PENDING_HR_STAFF':
                return '진행중';
            case 'SIGNED_BY_EMPLOYEE': case 'COMPLETED': case 'APPROVED':
                return '완료';
            case 'RETURNED_TO_ADMIN': case 'REJECTED': case 'DELETED':
                return '반려/취소';
            default: return '알 수 없음';
        }
    };

    const getPositionByJobLevel = (jobLevel: string | undefined): string => {
        const level = String(jobLevel);
        switch (level) {
            case '0': return '사원';
            case '1': return '부서장';
            case '2': return '진료센터장';
            case '3': return '원장';
            case '4': return '행정원장';
            case '5': return '대표원장';
            default: return '';
        }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "좋은 아침입니다";
        if (hour < 18) return "좋은 오후입니다";
        return "좋은 저녁입니다";
    };

    const formatDateRange = (startDate: string, endDate: string) => {
        const start = new Date(startDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        const end = new Date(endDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        return `${start} ~ ${end}`;
    };

    // --- API 호출 로직 (원본 경로 및 조건 유지) ---
    useEffect(() => {
        const fetchDepartmentNames = async () => {
            try {
                const response = await axios.get('/api/v1/departments/names', {
                    headers: { Authorization: `Bearer ${cookies.accessToken}` }
                });
                setDepartmentNames(response.data);
            } catch (error) { console.error('부서 이름 조회 실패:', error); }
        };
        if (cookies.accessToken) fetchDepartmentNames();
    }, [cookies.accessToken]);

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!cookies.accessToken) { setLoadingUser(false); return; }
            try {
                setLoadingUser(true);
                const response = await fetch(`/api/v1/user/me`, {
                    headers: { 'Authorization': `Bearer ${cookies.accessToken}` }
                });
                if (response.status === 401) { setLoadingUser(false); return; }
                const data: UserProfile = await response.json();
                setUserProfile(data);

                const isPhoneMissing = !data.phone || data.phone.trim() === '';
                const isAddressMissing = !data.address || data.address.trim() === '';
                if (data.passwordChangeRequired || isPhoneMissing || isAddressMissing) {
                    setShowProfilePopup(true);
                }
            } catch (err: any) { setFetchError(err.message || '정보 로딩 중 오류 발생'); }
            finally { setLoadingUser(false); }
        };
        fetchUserProfile();
    }, [cookies.accessToken]);

    useEffect(() => {
        const fetchVacationData = async () => {
            if (!cookies.accessToken || !userProfile) return;
            try {
                setLoadingVacation(true);
                const timestamp = new Date().getTime();
                const statusRes = await fetch(`/api/v1/vacation/my-status`, {
                    headers: { 'Authorization': `Bearer ${cookies.accessToken}`, 'Cache-Control': 'no-cache' }
                });
                if (statusRes.ok) setVacationStatus(await statusRes.json());

                const historyRes = await fetch(`/api/v1/vacation/my-history?_t=${timestamp}`, {
                    headers: { 'Authorization': `Bearer ${cookies.accessToken}`, 'Cache-Control': 'no-cache' }
                });
                if (historyRes.ok) setVacationHistory(await historyRes.json());
            } catch (err) { setVacationError('휴가 정보를 불러오는데 실패했습니다.'); }
            finally { setLoadingVacation(false); }
        };
        fetchVacationData();
    }, [userProfile, cookies.accessToken, refreshTrigger]);

    useEffect(() => {
        const fetchRecentActivities = async () => {
            if (!cookies.accessToken || !userProfile) return;
            try {
                setLoadingActivities(true);
                const [vacRes, conRes, workRes] = await Promise.all([
                    fetch(`/api/v1/vacation/my-history`, { headers: { 'Authorization': `Bearer ${cookies.accessToken}` } }),
                    fetch(`/api/v1/employment-contract/my-status`, { headers: { 'Authorization': `Bearer ${cookies.accessToken}` } }),
                    fetch(`/api/v1/work-schedules/my-status`, { headers: { 'Authorization': `Bearer ${cookies.accessToken}` } })
                ]);

                const vacData: VacationHistory[] = vacRes.ok ? await vacRes.json() : [];
                const conData: ContractStatus[] = conRes.ok ? await conRes.json() : [];
                const workData: WorkScheduleStatus[] = workRes.ok ? await workRes.json() : [];

                const combined = [
                    ...vacData.map(v => ({ type: 'vacation', id: v.id, title: '휴가원', date: v.createdDate, status: mapStatusToSimpleKorean(v.status) })),
                    ...conData.map(c => ({ type: 'contract', id: c.id, title: '근로계약서', date: c.updatedAt, status: mapStatusToSimpleKorean(c.status) })),
                    ...workData.map(w => ({ type: 'workSchedule', id: w.id, title: '근무현황표', date: w.updatedAt, status: mapStatusToSimpleKorean(w.status) }))
                ] as RecentActivity[];

                setRecentActivities(combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3));
            } catch { setActivitiesError('최근 활동을 불러오는데 실패했습니다.'); }
            finally { setLoadingActivities(false); }
        };
        fetchRecentActivities();
    }, [userProfile, cookies.accessToken]);

    // 포커스 자동 갱신
    useEffect(() => {
        const handleFocus = () => setRefreshTrigger(prev => prev + 1);
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    const handleProfileUpdateSuccess = (updatedUser: UserProfile) => {
        setUserProfile(updatedUser);
        setShowProfilePopup(false);
        alert('프로필 정보가 성공적으로 업데이트되었습니다.');
    };

    const handleClosePopup = () => {
        if (userProfile?.passwordChangeRequired || !userProfile?.phone || !userProfile?.address) return;
        setShowProfilePopup(false);
    };

    // 연차 계산기
    const total = vacationStatus?.totalVacationDays || 15;
    const used = vacationStatus?.usedVacationDays || 0;
    const remaining = vacationStatus?.remainingVacationDays || total;
    const usagePercent = total > 0 ? (used / total) * 100 : 0;

    if (loadingUser) {
        return (
            <Layout>
                <div className="mp-loading-container">
                    <div className="loading">로딩중...</div>
                </div>
            </Layout>
        );
    }
    return (
        <Layout>
            <div id="mp-page-wrapper">
                <div className="mp-container">
                    {/* 환영 헤더 */}
                    <header className="mp-dashboard-header">
                        <div className="mp-welcome-text">
                            <h1 className="mp-welcome-title">{getGreeting()}, {userProfile?.userName || '사용자'}님!</h1>
                            <p className="mp-welcome-subtitle">선한병원 스마트 전자결재 시스템 메인 대시보드입니다.</p>
                        </div>
                    </header>

                    <div className="mp-content-grid">
                        <div className="mp-left-column">
                            {/* 인사 정보 카드 */}
                            <section className="mp-card mp-user-info-card">
                                <h2 className="mp-card-title"><User size={20} className="icon-blue"/> 내 인사 정보</h2>
                                <div className="mp-info-grid">
                                    <div className="mp-info-item">
                                        <div className="info-icon-circle"><User size={18}/></div>
                                        <div className="info-content">
                                            <span className="label">성명 / 사번</span>
                                            <span className="value">{userProfile?.userName} ({userProfile?.userId})</span>
                                        </div>
                                    </div>
                                    <div className="mp-info-item">
                                        <div className="info-icon-circle"><Home size={18}/></div>
                                        <div className="info-content">
                                            <span className="label">부서 / 직급</span>
                                            <span className="value">
                                                {(userProfile?.deptCode ? (departmentNames[userProfile.deptCode] ?? userProfile.deptCode) : '미등록')}
                                                {userProfile?.jobLevel ? ` / ${getPositionByJobLevel(userProfile.jobLevel)}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`mp-info-item ${!userProfile?.phone ? 'missing' : ''}`}>
                                        <div className="info-icon-circle"><Smartphone size={18}/></div>
                                        <div className="info-content">
                                            <span className="label">연락처</span>
                                            <span className="value">{userProfile?.phone || '미등록'}</span>
                                        </div>
                                        {!userProfile?.phone && <span className="error-dot">!</span>}
                                    </div>
                                </div>
                            </section>

                            {/* 알림 섹션 (필요시에만 노출) */}
                            {(userProfile?.passwordChangeRequired || !userProfile?.phone || !userProfile?.address) && (
                                <section className="mp-alert-card">
                                    <div className="mp-alert-icon"><AlertTriangle size={24}/></div>
                                    <div className="mp-alert-body">
                                        <h3 className="mp-alert-title">필수 정보 업데이트 필요</h3>
                                        <p className="mp-alert-msg">누락된 개인정보 등록 또는 비밀번호 변경이 필요합니다.</p>
                                        <button className="mp-alert-btn" onClick={() => setShowProfilePopup(true)}>수정하기</button>
                                    </div>
                                </section>
                            )}

                            {/* 연차 관리 카드 */}
                            <section className="mp-card mp-vacation-card">
                                <div className="mp-vacation-header">
                                    <h2 className="mp-card-title"><Calendar size={20} className="icon-green"/> 연차 현황</h2>
                                    <button
                                        className={`mp-refresh-btn ${loadingVacation ? 'spinning' : ''}`}
                                        onClick={handleRefreshVacation}
                                        disabled={loadingVacation}
                                    >
                                        <RefreshCw size={18}/>
                                    </button>
                                </div>

                                {loadingVacation ? (
                                    <div className="inner-loader">로딩 중...</div>
                                ) : (
                                    <>
                                        <div className="mp-stats-row">
                                            <div className="mp-stat-box">
                                                <span className="stat-label">총 연차</span>
                                                <span className="stat-value">{total}</span>
                                            </div>
                                            <div className="mp-stat-box highlight">
                                                <span className="stat-label">사용</span>
                                                <span className="stat-value">{used}</span>
                                            </div>
                                            <div className="mp-stat-box">
                                                <span className="stat-label">잔여</span>
                                                <span className="stat-value text-green">{remaining}</span>
                                            </div>
                                        </div>

                                        <div className="mp-progress-section">
                                            <div className="progress-labels">
                                                <span>연차 사용률</span>
                                                <span className="fw-bold">{Math.round(usagePercent)}%</span>
                                            </div>
                                            <div className="progress-bar-bg">
                                                <div className="progress-bar-fill" style={{ width: `${Math.min(usagePercent, 100)}%` }}></div>
                                            </div>
                                        </div>

                                        <div className="mp-recent-history">
                                            <div className="history-header">
                                                <span className="history-title">최근 사용 내역</span>
                                                <button onClick={handleShowHistoryPopup}>전체보기</button>
                                            </div>
                                            <div className="history-list">
                                                {vacationHistory.length > 0 ? (
                                                    vacationHistory.slice(0, 3).map((v, i) => (
                                                        <div key={i} className="history-item">
                                                            <span className="h-date">{formatDateRange(v.startDate, v.endDate)}</span>
                                                            <span className="h-days">{v.days}일</span>
                                                            <span className={`h-status ${v.status}`}>{mapStatusToSimpleKorean(v.status)}</span>
                                                        </div>
                                                    ))
                                                ) : <div className="empty-msg">기록이 없습니다.</div>}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </section>
                        </div>

                        <div className="mp-right-column">
                            {/* 퀵 액션 */}
                            <section className="mp-card">
                                <h2 className="mp-card-title"><ClipboardList size={20}/> 퀵 액션</h2>
                                <div className="mp-action-grid">
                                    <button className="mp-action-btn" onClick={() => setShowProfilePopup(true)}>
                                        <Settings size={22} />
                                        <span>정보 수정</span>
                                    </button>
                                    <button className="mp-action-btn" onClick={() => setIsReportsModalOpen(true)}>
                                        <FileText size={22} />
                                        <span>문서 관리</span>
                                    </button>
                                    <button className="mp-action-btn" onClick={handleShowHistoryPopup}>
                                        <Clock size={22} />
                                        <span>휴가 기록</span>
                                    </button>
                                    <button className="mp-action-btn primary" onClick={() => window.location.href='/detail/leave-application'}>
                                        <Calendar size={22} />
                                        <span>휴가 신청</span>
                                    </button>
                                </div>
                            </section>

                            {/* 최근 활동 */}
                            <section className="mp-card">
                                <h2 className="mp-card-title"><Bell size={20} className="icon-orange"/> 최근 활동</h2>
                                <div className="mp-activity-list">
                                    <div className="activity-item login">
                                        <div className="activity-dot"></div>
                                        <div className="activity-info">
                                            <span className="act-title">로그인</span>
                                            <span className="act-time">오늘</span>
                                        </div>
                                    </div>
                                    {loadingActivities ? <div className="inner-loader">활동 로딩 중...</div> :
                                        recentActivities.length > 0 ? recentActivities.map(act => (
                                            <div key={act.id} className={`activity-item ${act.type}`}>
                                                <div className="activity-dot"></div>
                                                <div className="activity-info">
                                                    <span className="act-title">{act.title}</span>
                                                    <span className="act-desc">상태: {act.status}</span>
                                                    <span className="act-time">{new Date(act.date).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        )) : <div className="empty-msg">최근 활동이 없습니다.</div>}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>

            {/* 팝업들 - Props 구조 원본 유지 */}
            {userProfile && (
                <ProfileCompletionPopup
                    isOpen={showProfilePopup}
                    onClose={handleClosePopup}
                    onUpdateSuccess={handleProfileUpdateSuccess}
                    userId={userProfile.userId}
                    initialPhone={userProfile.phone}
                    initialAddress={userProfile.address}
                    initialDetailAddress={userProfile.detailAddress}
                    initialPrivacyConsent={userProfile.privacyConsent}
                    initialNotificationConsent={userProfile.notificationConsent}
                    requirePasswordChange={userProfile.passwordChangeRequired}
                />
            )}

            <VacationHistoryPopup
                isOpen={showHistoryPopup}
                onClose={handleCloseHistoryPopup}
                vacationHistory={vacationHistory}
            />

            <ReportsModal
                isOpen={isReportsModalOpen}
                onClose={() => setIsReportsModalOpen(false)}
            />
        </Layout>
    );
};

export default MainPage;