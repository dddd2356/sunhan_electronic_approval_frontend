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
        fetchDepartments();
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

    const fetchDepartments = async () => {
        try {
            const response = await fetch('/api/v1/user/departments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            setDepartments(buildDepartmentTree(data));
        } catch (error) {
            console.error('부서 목록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    // ✅ 부서명 조회 추가
    const fetchDepartmentNames = async () => {
        try {
            const response = await fetch('/api/v1/departments/names', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            const normalized: Record<string, string> = {};
            Object.entries(data).forEach(([code, name]) => {
                const baseCode = getBaseDeptCode(code);
                if (!normalized[baseCode]) {
                    normalized[baseCode] = name as string;
                }
            });

            setDeptNames(normalized);
        } catch (error) {
            console.error('부서 이름 조회 실패:', error);
        }
    };

    const fetchEmployees = async (deptCode: string) => {
        const baseCode = getBaseDeptCode(deptCode);
        if (employees[baseCode]) return;

        try {
            const isBaseDept = !/\d+$/.test(deptCode);

            // ✅ allDepartments prop에 따라 엔드포인트 선택
            const endpoint = allDepartments
                ? `/api/v1/user/department/${baseCode}/all?includeSubDepts=true`
                : `/api/v1/user/department/${baseCode}?includeSubDepts=true`;

            const response = await fetch(endpoint, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json();
            setEmployees(prev => ({ ...prev, [deptCode]: data }));
        } catch (error) {
            console.error('직원 목록 조회 실패:', error);
        }
    };

    const buildDepartmentTree = (depts: Department[]): Department[] => {
        const map = new Map<string, Department>();
        const roots: Department[] = [];

        // 숫자 제외 base 코드로 그룹화 (기존 로직 유지 + 강화)
        const getBaseDeptCode = (code: string) => code.replace(/\d+$/, '');

        const groupedDepts = new Map<string, Department[]>();
        depts.forEach(dept => {
            const baseCode = getBaseDeptCode(dept.deptCode);
            if (!groupedDepts.has(baseCode)) {
                groupedDepts.set(baseCode, []);
            }
            groupedDepts.get(baseCode)!.push(dept); // 묶어서 포함
        });

        // ✅ 2단계: 그룹화된 부서를 대표 노드로 변환
        groupedDepts.forEach((subDepts, baseCode) => {
            if (subDepts.length === 1) {
                // 단일 부서는 그대로 사용
                const dept = subDepts[0];
                map.set(dept.deptCode, { ...dept, children: [] });
            } else {
                // 여러 하위 부서가 있는 경우 대표 노드 생성
                const representativeDept: Department = {
                    deptCode: baseCode,
                    deptName: subDepts[0].deptName.replace(/\d+$/, ''), // 숫자 제거
                    parentDeptCode: subDepts[0].parentDeptCode,
                    children: subDepts.map(d => ({ ...d, parentDeptCode: baseCode, children: [] }))
                };
                map.set(baseCode, representativeDept);
            }
        });

        // ✅ 3단계: 부모-자식 관계 설정 (기존 로직 유지)
        map.forEach((node) => {
            if (node.parentDeptCode) {
                const parentBase = getBaseDeptCode(node.parentDeptCode);
                const parent = map.get(parentBase) || map.get(node.parentDeptCode);
                if (parent) {
                    parent.children!.push(node);
                } else {
                    roots.push(node);
                }
            } else {
                roots.push(node);
            }
        });

        return roots;
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