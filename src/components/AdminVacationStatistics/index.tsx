import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Layout from '../Layout';
import './style.css';
import OrgChartModal from "../OrgChartModal";

interface VacationLedgerEntry {
    rowNumber: number;
    deptName: string;
    userName: string;
    startDate: string;
    leaveType: string;
    carryoverDays: number | null;
    regularDays: number | null;
    monthlyUsage: {
        [key: number]: {
            details: Array<{
                date: string;
                halfDayType: 'ALL_DAY' | 'MORNING' | 'AFTERNOON';
                days: number;
            }>;
            monthTotal: number;
        };
    };
    totalUsed: number;
    remaining: number | null;
    remarks: string;
}

interface EmployeeVacation {
    userId: string;
    userName: string;
    deptCode: string;
    jobLevel: string;
    jobType: string;
    startDate?: string;
    // 추가
    annualCarryover?: number;
    annualRegular?: number;
    annualTotal?: number;
    annualUsed?: number;
    annualRemaining?: number;
    annualUsageRate?: number;
    usedCarryoverDays?: number;
    usedRegularDays?: number;
    remainingCarryoverDays?: number;
    // 하위 호환
    totalDays: number;
    usedDays: number;
    remainingDays: number;
    usageRate: number;
}

interface DepartmentStatistics {
    deptCode: string;
    deptName: string;
    totalEmployees: number;
    avgUsageRate: number;
    totalVacationDays: number;
    totalUsedDays: number;
    totalRemainingDays: number;
    employees: EmployeeVacation[];
}

interface DepartmentSummary {
    deptCode: string;
    deptName: string;
    totalEmployees: number;
    avgUsageRate: number;
}

