import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Layout from '../Layout';
import './style.css';
import OrgChartModal from "../OrgChartModal";

interface EmployeeVacation {
    userId: string;
    userName: string;
    deptCode: string;
    jobLevel: string;
    jobType: string;
    startDate?: string;
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
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    const fetchDepartmentNames = async () => {
        try {
            const response = await fetch('/api/v1/departments/names', {
                headers: {
                    'Authorization': `Bearer ${cookies.accessToken}`
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

    // ✅ 부서 요약 정보 불러오기 (차트용)
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
                        'Authorization': `Bearer ${cookies.accessToken}`
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
                        'Authorization': `Bearer ${cookies.accessToken}`
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

    // ✅ 전체 데이터 불러오기
    const fetchAllDepartments = async () => {
        try {
            setDeptLoading(true);
            setError('');

            const response = await fetch(
                `/api/v1/vacation/statistics?sortBy=${sortBy}&sortOrder=${sortOrder}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${cookies.accessToken}`
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();

                // ✅ 전체 통합 데이터 생성
                const allEmployees = data.flatMap((dept: DepartmentStatistics) => dept.employees);
                const totalVacationDays = data.reduce((sum: number, dept: DepartmentStatistics) =>
                    sum + dept.totalVacationDays, 0);
                const totalUsedDays = data.reduce((sum: number, dept: DepartmentStatistics) =>
                    sum + dept.totalUsedDays, 0);
                const totalRemainingDays = data.reduce((sum: number, dept: DepartmentStatistics) =>
                    sum + dept.totalRemainingDays, 0);
                const avgUsageRate = data.reduce((sum: number, dept: DepartmentStatistics) =>
                    sum + dept.avgUsageRate, 0) / data.length;

                const allDeptData: DepartmentStatistics = {
                    deptCode: 'ALL',
                    deptName: '전체',
                    totalEmployees: allEmployees.length,
                    avgUsageRate: Math.round(avgUsageRate * 100) / 100,
                    totalVacationDays,
                    totalUsedDays,
                    totalRemainingDays,
                    employees: allEmployees
                };

                setSelectedDept(allDeptData);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '전체 통계를 가져오는데 실패했습니다.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeptLoading(false);
        }
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
                        'Authorization': `Bearer ${cookies.accessToken}`
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

    // ✅ 엑셀 다운로드
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
                            'Authorization': `Bearer ${cookies.accessToken}`
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
                            'Authorization': `Bearer ${cookies.accessToken}`
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
            case '2': return '진료센터장';
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

                {/* ✅ 부서별 평균 사용률 차트 - 항상 표시 */}
                <div className="vs-chart-card">
                    <h2 className="vs-chart-title">부서별 평균 휴가 사용률</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={getDeptChartData()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis label={{ value: '사용률 (%)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="사용률" fill="#3b82f6" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* ✅ 특정 직원 선택 버튼 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
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
                    {/* ✅ 부서 목록 */}
                    <div className="vs-dept-list-card">
                        <h3 className="vs-dept-list-title">부서 목록</h3>
                        <div className="vs-dept-list">
                            {/* ✅ 선택된 직원이 있으면 맨 위에 표시 */}
                            {selectedEmployees.length > 0 && selectedDept?.deptCode === 'CUSTOM' && (
                                <div
                                    className="vs-dept-item selected"
                                    style={{ borderColor: '#8b5cf6', backgroundColor: '#f5f3ff' }}
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
                                        <span className="vs-stat total">평균 사용률 {selectedDept.avgUsageRate.toFixed(2)}%</span>
                                    </div>
                                </div>
                            )}

                            {/* ✅ 일반 부서 목록 */}
                            {departmentSummaries.map((dept) => (
                                <div
                                    key={dept.deptCode}
                                    onClick={() => {
                                        handleClearSelection(); // 기존 선택 해제
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

                    {/* ✅ 선택된 부서 상세 정보 */}
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
                                        <div className="vs-summary-value">{selectedDept.totalRemainingDays}일</div>
                                    </div>
                                </div>
                            </div>

                            <div className="vs-charts-grid">
                                <div className="vs-pie-chart-card">
                                    <h4 className="vs-chart-subtitle">휴가 사용 비율</h4>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <PieChart>
                                            <Pie
                                                data={getUsagePieData()}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({name, value}) => `${name}: ${value}일`}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {getUsagePieData().map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>
                                                ))}
                                            </Pie>
                                            <Tooltip/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="vs-bar-chart-card">
                                    <h4 className="vs-chart-subtitle">직원별 휴가 현황</h4>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={getEmployeeChartData()}>
                                            <CartesianGrid strokeDasharray="3 3"/>
                                            <XAxis dataKey="name"/>
                                            <YAxis/>
                                            <Tooltip/>
                                            <Legend/>
                                            <Bar dataKey="사용" fill="#10b981"/>
                                            <Bar dataKey="남은휴가" fill="#f59e0b"/>
                                        </BarChart>
                                    </ResponsiveContainer>
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
                                            <th onClick={() => handleSort('deptCode')}> {/* ✅ 클릭 이벤트 추가 */}
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
                                                <td className="vs-table-total">{emp.totalDays}일</td>
                                                <td className="vs-table-used">{emp.usedDays}일</td>
                                                <td className="vs-table-remaining">{emp.remainingDays}일</td>
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
            </div>
            {/* ✅ 조직도 모달 */}
            <OrgChartModal
                isOpen={isOrgChartModalOpen}
                onClose={() => setIsOrgChartModalOpen(false)}
                onSelect={handleEmployeeSelect}
                multiSelect={true}
                allDepartments={true}
            />
        </Layout>
    );
};

export default AdminVacationStatistics;