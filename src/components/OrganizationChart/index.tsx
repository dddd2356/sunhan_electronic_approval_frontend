import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { ChevronRight, ChevronDown, User, Users } from 'lucide-react';
import './style.css';

interface Department {
    deptCode: string;
    deptName: string;
    parentDeptCode?: string;
    children?: Department[];
}

interface Employee {
    userId: string;
    userName: string;
    jobLevel: string;
    deptCode: string;
    phone: string;
}

interface OrganizationChartProps {
    onUserSelect: (userId: string, userName: string, jobLevel: string) => void;
    selectedUserId?: string;
    selectedUserIds?: string[]; // 다중 선택용 추가
    multiSelect?: boolean; // 다중 선택 모드
    allDepartments?: boolean;
}

const OrganizationChart: React.FC<OrganizationChartProps> = ({
                                                                 onUserSelect,
                                                                 selectedUserId,
                                                                 selectedUserIds = [],
                                                                 multiSelect = false,
                                                                 allDepartments = false
                                                             }) => {
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;

    const [departments, setDepartments] = useState<Department[]>([]);
    const [deptNames, setDeptNames] = useState<Record<string, string>>({});  // ✅ 추가
    const [employees, setEmployees] = useState<Record<string, Employee[]>>({});
    const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Employee[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const getBaseDeptCode = (code: string) => code.replace(/\d+$/, '');

    useEffect(() => {
        // fetchDepartments();
        fetchDepartmentNames();
    }, []);

    useEffect(() => {
        if (searchTerm.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        const timer = setTimeout(() => {
            handleSearch(searchTerm);
        }, 300); // 300ms 대기

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleSearch = async (term: string) => {
        try {
            const response = await fetch(`/api/v1/user/search?query=${encodeURIComponent(term)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error('검색 실패:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // const fetchDepartments = async () => {
    //     try {
    //         const response = await fetch('/api/v1/user/departments', {
    //             headers: { Authorization: `Bearer ${token}` }
    //         });
    //         const data = await response.json();
    //         setDepartments(buildDepartmentTree(data));
    //     } catch (error) {
    //         console.error('부서 목록 조회 실패:', error);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // ✅ 부서명 조회 추가
    const fetchDepartmentNames = async () => {
        try {
            const response = await fetch('/api/v1/departments/names', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            const normalized: Record<string, string> = {};
            const deptList: Department[] = []; // ← 추가

            Object.entries(data).forEach(([code, name]) => {
                const baseCode = getBaseDeptCode(code);
                if (!normalized[baseCode]) {
                    normalized[baseCode] = name as string;
                    // ✅ 부서 객체 생성 (직원 데이터 없이)
                    deptList.push({
                        deptCode: baseCode,
                        deptName: name as string,
                        children: []
                    });
                }
            });

            setDeptNames(normalized);
            setDepartments(buildDepartmentTree(deptList)); // ← 추가
            setLoading(false); // ← 추가
        } catch (error) {
            console.error('부서 이름 조회 실패:', error);
            setLoading(false); // ← 추가
        }
    };

    const fetchEmployees = async (deptCode: string) => {
        const baseCode = getBaseDeptCode(deptCode);
        if (employees[baseCode]) return; // 이미 로드했으면 스킵

        try {
            // ✅ 새로운 API 엔드포인트 사용
            const response = await fetch(`/api/v1/departments/${baseCode}/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json();
            setEmployees(prev => ({ ...prev, [baseCode]: data }));
        } catch (error) {
            console.error('직원 목록 조회 실패:', error);
            setEmployees(prev => ({ ...prev, [baseCode]: [] })); // 실패 시 빈 배열
        }
    };

    const buildDepartmentTree = (depts: Department[]): Department[] => {
        // 이미 간단한 배열로 받았으므로 그대로 반환
        return depts.sort((a, b) => a.deptName.localeCompare(b.deptName));
    };

    const toggleDepartment = (deptCode: string) => {
        const baseCode = getBaseDeptCode(deptCode);
        const newExpanded = new Set(expandedDepts);

        if (newExpanded.has(baseCode)) {
            newExpanded.delete(baseCode);
        } else {
            newExpanded.add(baseCode);
            fetchEmployees(baseCode);
        }
        setExpandedDepts(newExpanded);
    };

    const getJobLevelText = (jobLevel: string) => {
        const levels: Record<string, string> = {
            '0': '사원',
            '1': '부서장',
            '2': '센터장',
            '3': '원장',
            '4': '행정원장',
            '5': '대표원장',
            '6': '최고관리자'
        };
        return levels[jobLevel] || jobLevel;
    };

    const renderDepartment = (dept: Department, level: number = 0) => {
        const baseCode = getBaseDeptCode(dept.deptCode);
        const isExpanded = expandedDepts.has(baseCode);
        const deptEmployees = employees[baseCode] || [];
        const displayName = deptNames[baseCode] || baseCode;

        return (
            <div key={dept.deptCode} className="org-dept-container">
                <div
                    className={`org-dept-item level-${level}`}
                    onClick={() => toggleDepartment(baseCode)}
                >
                    <div className="org-dept-header">
                        {isExpanded ? (
                            <ChevronDown className="org-icon"/>
                        ) : (
                            <ChevronRight className="org-icon"/>
                        )}
                        <Users className="org-icon"/>
                        <span className="org-dept-name">{displayName}</span>
                    </div>
                </div>

                {isExpanded && (
                    <div className="org-dept-content">
                        {/* 직원 목록 */}
                        {deptEmployees.length > 0 && (
                            <div className="org-employee-list">
                                {deptEmployees.map(emp => {
                                    const isSelected = multiSelect
                                        ? selectedUserIds.includes(emp.userId)
                                        : selectedUserId === emp.userId;

                                    return (
                                        <div
                                            key={emp.userId}
                                            className={`org-employee-item ${isSelected ? 'selected' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onUserSelect(emp.userId, emp.userName, emp.jobLevel);
                                            }}
                                        >
                                            <User className="org-icon" />
                                            <div className="org-employee-info">
                                                <span className="org-employee-name">{emp.userName}</span>
                                                <span className="org-employee-position">
                                                    {getJobLevelText(emp.jobLevel)}
                                                </span>
                                            </div>
                                            {isSelected && <span className="org-selected-badge">✓</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return <div className="org-loading">조직도를 불러오는 중...</div>;
    }

    return (
        <div className="org-chart-container">
            <div className="org-chart-header">
                <h3>조직도</h3>
                <p className="org-chart-description">
                    부서를 클릭하여 펼치고, 직원을 선택하세요
                </p>
                {/* ✅ 검색 입력란 */}
                <div className="org-search-container">
                    <input
                        type="text"
                        className="org-search-input"
                        placeholder="이름 또는 아이디로 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {searchTerm.trim().length >= 2 && (
                <div className="org-search-results">
                    <div className="org-search-results-header">
                        {isSearching ? '검색 중...' : `검색 결과 (${searchResults.length})`}
                    </div>
                    {!isSearching && searchResults.length === 0 ? (
                        <div className="org-search-no-results">
                            검색 결과가 없습니다.
                        </div>
                    ) : (
                        searchResults.map(emp => {
                            const isSelected = multiSelect
                                ? selectedUserIds.includes(emp.userId)
                                : selectedUserId === emp.userId;

                            return (
                                <div
                                    key={emp.userId}
                                    className={`org-employee-item ${isSelected ? 'selected' : ''}`}
                                    onClick={() => onUserSelect(emp.userId, emp.userName, emp.jobLevel)}
                                >
                                    <User className="org-icon" />
                                    <div className="org-employee-info">
                                        <span className="org-employee-name">{emp.userName}</span>
                                        <span className="org-employee-position">
                                        {getJobLevelText(emp.jobLevel)} · {deptNames[getBaseDeptCode(emp.deptCode)] || emp.deptCode}
                                    </span>
                                    </div>
                                    {isSelected && <span className="org-selected-badge">✓</span>}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            <div className="org-chart-tree">
                {departments.map(dept => renderDepartment(dept))}
            </div>
        </div>
    );
};

export default OrganizationChart;