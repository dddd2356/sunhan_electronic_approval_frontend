import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import Layout from '../Layout';
import './style.css';
import OrganizationChart from "../OrganizationChart";

interface User {
    userId: string;
    userName: string;
    totalVacationDays?: number;
    usedVacationDays?: number;
    deptCode?: string;
    jobLevel?: string;
}

interface VacationStatus {
    userId: string;
    userName: string;
    deptName: string;
    year: number;
    annualCarryoverDays?: number;
    annualRegularDays?: number;
    annualTotalDays?: number;
    annualUsedDays?: number;
    annualRemainingDays?: number;
    usedCarryoverDays?: number;
    usedRegularDays?: number;
    // 하위 호환
    totalVacationDays: number;
    usedVacationDays: number;
    remainingVacationDays: number;
}

const AdminVacationManagement: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [vacationStatus, setVacationStatus] = useState<VacationStatus | null>(null);
    const [totalDays, setTotalDays] = useState<number>(15);
    const [updating, setUpdating] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [deptNameMap, setDeptNameMap] = useState<Map<string, string>>(new Map());

    const [annualCarryover, setAnnualCarryover] = useState<number>(0);
    const [annualRegular, setAnnualRegular] = useState<number>(15);
    const [vacationModalOpen, setVacationModalOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [recalculating, setRecalculating] = useState(false);

    useEffect(() => {
        fetchDepartmentNames();
        fetchUsers(selectedYear);
    }, []);

    const handleOrgUserSelect = (userId: string, userName: string, jobLevel: string) => {
        const userObj: User = { userId, userName, jobLevel };
        setSelectedUser(userObj);
        fetchVacationStatus(userId);
    };

    const fetchUsers = async (year?: number) => {
        try {
            setLoading(true);
            setError('');

            const targetYear = year ?? selectedYear;

            const response = await fetch(
                `/api/v1/admin/users?year=${targetYear}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            } else {
                throw new Error('사용자 목록을 가져오는데 실패했습니다.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRecalculateHistory = async () => {
        if (!window.confirm(`${selectedYear}년도 모든 사용자의 연차 히스토리를 재계산하시겠습니까?\n\n이 작업은 user_annual_vacation_history 테이블의 used_carryover_days와 used_regular_days를 실제 승인된 휴가원 기준으로 재계산합니다.`)) {
            return;
        }

        try {
            setRecalculating(true);
            setError('');

            const response = await fetch(
                `/api/v1/vacation/admin/recalculate-history?year=${selectedYear}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setSuccessMessage(`✅ ${data.year}년도 ${data.updatedCount}명의 연차 히스토리가 재계산되었습니다.`);

                // 화면 새로고침
                await fetchUsers(selectedYear);
                if (selectedUser) {
                    await fetchVacationStatus(selectedUser.userId);
                }

                setTimeout(() => setSuccessMessage(''), 5000);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '재계산에 실패했습니다.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setRecalculating(false);
        }
    };

    const fetchDepartmentNames = async () => {
        try {
            const response = await fetch('/api/v1/departments/names', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setDeptNameMap(new Map(Object.entries(data)));
            }
        } catch (err: any) {
            console.error('부서 이름 조회 실패:', err);
        }
    };

// ✅ baseCode 추출 함수 추가
    const getBaseDeptCode = (deptCode: string): string => {
        if (!deptCode) return deptCode;
        return deptCode.replace(/[_\-]?\d+$/, '');
    };

// ✅ getDeptName 함수 수정
    const getDeptName = (deptCode: string | undefined): string => {
        if (!deptCode) return '미설정';
        const baseCode = getBaseDeptCode(deptCode);
        return deptNameMap.get(baseCode) || deptCode;
    };

    const fetchVacationStatus = async (userId: string) => {
        try {
            const response = await fetch(
                `/api/v1/vacation/status/${userId}?year=${selectedYear}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.ok) {
                const data: VacationStatus = await response.json();
                setVacationStatus(data);

                // 이월/정상 값 설정
                setAnnualCarryover(data.annualCarryoverDays || 0);
                setAnnualRegular(data.annualRegularDays || 15);
            }
        } catch (err: any) {
            console.error('휴가 현황 조회 실패:', err);
        }
    };

    const handleUpdateVacationDays = async () => {
        if (!selectedUser) return;

        try {
            setUpdating(true);

            const response = await fetch(
                `/api/v1/vacation/vacation-details/${selectedUser.userId}?year=${selectedYear}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        annualCarryoverDays: annualCarryover,
                        annualRegularDays: annualRegular
                    })
                }
            );

            if (response.ok) {
                // ✅ 직접 계산하지 않고, 서버에서 최신 데이터 다시 조회
                await fetchVacationStatus(selectedUser.userId);

                setSuccessMessage(`${selectedYear}년 연차일수가 성공적으로 업데이트되었습니다.`);
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '연차일수 업데이트에 실패했습니다.');
            }
        } catch (err: any) {
            setError(err.message);
            await fetchVacationStatus(selectedUser.userId);
        } finally {
            setUpdating(false);
        }
    };

    const getPositionByJobLevel = (jobLevel: string | undefined): string => {
        const level = String(jobLevel);
        switch (level) {
            case '0': return '사원';
            case '1': return '부서장';
            case '2': return '센터장';
            case '3': return '원장';
            case '4': return '행정원장';
            case '5': return '대표원장';
            default: return '미설정';
        }
    };

    const getUsagePercentage = () => {
        if (!vacationStatus || !vacationStatus.annualTotalDays || vacationStatus.annualTotalDays === 0) {
            return 0;
        }
        const used = vacationStatus.annualUsedDays || 0;
        const total = vacationStatus.annualTotalDays;
        return (used / total) * 100;
    };

    const getProgressBarClass = () => {
        const percentage = getUsagePercentage();
        if (percentage >= 100) return 'vacation-progress-fill full-usage';
        if (percentage >= 80) return 'vacation-progress-fill high-usage';
        return 'vacation-progress-fill';
    };

    // ✅ 연도 옵션 생성 함수
    const getYearOptions = () => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let year = 2024; year <= currentYear + 1; year++) {
            years.push(year);
        }
        return years;
    };

    if (loading) {
        return (
            <Layout>
                <div className="vacation-management-container">
                    <div className="vacation-management-loading">
                        <div className="vacation-management-loading-spinner"></div>
                        <p>사용자 목록을 불러오는 중...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    if (error && users.length === 0) {
        return (
            <Layout>
                <div className="vacation-management-container">
                    <div className="vacation-management-error">
                        <div className="vacation-management-error-icon">⚠️</div>
                        <p className="vacation-management-error-message">{error}</p>
                        <button
                            onClick={() => fetchUsers(selectedYear)}
                            className="vacation-management-retry-btn"
                        >
                            다시 시도
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="vacation-management-container">
                <div className="vacation-management-header">
                    <h1 className="vacation-management-title">휴가일수 관리</h1>
                    <p className="vacation-management-subtitle">
                        직원들의 연간 휴가일수를 설정하고 관리할 수 있습니다
                    </p>
                    {/* ✅ 연도 선택 추가 */}
                    <div className="vacation-year-selector">
                        <label htmlFor="year-select">관리 연도:</label>
                        <select
                            id="year-select"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="vacation-year-select"
                        >
                            {getYearOptions().map(year => (
                                <option key={year} value={year}>
                                    {year}년
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={async () => {
                                // 1. 사용자 목록 새로고침 (vacation-user-stats 반영)
                                await fetchUsers(selectedYear);

                                // 2. 선택된 사용자 휴가 현황 새로고침
                                if (selectedUser) {
                                    await fetchVacationStatus(selectedUser.userId);
                                }
                            }}
                            className="vacation-search-btn"
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            🔍 조회
                        </button>
                    </div>
                    {/* ✅ 추가: 휴가일수 재계산 버튼 */}
                    <div style={{marginTop: '15px'}}>
                        <button
                            onClick={handleRecalculateHistory}
                            disabled={recalculating}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: recalculating ? '#9ca3af' : '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: recalculating ? 'not-allowed' : 'pointer',
                                fontWeight: '600',
                                fontSize: '14px'
                            }}
                        >
                            {recalculating ? '⏳ 처리 중...' : '✅ 연차 히스토리 재계산'}
                        </button>

                        <small style={{
                            display: 'block',
                            marginTop: '5px',
                            color: '#6b7280',
                            fontSize: '12px'
                        }}>
                            * 반차 계산 오류가 있는 휴가원을 자동으로 수정합니다
                        </small>
                    </div>
                </div>


                {error && (
                    <div className="vacation-management-error">
                        <div className="vacation-management-error-icon">⚠️</div>
                        <p className="vacation-management-error-message">{error}</p>
                    </div>
                )}

                <div className="vacation-management-grid">
                    {/* ✅ 조직도 */}
                    <div className="vacation-users-section">
                        <div className="vacation-users-header">
                            조직도에서 직원 선택
                        </div>

                        <div className="vacation-org-wrapper" style={{
                            padding: '20px',
                            overflowY: 'auto',
                            maxHeight: 'calc(100vh - 300px)'
                        }}>
                            <OrganizationChart
                                onUserSelect={handleOrgUserSelect}
                                selectedUserId={selectedUser?.userId}
                                allDepartments={true}
                            />
                        </div>
                    </div>

                    {/* 휴가일수 설정 */}
                    <div className="vacation-settings-section">
                        <div className="vacation-settings-header">
                            휴가일수 설정 ({selectedYear}년)
                        </div>

                        <div className="vacation-settings-content">
                            {selectedUser && vacationStatus ? (
                                <>
                                    {successMessage && (
                                        <div className="vacation-success-message">
                                            {successMessage}
                                        </div>
                                    )}

                                    <div className="vacation-selected-user">
                                        <h4 className="vacation-selected-user-name">
                                            {selectedUser.userName}
                                        </h4>
                                        <p className="vacation-selected-user-info">
                                            {vacationStatus.deptName} / {getPositionByJobLevel(selectedUser.jobLevel)}
                                        </p>

                                        <div className="vacation-selected-user-current">
                                            {/* ✅ 이월 일수 표시 추가 */}
                                            <div className="vacation-current-stat carryover">
                                                <span className="vacation-current-stat-label">이월 일수</span>
                                                <span className="vacation-current-stat-value">
                                                    {vacationStatus.annualCarryoverDays || 0}일
                                                </span>
                                            </div>
                                            <div className="vacation-current-stat used">
                                                <span className="vacation-current-stat-label">이월 사용</span>
                                                <span className="vacation-current-stat-value">
                                                    {vacationStatus.usedCarryoverDays || 0}일
                                                </span>
                                            </div>
                                            <div className="vacation-current-stat remaining">
                                                <span className="vacation-current-stat-label">이월 미사용</span>
                                                <span className="vacation-current-stat-value">
                                                    {(vacationStatus.annualCarryoverDays || 0) - (vacationStatus.usedCarryoverDays || 0)}일
                                                </span>
                                            </div>

                                            <div className="vacation-current-stat regular">
                                                <span className="vacation-current-stat-label">정상 일수</span>
                                                <span className="vacation-current-stat-value">
                                                    {vacationStatus.annualRegularDays || 15}일
                                                </span>
                                            </div>
                                            <div className="vacation-current-stat used">
                                                <span className="vacation-current-stat-label">정상 사용</span>
                                                <span className="vacation-current-stat-value">
                                                    {vacationStatus.usedRegularDays || 0}일
                                                </span>
                                            </div>

                                            <div className="vacation-current-stat remaining">
                                                <span className="vacation-current-stat-label">정상 미사용</span>
                                                <span className="vacation-current-stat-value">
                                                    {(vacationStatus.annualRegularDays || 0) - (vacationStatus.usedRegularDays || 0)}일
                                                </span>
                                            </div>
                                            <div className="vacation-current-stat total">
                                                <span className="vacation-current-stat-label">총 휴가일수</span>
                                                <span className="vacation-current-stat-value">
                                                    {vacationStatus.totalVacationDays}일
                                                </span>
                                            </div>
                                            <div className="vacation-current-stat used">
                                                <span className="vacation-current-stat-label">사용한 일수</span>
                                                <span className="vacation-current-stat-value">
                                                    {vacationStatus.annualUsedDays}일
                                                </span>
                                            </div>
                                            <div className="vacation-current-stat remaining">
                                                <span className="vacation-current-stat-label">남은 일수</span>
                                                <span className="vacation-current-stat-value">
                                                    {vacationStatus.annualRemainingDays}일
                                                </span>
                                            </div>
                                        </div>

                                        <div className="vacation-usage-progress">
                                            <div className="vacation-progress-label">
                                                <span>사용률: {Math.round(getUsagePercentage())}%</span>
                                            </div>
                                            <div className="vacation-progress-bar">
                                                <div
                                                    className={getProgressBarClass()}
                                                    style={{width: `${Math.min(getUsagePercentage(), 100)}%`}}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ✅ 폼 수정 - 이월/정상 입력 */}
                                    <div className="vacation-form-section">
                                        <h5 className="vacation-form-section-title">연차 설정 (차감됨)</h5>

                                        <div className="vacation-form-group">
                                            <label htmlFor="annualCarryover" className="vacation-form-label">
                                                작년 이월 일수
                                            </label>
                                            <input
                                                type="number"
                                                id="annualCarryover"
                                                min="0"
                                                max="365"
                                                value={annualCarryover}
                                                onChange={(e) => setAnnualCarryover(Number(e.target.value))}
                                                className="vacation-form-input"
                                            />
                                            <small className="vacation-form-hint">
                                                1~2월에 먼저 차감됩니다
                                            </small>
                                        </div>

                                        <div className="vacation-form-group">
                                            <label htmlFor="annualRegular" className="vacation-form-label">
                                                정상 연차 일수
                                            </label>
                                            <input
                                                type="number"
                                                id="annualRegular"
                                                min="0"
                                                max="365"
                                                value={annualRegular}
                                                onChange={(e) => setAnnualRegular(Number(e.target.value))}
                                                className="vacation-form-input"
                                            />
                                            <small className="vacation-form-hint">
                                                3월부터 차감됩니다
                                            </small>
                                        </div>

                                        <div className="vacation-total-display">
                                            <span className="vacation-total-label">총 연차:</span>
                                            <span className="vacation-total-value">
                        {annualCarryover + annualRegular}일
                    </span>
                                        </div>
                                    </div>

                                    {/* ✅ 안내 메시지 추가 */}
                                    <div className="vacation-info-box">
                                        <strong>참고:</strong> 경조/특별휴가는 차감되지 않으며, 사용 기록만 관리대장에 표시됩니다.
                                    </div>

                                    <div className="vacation-btn-group">
                                        <button
                                            onClick={handleUpdateVacationDays}
                                            disabled={updating}
                                            className={`vacation-btn vacation-btn-primary ${updating ? 'vacation-updating' : ''}`}
                                        >
                                            {updating ? '업데이트 중...' : '업데이트'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedUser(null);
                                                setVacationStatus(null);
                                                setSuccessMessage('');
                                                setError('');
                                            }}
                                            className="vacation-btn vacation-btn-secondary"
                                        >
                                            취소
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="vacation-settings-empty">
                                    <div className="vacation-settings-empty-icon">👆</div>
                                    <div className="vacation-settings-empty-text">
                                        사용자를 선택하세요
                                    </div>
                                    <div className="vacation-settings-empty-subtext">
                                        왼쪽 목록에서 연차일수를 설정할 직원을 클릭해주세요
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default AdminVacationManagement;