const AdminVacationStatistics: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;

    const [selectedDept, setSelectedDept] = useState<DepartmentStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [deptLoading, setDeptLoading] = useState(false);
    const [error, setError] = useState('');
    const [departmentNames, setDepartmentNames] = useState<Record<string, string>>({});
    const [departmentSummaries, setDepartmentSummaries] = useState<DepartmentSummary[]>([]);
    const [sortBy, setSortBy] = useState<string>('usageRate');
    const [sortOrder, setSortOrder] = useState<string>('desc');
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]); // 선택된 직원 ID 목록
    const [isOrgChartModalOpen, setIsOrgChartModalOpen] = useState(false); // 조직도 모달

    // 관리대장 관련 state
    const [activeTab, setActiveTab] = useState<'statistics' | 'ledger'>('statistics');
    const [ledgerData, setLedgerData] = useState<any[]>([]);
    const [ledgerDeptCode, setLedgerDeptCode] = useState<string>('ALL');
    const [ledgerUserIds, setLedgerUserIds] = useState<string[]>([]);
    const [isLedgerOrgChartOpen, setIsLedgerOrgChartOpen] = useState(false);
    // 현재 연도를 기본값으로 설정
    const currentYear = new Date().getFullYear();
    const [ledgerYear, setLedgerYear] = useState(currentYear);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    // useState 임포트 아래에 추가
    const useIsMobile = () => {
        const [isMobile, setIsMobile] = useState(() => {
            // ✅ 초기값을 즉시 계산
            return window.matchMedia('(max-width: 768px)').matches;
        });

        useEffect(() => {
            const mediaQuery = window.matchMedia('(max-width: 768px)');

            const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
                setIsMobile(e.matches);
            };

            // 이벤트 리스너 등록
            mediaQuery.addEventListener('change', handleChange);

            return () => mediaQuery.removeEventListener('change', handleChange);
        }, []);

        return isMobile;
    };
    const isMobile = useIsMobile();
    const handleRecalculateFromStats = async () => {
        if (!window.confirm('모든 휴가원의 일수를 재계산하시겠습니까?')) {
            return;
        }

        try {
            setLoading(true);

            const response = await fetch('/api/v1/leave-application/admin/recalculate-total-days', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                alert(`✅ ${data.updatedCount}건의 휴가원 일수가 재계산되었습니다.`);

                // ✅ 데이터 새로고침
                await fetchDepartmentSummaries();

                if (selectedDept) {
                    if (selectedDept.deptCode === 'ALL') {
                        await fetchAllDepartments();
                    } else if (selectedDept.deptCode === 'CUSTOM') {
                        await fetchSpecificEmployees(selectedEmployees);
                    } else {
                        await handleDeptClick(selectedDept.deptCode);
                    }
                }
            }
        } catch (error) {
            console.error('재계산 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    // ✅ 연도 옵션 자동 생성 (2024년 ~ 현재+1년)
    const getYearOptions = () => {
        const startYear = 2024;
        const endYear = currentYear + 1;
        const years = [];

        for (let year = startYear; year <= endYear; year++) {
            years.push(year);
        }

        return years;
    };

    const fetchDepartmentNames = async () => {
        try {
            const response = await fetch('/api/v1/departments/names', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setDepartmentNames(data);
            }
        } catch (error) {
            console.error('부서 이름 조회 실패:', error);
        }
    };

    const getBaseDeptCode = (deptCode: string): string => {
        if (!deptCode) return deptCode;
        return deptCode.replace(/\d+$/, '');
    };

    useEffect(() => {
        fetchDepartmentNames();
        fetchDepartmentSummaries();
    }, []);


    // ✅ 부서 요약 정보 불러오기 + 전체 요약 계산
    const fetchDepartmentSummaries = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(
                `/api/v1/vacation/statistics/summary`,
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

                // ✅ 빈 문자열이나 null deptCode 필터링
                const validDepts = data.filter((dept: DepartmentSummary) =>
                    dept.deptCode && dept.deptCode.trim() !== '' && dept.deptName && dept.deptName.trim() !== ''
                );

                // ✅ 전체 요약 계산 (가중 평균 사용)
                if (validDepts.length > 0) {
                    const totalEmployees = validDepts.reduce((sum: number, dept: DepartmentSummary) =>
                        sum + dept.totalEmployees, 0);
                    const weightedAvgUsageRate = validDepts.reduce((sum: number, dept: DepartmentSummary) =>
                        sum + (dept.avgUsageRate * dept.totalEmployees), 0) / totalEmployees;

                    const allSummary: DepartmentSummary = {
                        deptCode: 'ALL',
                        deptName: '전체',
                        totalEmployees: totalEmployees,
                        avgUsageRate: Math.round(weightedAvgUsageRate * 100) / 100
                    };

                    // ✅ 전체를 맨 앞에 추가
                    setDepartmentSummaries([allSummary, ...validDepts]);
                } else {
                    setDepartmentSummaries(validDepts);
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '부서 목록을 가져오는데 실패했습니다.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ✅ 특정 부서 클릭 시 상세 정보 불러오기
    const handleDeptClick = async (deptCode: string) => {
        try {
            setDeptLoading(true);
            setError('');

            const response = await fetch(
                `/api/v1/vacation/statistics/department/${deptCode}?sortBy=${sortBy}&sortOrder=${sortOrder}`,
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
                setSelectedDept(data);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '부서 상세 정보를 가져오는데 실패했습니다.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeptLoading(false);
        }
    };


    // ✅ 관리대장 조회
    const fetchLedger = async () => {
        try {
            setDeptLoading(true);

            let url: string;
            let options: RequestInit;

            // 특정 직원 선택된 경우
            if (ledgerUserIds.length > 0) {
                url = `/api/v1/vacation/statistics/ledger/users?year=${ledgerYear}`;
                options = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(ledgerUserIds)
                };
            } else {
                // 부서별 조회
                url = `/api/v1/vacation/statistics/ledger?deptCode=${ledgerDeptCode}&leaveType=ALL&year=${ledgerYear}`;
                options = {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                };
            }

            const response = await fetch(url, options);

            if (response.ok) {
                const data = await response.json();
                setLedgerData(data);
            }
        } catch (error) {
            console.error('관리대장 조회 실패:', error);
        } finally {
            setDeptLoading(false);
        }
    };

// ✅ 엑셀 다운로드 (관리대장)
    const downloadLedgerExcel = async () => {
        try {
            let url: string;
            let options: RequestInit;

            if (ledgerUserIds.length > 0) {
                url = `/api/v1/vacation/statistics/ledger/excel/users?year=${ledgerYear}`;
                options = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(ledgerUserIds)
                };
            } else {
                url = `/api/v1/vacation/statistics/ledger/excel?deptCode=${ledgerDeptCode}&leaveType=ALL&year=${ledgerYear}`;
                options = {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                };
            }

            const response = await fetch(url, options);

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `휴가관리대장_${ledgerYear}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('엑셀 다운로드 실패:', error);
        }
    };

    // ✅ 관리대장 직원 선택
    const handleLedgerEmployeeSelect = (users: { id: string, name: string }[]) => {
        const userIds = users.map(u => u.id);
        setLedgerUserIds(userIds);
        setLedgerDeptCode('CUSTOM'); // 커스텀 모드
        setIsLedgerOrgChartOpen(false);
    };


    // ✅ 전체 데이터 불러오기
    const fetchAllDepartments = async () => {
        // ✅ 이미 구현된 백엔드 "ALL" 엔드포인트 사용
        await handleDeptClick('ALL');
    };

    // ✅ 조직도에서 직원 선택 핸들러
    const handleEmployeeSelect = (users: { id: string, name: string }[]) => {
        const userIds = users.map(u => u.id);
        setSelectedEmployees(userIds);
        fetchSpecificEmployees(userIds);
    };

// ✅ 특정 직원들 조회
    const fetchSpecificEmployees = async (userIds: string[]) => {
        try {
            setDeptLoading(true);
            setError('');

            const response = await fetch(
                `/api/v1/vacation/statistics/specific`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(userIds)
                }
            );

            if (response.ok) {
                const employees = await response.json();

                // ✅ 선택된 직원들로 가상의 부서 생성
                const customDept: DepartmentStatistics = {
                    deptCode: 'CUSTOM',
                    deptName: `선택된 직원 (${employees.length}명)`,
                    totalEmployees: employees.length,
                    avgUsageRate: employees.reduce((sum: number, emp: EmployeeVacation) =>
                        sum + emp.usageRate, 0) / employees.length,
                    totalVacationDays: employees.reduce((sum: number, emp: EmployeeVacation) =>
                        sum + emp.totalDays, 0),
                    totalUsedDays: employees.reduce((sum: number, emp: EmployeeVacation) =>
                        sum + emp.usedDays, 0),
                    totalRemainingDays: employees.reduce((sum: number, emp: EmployeeVacation) =>
                        sum + emp.remainingDays, 0),
                    employees: employees
                };

                setSelectedDept(customDept);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '직원 정보를 가져오는데 실패했습니다.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeptLoading(false);
        }
    };

// ✅ 선택된 직원 초기화
    const handleClearSelection = () => {
        setSelectedEmployees([]);
        setSelectedDept(null);
    };

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    // ✅ 정렬 변경 시 선택된 부서 재조회
    useEffect(() => {
        if (selectedDept && selectedDept.deptCode !== 'CUSTOM') {
            if (selectedDept.deptCode === 'ALL') {
                fetchAllDepartments();
            } else {
                handleDeptClick(selectedDept.deptCode);
            }
        }
    }, [sortBy, sortOrder]);

    // ✅ 엑셀 다운로드 수정 (선택된 직원 포함)
    const handleExcelDownload = async () => {
        if (!selectedDept) {
            alert('다운로드할 부서를 선택해주세요.');
            return;
        }

        try {
            // CUSTOM(선택된 직원)인 경우 직접 엑셀 생성
            if (selectedDept.deptCode === 'CUSTOM') {
                // 클라이언트에서 엑셀 생성 (SheetJS 사용 등)
                // 또는 백엔드에 POST 요청으로 직원 목록 전송
                const response = await fetch(
                    `/api/v1/vacation/statistics/excel/custom`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(selectedEmployees)
                    }
                );

                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `선택직원_vacation_statistics_${new Date().toISOString().slice(0,10)}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }
            } else {
                // 기존 부서 다운로드 로직
                const response = await fetch(
                    `/api/v1/vacation/statistics/excel/department/${selectedDept.deptCode}?sortBy=${sortBy}&sortOrder=${sortOrder}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );

                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const filename = selectedDept.deptCode === 'ALL'
                        ? `전체_vacation_statistics_${new Date().toISOString().slice(0,10)}.xlsx`
                        : `${selectedDept.deptName}_vacation_statistics_${new Date().toISOString().slice(0,10)}.xlsx`;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }
            }
        } catch (error) {
            console.error('엑셀 다운로드 실패:', error);
        }
    };

    const getPositionByJobLevel = (jobLevel: string): string => {
        switch (jobLevel) {
            case '0': return '사원';
            case '1': return '부서장';
            case '2': return '센터장';
            case '3': return '원장';
            case '4': return '행정원장';
            case '5': return '대표원장';
            default: return '미설정';
        }
    };

    // ✅ 차트 데이터는 departmentSummaries 사용
    const getDeptChartData = () => {
        return departmentSummaries.map(dept => ({
            name: dept.deptName,
            사용률: dept.avgUsageRate,
            직원수: dept.totalEmployees
        }));
    };

    const getEmployeeChartData = () => {
        if (!selectedDept) return [];
        return selectedDept.employees.map(emp => ({
            name: emp.userName,
            총휴가: emp.totalDays,
            사용: emp.usedDays,
            남은휴가: emp.remainingDays
        }));
    };

    const getUsagePieData = () => {
        if (!selectedDept) return [];
        return [
            { name: '사용', value: selectedDept.totalUsedDays },
            { name: '남은휴가', value: selectedDept.totalRemainingDays }
        ];
    };

    if (loading) {
        return (
            <Layout>
                <div className="vs-loading-container">
                    <div className="vs-loading-spinner"></div>
                    <p>통계를 불러오는 중...</p>
                </div>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout>
                <div className="vs-error-container">
                    <div className="vs-error-icon">⚠️</div>
                    <p className="vs-error-message">{error}</p>
                    <button onClick={fetchDepartmentSummaries} className="vs-retry-btn">
                        다시 시도
                    </button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="vs-container">
                <div className="vs-header">
                    <h1 className="vs-title">휴가 사용 통계</h1>
                    <p className="vs-subtitle">부서별 및 직원별 휴가 사용 현황을 확인할 수 있습니다</p>
                </div>

                <div className="vs-tabs">
                    <button
                        className={`vs-tab ${activeTab === 'statistics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('statistics')}
                    >
                        부서별 통계
                    </button>
                    <button
                        className={`vs-tab ${activeTab === 'ledger' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('ledger');
                            fetchLedger(); // ✅ 연차+특별 모두
                        }}
                    >
                        휴가 관리대장
                    </button>
                </div>

                {/* ✅ 통계 탭 내용 */}
                {activeTab === 'statistics' && (
                    <>
                        {/* 기존 차트 */}
                        <div className="vs-chart-card">
                            <h2 className="vs-chart-title">부서별 평균 휴가 사용률</h2>

                            <BarChart
                                width={isMobile ? 350 : 1000}
                                height={isMobile ? 300 : 320}  // ✅ 높이 증가
                                data={getDeptChartData()}
                                style={{margin: '0 auto'}}
                                margin={{top: 5, right: 30, left: 20, bottom: 20}}  // ✅ 여백 추가
                            >
                                <CartesianGrid strokeDasharray="3 3"/>
                                <XAxis
                                    dataKey="name"
                                    angle={isMobile ? -45 : 0}  // ✅ 모바일에서 45도 회전
                                    textAnchor={isMobile ? "end" : "middle"}  // ✅ 정렬 조정
                                    height={isMobile ? 80 : 60}  // ✅ X축 높이 증가
                                    interval={0}  // ✅ 모든 라벨 표시
                                    tick={{fontSize: isMobile ? 10 : 12}}  // ✅ 폰트 크기 조정
                                />
                                <YAxis label={{value: '사용률 (%)', angle: -90, position: 'insideLeft'}}/>
                                <Tooltip/>
                                <Legend/>
                                <Bar dataKey="사용률" fill="#3b82f6"/>
                            </BarChart>
                        </div>

                        {/* 특정 직원 선택 버튼 */}
                        <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem'}}>
                            <button
                                onClick={() => setIsOrgChartModalOpen(true)}
                                className="vs-select-employee-btn"
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#2563eb';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#3b82f6';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                👥 특정 직원 선택 조회
                            </button>
                        </div>

                        <div className="vs-content-grid">
                            {/* 부서 목록 */}
                            <div className="vs-dept-list-card">
                                <h3 className="vs-dept-list-title">부서 목록</h3>
                                <div className="vs-dept-list">
                                    {selectedEmployees.length > 0 && selectedDept?.deptCode === 'CUSTOM' && (
                                        <div
                                            className="vs-dept-item selected"
                                            style={{borderColor: '#8b5cf6', backgroundColor: '#f5f3ff'}}
                                        >
                                            <div className="vs-dept-name">
                                                👥 {selectedDept.deptName}
                                                <button
                                                    onClick={handleClearSelection}
                                                    style={{
                                                        marginLeft: '0.5rem',
                                                        padding: '0.25rem 0.5rem',
                                                        fontSize: '0.75rem',
                                                        background: '#ef4444',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '0.25rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    ✕ 선택 해제
                                                </button>
                                            </div>
                                            <div className="vs-dept-stats">
                                                <span
                                                    className="vs-stat total">평균 사용률 {selectedDept.avgUsageRate.toFixed(2)}%</span>
                                            </div>
                                        </div>
                                    )}

                                    {departmentSummaries.map((dept) => (
                                        <div
                                            key={dept.deptCode}
                                            onClick={() => {
                                                handleClearSelection();
                                                if (dept.deptCode === 'ALL') {
                                                    fetchAllDepartments();
                                                } else {
                                                    handleDeptClick(dept.deptCode);
                                                }
                                            }}
                                            className={`vs-dept-item ${selectedDept?.deptCode === dept.deptCode ? 'selected' : ''}`}
                                        >
                                            <div className="vs-dept-name">{dept.deptName}</div>
                                            <div className="vs-dept-employee-count">
                                                {`직원 ${dept.totalEmployees}명`}
                                            </div>
                                            <div className="vs-dept-stats">
                                                <span className="vs-stat total">평균 사용률 {dept.avgUsageRate}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 선택된 부서 상세 정보 */}
                            {deptLoading ? (
                                <div className="vs-loading-container">
                                    <div className="vs-loading-spinner"></div>
                                    <p>부서 정보를 불러오는 중...</p>
                                </div>
                            ) : selectedDept ? (
                                <div className="vs-detail-container">
                                    <div className="vs-summary-card">
                                        <h3 className="vs-summary-title">
                                            {selectedDept.deptName} 부서 현황
                                        </h3>
                                        <div className="vs-summary-grid">
                                            <div className="vs-summary-item employees">
                                                <div className="vs-summary-label">직원 수</div>
                                                <div className="vs-summary-value">{selectedDept.totalEmployees}명</div>
                                            </div>
                                            <div className="vs-summary-item rate">
                                                <div className="vs-summary-label">평균 사용률</div>
                                                <div className="vs-summary-value">{selectedDept.avgUsageRate}%</div>
                                            </div>
                                            <div className="vs-summary-item used">
                                                <div className="vs-summary-label">사용 휴가</div>
                                                <div className="vs-summary-value">{selectedDept.totalUsedDays}일</div>
                                            </div>
                                            <div className="vs-summary-item remaining">
                                                <div className="vs-summary-label">남은 휴가</div>
                                                <div className="vs-summary-value">{selectedDept.totalRemainingDays}일
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="vs-charts-grid">
                                        <div className="vs-pie-chart-card">
                                            <h4 className="vs-chart-subtitle">휴가 사용 비율</h4>

                                            <PieChart
                                                width={isMobile ? 350 : 500}
                                                height={isMobile ? 240 : 280}
                                                style={{margin: '0 auto'}}
                                            >
                                                <Pie
                                                    data={getUsagePieData()}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={({name, value}) => `${name}: ${value}일`}
                                                    outerRadius={isMobile ? 60 : 80}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                >
                                                    {getUsagePieData().map((entry, index) => (
                                                        <Cell key={`cell-${index}`}
                                                              fill={COLORS[index % COLORS.length]}/>
                                                    ))}
                                                </Pie>
                                                <Tooltip/>
                                            </PieChart>
                                        </div>


                                        <div className="vs-bar-chart-card">
                                            <h4 className="vs-chart-subtitle">직원별 휴가 현황</h4>

                                            <BarChart
                                                width={isMobile ? 350 : 800}
                                                height={isMobile ? 260 : 280}  // ✅ 높이 증가
                                                data={getEmployeeChartData()}
                                                style={{margin: '0 auto'}}
                                                margin={{top: 5, right: 30, left: 20, bottom: 20}}  // ✅ 여백 추가
                                            >
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis
                                                    dataKey="name"
                                                    angle={isMobile ? -45 : 0}  // ✅ 모바일에서 45도 회전
                                                    textAnchor={isMobile ? "end" : "middle"}
                                                    height={isMobile ? 80 : 60}
                                                    interval={0}  // ✅ 모든 라벨 표시
                                                    tick={{fontSize: isMobile ? 10 : 12}}
                                                />
                                                <YAxis/>
                                                <Tooltip/>
                                                <Legend/>
                                                <Bar dataKey="사용" fill="#10b981"/>
                                                <Bar dataKey="남은휴가" fill="#f59e0b"/>
                                            </BarChart>
                                        </div>
                                    </div>

                                    <div className="vs-table-card">
                                        <div className="vs-table-header-group">
                                            <h4 className="vs-table-title">직원별 상세 현황</h4>
                                            <button onClick={handleExcelDownload} className="vs-excel-btn">
                                                📊 엑셀 다운로드
                                            </button>
                                        </div>
                                        <div className="vs-table-wrapper">
                                            <table className="vs-table">
                                                <thead>
                                                <tr>
                                                <th onClick={() => handleSort('userName')}>
                                                        이름 <span
                                                        className={`vs-sort-icon ${sortBy === 'userName' ? 'active' : ''}`}>
                                                            {sortBy === 'userName' && sortOrder === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    </th>
                                                    <th onClick={() => handleSort('deptCode')}>
                                                        부서 <span
                                                        className={`vs-sort-icon ${sortBy === 'deptCode' ? 'active' : ''}`}>
                                                            {sortBy === 'deptCode' && sortOrder === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    </th>
                                                    <th onClick={() => handleSort('jobLevel')}>
                                                        직급 <span
                                                        className={`vs-sort-icon ${sortBy === 'jobLevel' ? 'active' : ''}`}>
                                                            {sortBy === 'jobLevel' && sortOrder === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    </th>
                                                    <th onClick={() => handleSort('startDate')}>
                                                        입사일자 <span
                                                        className={`vs-sort-icon ${sortBy === 'startDate' ? 'active' : ''}`}>
                                                            {sortBy === 'startDate' && sortOrder === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    </th>
                                                    {/* ✅ 이월/정상 컬럼 추가 */}
                                                    <th onClick={() => handleSort('annualCarryover')}>
                                                        이월 <span
                                                        className={`vs-sort-icon ${sortBy === 'annualCarryover' ? 'active' : ''}`}>
                                                            {sortBy === 'annualCarryover' && sortOrder === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    </th>
                                                    <th>이월 미사용</th>
                                                    <th onClick={() => handleSort('annualRegular')}>
                                                        정상 <span
                                                        className={`vs-sort-icon ${sortBy === 'annualRegular' ? 'active' : ''}`}>
                                                            {sortBy === 'annualRegular' && sortOrder === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    </th>
                                                    <th onClick={() => handleSort('totalDays')}>
                                                        총 휴가 <span
                                                        className={`vs-sort-icon ${sortBy === 'totalDays' ? 'active' : ''}`}>
                                                            {sortBy === 'totalDays' && sortOrder === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    </th>
                                                    <th onClick={() => handleSort('usedDays')}>
                                                        사용 <span
                                                        className={`vs-sort-icon ${sortBy === 'usedDays' ? 'active' : ''}`}>
                                                            {sortBy === 'usedDays' && sortOrder === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    </th>
                                                    <th onClick={() => handleSort('remainingDays')}>
                                                        남은휴가 <span
                                                        className={`vs-sort-icon ${sortBy === 'remainingDays' ? 'active' : ''}`}>
                                                            {sortBy === 'remainingDays' && sortOrder === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    </th>
                                                    <th onClick={() => handleSort('usageRate')}>
                                                        사용률 <span
                                                        className={`vs-sort-icon ${sortBy === 'usageRate' ? 'active' : ''}`}>
                                                            {sortBy === 'usageRate' && sortOrder === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    </th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {selectedDept.employees.map((emp) => (
                                                    <tr key={emp.userId}>
                                                        <td className="vs-table-name">{emp.userName}</td>
                                                        <td className="vs-table-dept">
                                                            {departmentNames[getBaseDeptCode(emp.deptCode)] || emp.deptCode}
                                                        </td>
                                                        <td className="vs-table-position">
                                                            {getPositionByJobLevel(emp.jobLevel)}
                                                        </td>
                                                        <td className="vs-table-date">{emp.startDate || '-'}</td>
                                                        <td className="vs-table-carryover">
                                                            {emp.annualCarryover || 0}일
                                                        </td>
                                                        <td className="vs-table-carryover-remaining">
                                                            {((emp.annualCarryover || 0) - (emp.usedCarryoverDays || 0)) || 0}일
                                                        </td>
                                                        <td className="vs-table-regular">
                                                            {emp.annualRegular || 15}일
                                                        </td>
                                                        <td className="vs-table-total">
                                                            <strong>{emp.totalDays}일</strong>
                                                        </td>
                                                        {/* ✅ 수정: 소수점 처리 */}
                                                        <td className="vs-table-used">
                                                            {emp.usedDays % 1 === 0 ? emp.usedDays : emp.usedDays.toFixed(1)}일
                                                        </td>
                                                        <td className="vs-table-remaining">
                                                            {emp.remainingDays % 1 === 0 ? emp.remainingDays : emp.remainingDays.toFixed(1)}일
                                                        </td>
                                                        <td className="vs-table-rate">
                                                        <span className={`vs-rate-badge ${
                                                            emp.usageRate >= 80 ? 'high' :
                                                                emp.usageRate >= 50 ? 'medium' : 'low'
                                                        }`}>
                                                            {emp.usageRate}%
                                                        </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="vs-detail-container">
                                    <div className="vs-summary-card">
                                        <p className="vs-no-data">좌측 부서 목록에서 부서를 선택하면 상세 정보가 표시됩니다.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ✅ 관리대장 탭 내용 */}
                {activeTab === 'ledger' && (
                    <div className="vs-ledger-container">
                        <div className="vs-ledger-controls">
                            {/* ✅ 왼쪽: 부서/연도 선택 */}
                            <select
                                value={ledgerDeptCode}
                                onChange={(e) => {
                                    setLedgerDeptCode(e.target.value);
                                    setLedgerUserIds([]);
                                }}
                                className="vs-dept-select"
                                disabled={ledgerUserIds.length > 0}
                            >
                                <option value="ALL">전체 부서</option>
                                {departmentSummaries
                                    .filter(dept => dept.deptCode !== 'ALL')
                                    .map(dept => (
                                        <option key={dept.deptCode} value={dept.deptCode}>
                                            {dept.deptName}
                                        </option>
                                    ))}
                            </select>

                            <select
                                value={ledgerYear}
                                onChange={(e) => setLedgerYear(Number(e.target.value))}
                                className="vs-year-select"
                            >
                                {getYearOptions().map(year => (
                                    <option key={year} value={year}>
                                        {year}년
                                    </option>
                                ))}
                            </select>

                            {/* ✅ 오른쪽: 버튼 그룹 */}
                            <div className="vs-button-group">
                                <button
                                    onClick={() => setIsLedgerOrgChartOpen(true)}
                                    className="vs-select-btn"
                                >
                                    👥 특정 직원 선택
                                </button>

                                {ledgerUserIds.length > 0 && (
                                    <button
                                        onClick={() => {
                                            setLedgerUserIds([]);
                                            setLedgerDeptCode('ALL');
                                        }}
                                        className="vs-clear-btn"
                                    >
                                        ✕ 선택 해제 ({ledgerUserIds.length}명)
                                    </button>
                                )}

                                <button onClick={fetchLedger} className="vs-search-btn">
                                    🔍 조회
                                </button>

                                <button onClick={downloadLedgerExcel} className="vs-excel-btn">
                                    📊 엑셀 다운로드
                                </button>
                            </div>
                        </div>

                        {/* 테이블 */}
                        {deptLoading ? (
                            <div className="vs-loading-container">
                                <div className="vs-loading-spinner"></div>
                                <p>관리대장을 불러오는 중...</p>
                            </div>
                        ) : (
                            <div className="vs-ledger-table-wrapper">
                                <table className="vs-ledger-table">
                                    <thead>
                                    <tr>
                                        <th rowSpan={2}>번호</th>
                                        <th rowSpan={2}>부서명</th>
                                        <th rowSpan={2}>성명</th>
                                        <th rowSpan={2}>입사일자</th>
                                        <th rowSpan={2}>휴가구분</th>
                                        <th rowSpan={2}>작년이월</th>
                                        <th rowSpan={2}>휴가일수</th>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                                            <th key={month} colSpan={2}>{month}월</th>
                                        ))}
                                        <th rowSpan={2}>사용계</th>
                                        <th rowSpan={2}>남은개수</th>
                                        <th rowSpan={2}>비고</th>
                                    </tr>
                                    <tr>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                                            <React.Fragment key={month}>
                                                <th>사용일</th>
                                                <th>계</th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {ledgerData.map((entry: VacationLedgerEntry, index: number) => {
                                        const prevEntry = index > 0 ? ledgerData[index - 1] : null;
                                        const isNewUser = !prevEntry || prevEntry.userName !== entry.userName;

                                        return (
                                            <tr key={`${entry.userName}-${entry.leaveType}-${index}`}>
                                                {isNewUser ? (
                                                    <>
                                                        <td rowSpan={2} className="vs-merged-cell">{entry.rowNumber}</td>
                                                        <td rowSpan={2} className="vs-merged-cell">{entry.deptName}</td>
                                                        <td rowSpan={2} className="vs-merged-cell">{entry.userName}</td>
                                                        <td rowSpan={2} className="vs-merged-cell">
                                                            {entry.startDate ?
                                                                new Date(entry.startDate).toLocaleDateString('ko-KR') : '-'}
                                                        </td>
                                                    </>
                                                ) : null}

                                                <td>{entry.leaveType}</td>
                                                <td>{entry.carryoverDays !== null ? entry.carryoverDays : '-'}</td>
                                                <td>{entry.regularDays !== null ? entry.regularDays : '-'}</td>

                                                {/* ✅ 월별 데이터 - 줄바꿈 적용 */}
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                                                    const monthData = entry.monthlyUsage[month];
                                                    return (
                                                        <React.Fragment key={month}>
                                                            <td className="vs-month-details">
                                                                {monthData?.details?.map((daily, idx) => {
                                                                    // ✅ 5개마다 줄바꿈
                                                                    const needsLineBreak = idx > 0 && idx % 5 === 0;

                                                                    return (
                                                                        <React.Fragment key={idx}>
                                                                            {needsLineBreak && <br />}
                                                                            <span
                                                                                className="vs-daily-usage"
                                                                                style={{
                                                                                    color: daily.halfDayType === 'ALL_DAY' ? 'black' :
                                                                                        daily.halfDayType === 'MORNING' ? 'red' : 'blue',
                                                                                    marginRight: '4px'
                                                                                }}
                                                                            >
                                                                {new Date(daily.date).getDate()}
                                                                                {idx < monthData.details.length - 1 && ', '}
                                                            </span>
                                                                        </React.Fragment>
                                                                    );
                                                                }) || '-'}
                                                            </td>
                                                            <td className="vs-month-total">{monthData?.monthTotal || 0}</td>
                                                        </React.Fragment>
                                                    );
                                                })}

                                                <td>{entry.totalUsed}</td>
                                                <td>{entry.remaining !== null ? entry.remaining : '-'}</td>
                                                <td>{entry.remarks}</td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 조직도 모달 */}
                <OrgChartModal
                    isOpen={isOrgChartModalOpen}
                    onClose={() => setIsOrgChartModalOpen(false)}
                    onSelect={handleEmployeeSelect}
                    multiSelect={true}
                    allDepartments={true}
                />

                {/* ✅ 관리대장용 조직도 모달 추가 */}
                <OrgChartModal
                    isOpen={isLedgerOrgChartOpen}
                    onClose={() => setIsLedgerOrgChartOpen(false)}
                    onSelect={handleLedgerEmployeeSelect}
                    multiSelect={true}
                    allDepartments={true}
                />
            </div>
        </Layout>
    );
};

export default AdminVacationStatistics;