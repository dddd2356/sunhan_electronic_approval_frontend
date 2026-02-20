import React, {useState, useEffect, useMemo} from 'react';
import { useCookies } from 'react-cookie';
import './style.css';
import Layout from "../Layout";
import {
    fetchContracts,
    fetchUsers,
    fetchCurrentUser,
    createContract, fetchPreviousContracts,
} from '../../apis/contract';
import {useNavigate} from "react-router-dom";

// 타입 정의
interface Contract {
    id: number;
    creatorId: string;
    employeeId: string;
    status: string;
    formDataJson: string;
    pdfUrl?: string;
    jpgUrl?: string;
    createdAt: string;
    updatedAt: string;
    employeeName?: string;
    creatorName?: string;
}

interface User {
    userId: string;
    userName: string;
    deptCode: string;
    deptName?: string;
    jobType: string;
    jobLevel: string;
    phone: string;
    address: string;
    role: string;
    useFlag?: string;
    permissions?: string[];
}

interface CreateContractModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (employeeId: string) => void;
    users: User[];
    token: string;
}

// 조직도 모달 컴포넌트
const CreateContractModal: React.FC<CreateContractModalProps> = ({
                                                                     isOpen,
                                                                     onClose,
                                                                     onSubmit,
                                                                     users,
                                                                     token  // 추가
                                                                 }) => {
    const navigate = useNavigate();
    const [selectedEmployee, setSelectedEmployee] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showPreviousContracts, setShowPreviousContracts] = useState(false);
    const [previousContracts, setPreviousContracts] = useState<Contract[]>([]);
    const [loadingPrevious, setLoadingPrevious] = useState(false);

    const filteredUsers = users.filter(user =>
        (user.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.userId?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    function getStatusText(s: string) {
        switch (s) {
            case 'DRAFT': return '작성중';
            case 'SENT_TO_EMPLOYEE': return '직원 검토중';
            case 'SIGNED_BY_EMPLOYEE': return '직원 서명 완료';
            case 'RETURNED_TO_ADMIN': return '반려됨';
            case 'COMPLETED': return '완료';
            default: return s;
        }
    }

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'status-draft';
            case 'SENT_TO_EMPLOYEE': return 'status-sent';
            case 'SIGNED_BY_EMPLOYEE': return 'status-signed';
            case 'RETURNED_TO_ADMIN': return 'status-return';
            case 'COMPLETED': return 'status-completed';
            default: return '';
        }
    };

    // 이전 계약서 목록 조회
    const handleLoadPrevious = async () => {
        if (!selectedEmployee) {
            alert('먼저 직원을 선택해주세요.');
            return;
        }

        setLoadingPrevious(true);
        try {
            const contracts = await fetchPreviousContracts(selectedEmployee, token);
            setPreviousContracts(contracts);
            setShowPreviousContracts(true);
        } catch (error) {
            console.error('이전 계약서 조회 실패:', error);
            alert('이전 계약서를 불러오는데 실패했습니다.');
        } finally {
            setLoadingPrevious(false);
        }
    };

    // 이전 계약서로 새 계약서 생성
    const handleSelectPrevious = async (previousContractId: number) => {
        try {
            // 빈 계약서 생성
            const newContract = await createContract(selectedEmployee, token);
            if (newContract && newContract.id) {
                // 편집 페이지로 이동하면서 이전 계약서 ID 전달
                navigate(`/detail/employment-contract/edit/${newContract.id}?loadFrom=${previousContractId}`);
                handleClose();
            }
        } catch (error) {
            console.error('계약서 생성 실패:', error);
            alert('계약서 생성에 실패했습니다.');
        }
    };

    const handleSubmit = () => {
        if (selectedEmployee) {
            onSubmit(selectedEmployee);
            handleClose();
        }
    };

    const handleClose = () => {
        setSelectedEmployee('');
        setSearchTerm('');
        setShowPreviousContracts(false);
        setPreviousContracts([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: showPreviousContracts ? '800px' : '500px' }}>
                <div className="modal-header">
                    <h2>근로계약서 작성</h2>
                    <button className="close-button" onClick={handleClose}>×</button>
                </div>

                <div className="modal-body">
                    {!showPreviousContracts ? (
                        // 1단계: 직원 선택
                        <>
                            <div className="search-section">
                                <input
                                    type="text"
                                    placeholder="직원 이름 또는 ID로 검색"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="search-input"
                                />
                            </div>

                            <div className="user-list">
                                {filteredUsers.map(user => (
                                    <div
                                        key={user.userId}
                                        className={`user-item ${selectedEmployee === user.userId ? 'selected' : ''}`}
                                        onClick={() => setSelectedEmployee(user.userId)}
                                    >
                                        <div className="user-info">
                                            <div className="user-name">{user.userName}</div>
                                            <div className="user-details">
                                                {user.userId} | {user.deptName || user.deptCode}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        // 2단계: 이전 계약서 목록
                        <>
                            <div style={{ marginBottom: '20px' }}>
                                <button
                                    className="back-button"
                                    onClick={() => setShowPreviousContracts(false)}
                                    style={{ marginBottom: '10px' }}
                                >
                                    ← 직원 선택으로 돌아가기
                                </button>
                                <h3>이전 계약서 선택</h3>
                                <p style={{ color: '#666', fontSize: '14px' }}>
                                    선택한 직원: <strong>{users.find(u => u.userId === selectedEmployee)?.userName}</strong>
                                </p>
                            </div>

                            {previousContracts.length === 0 ? (
                                <div className="empty-state">
                                    <p>이전 계약서가 없습니다.</p>
                                    <p style={{ fontSize: '14px', color: '#666' }}>
                                        새로 작성하기 버튼을 눌러주세요.
                                    </p>
                                </div>
                            ) : (
                                <div className="contract-history-list">
                                    {previousContracts.map(contract => (
                                        <div
                                            key={contract.id}
                                            className="contract-history-item"
                                            onClick={() => handleSelectPrevious(contract.id)}
                                            style={{
                                                padding: '15px',
                                                border: '1px solid #ddd',
                                                borderRadius: '8px',
                                                marginBottom: '10px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                                                e.currentTarget.style.borderColor = '#4CAF50';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'white';
                                                e.currentTarget.style.borderColor = '#ddd';
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                                                        <span className={`status-badge ${getStatusClass(contract.status)}`}>
                                                            {getStatusText(contract.status)}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '14px', color: '#666' }}>
                                                        작성일: {new Date(contract.createdAt).toLocaleDateString()}
                                                    </div>
                                                    <div style={{ fontSize: '14px', color: '#666' }}>
                                                        최종수정: {new Date(contract.updatedAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '24px', color: '#4CAF50' }}>→</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="cancel-button" onClick={handleClose}>취소</button>

                    {!showPreviousContracts ? (
                        <>
                            <button
                                className="history-button"
                                onClick={handleLoadPrevious}
                                disabled={!selectedEmployee || loadingPrevious}
                                style={{
                                    backgroundColor: '#2196F3',
                                    color: 'white'
                                }}
                            >
                                {loadingPrevious ? '조회중...' : '이전 계약서 불러오기'}
                            </button>
                            <button
                                className="confirm-button"
                                onClick={handleSubmit}
                                disabled={!selectedEmployee}
                            >
                                새로 작성
                            </button>
                        </>
                    ) : (
                        <button
                            className="confirm-button"
                            onClick={handleSubmit}
                        >
                            새로 작성하기
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const EmploymentContractBoard: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const token = localStorage.getItem('accessToken') || cookies.accessToken;
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [tab, setTab] = useState<'inprogress'|'completed'>('inprogress');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'all'|'employee'|'creator'|'status'>('all');
    const navigate = useNavigate();
    const [isLoadingContracts, setIsLoadingContracts] = useState(false);
    const [usersLoaded, setUsersLoaded] = useState(false);
    // 관리자 판정 유틸 (jobLevel 기준)
    const isAdminByLevel = (user: any) => {
        if (!user) return false;
        const level = Number(user.jobLevel);
        return (currentUser.role === 'ADMIN' && currentUser.jobLevel && parseInt(currentUser.jobLevel) === 6) || level >= 2 || ((level === 0 || level ===1) && user.permissions?.includes('HR_CONTRACT'));
    };
    // 현재 사용자 정보 가져오기
    useEffect(() => {
        if (token) {
            loadCurrentUser();
        }
    }, [token]);

    // 계약서 목록 가져오기 (currentUser 또는 tab 변경 시)
    useEffect(() => {
        if (currentUser) {
            loadContracts();
            // 검색 초기화 (탭 변경 시)
            setSearchTerm('');
            setSearchType('all');
            setCurrentPage(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser, tab]);

    // 사용자 목록 가져오기 (관리자만)
    useEffect(() => {
        if (usersLoaded) return; // ✅ 이미 로드했으면 스킵

        if (currentUser && currentUser.role === 'ADMIN' && (
            currentUser.jobLevel >= '2' ||
            (currentUser.permissions?.includes('HR_CONTRACT') && (currentUser.jobLevel === '0' || currentUser.jobLevel === '1'))
        )) {
            loadUsers();
            setUsersLoaded(true); // ✅ 로드 완료 표시
        }
    }, [currentUser, usersLoaded]);

    const loadCurrentUser = async () => {
        try {
            const userData = await fetchCurrentUser(token);
            setCurrentUser(userData);
        } catch (err) {
            console.error(err);
            setError('사용자 정보를 불러올 수 없습니다.');
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('직원 목록:', users);
    }, [users]);

    const loadContracts = async () => {
        if (isLoadingContracts) {
            console.log('⏭️ 이미 로딩 중 - 스킵');
            return;
        }

        setIsLoadingContracts(true);
        setLoading(true);
        try {
            const contractsData = await fetchContracts(tab === 'completed', token);
            const myIdCandidates = [
                currentUser?.id,
                currentUser?.userId,
                currentUser?.userid,
                currentUser?.user_id
            ].filter(Boolean).map((v: any) => String(v));

            const myId = myIdCandidates.length ? myIdCandidates[0] : null;
            // 안전하게 빈 배열 처리
            const all = contractsData || [];

            // 권한 기반 필터링 (상태별로 세분화된 권한 체크)
            const filteredByPermission = all.filter((c: any) => {
                const creatorId = String(c.creatorId ?? c.creatorIdStr ?? c.creator ?? '');
                const employeeId = String(c.employeeId ?? c.employeeIdStr ?? c.employee ?? '');
                const isCreator = myId ? creatorId === String(myId) : false;
                const isEmployee = myId ? employeeId === String(myId) : false;

                if (c.status === 'DRAFT') {
                    // DRAFT: 작성자(관리자)만
                    return isCreator;
                } else if (['SENT_TO_EMPLOYEE', 'SIGNED_BY_EMPLOYEE', 'RETURNED_TO_ADMIN'].includes(c.status)) {
                    // 중간 단계들: 작성자(관리자)와 대상 직원만
                    return isCreator || isEmployee;
                } else if (c.status === 'COMPLETED') {
                    // 완료: 모든 관리자와 해당 직원
                    return isAdminByLevel(currentUser) || isEmployee || isCreator;
                }
                return false;
            });


            // 2) 탭 필터: 작성자 본인은 자신의 문서는 해당 탭의 상태 기준으로 정상 분류되게 하되,
            //    (작성자의 문서는 원하면 모든 단계가 보이도록 하려면 OR isCreator 조건을 추가)
            const inProgressStatuses = ['DRAFT','SENT_TO_EMPLOYEE','SIGNED_BY_EMPLOYEE','RETURNED_TO_ADMIN'];

            // 탭별 필터링 (단순히 상태만 체크)
            const filtered = filteredByPermission.filter((c: any) => {
                if (tab === 'inprogress') {
                    return inProgressStatuses.includes(c.status);
                } else { // completed
                    return c.status === 'COMPLETED';
                }
            });

            filtered.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setContracts(filtered);
        } catch (err) {
            console.error(err);
            setError('네트워크 오류가 발생했습니다.');
        } finally {
            setLoading(false);
            setIsLoadingContracts(false);
        }
    };

    const loadUsers = async () => {
        try {
            // ✅ 캐시 먼저 확인
            const cached = sessionStorage.getItem('employeeList');
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;

                // 5분 이내면 캐시 사용
                if (age < 5 * 60 * 1000) {
                    console.log('✅ 직원 목록 캐시 사용');
                    setUsers(data);
                    return;
                }
            }

            console.log('🔄 직원 목록 조회 중...');
            const usersData = await fetchUsers(token);

            const activeOnly = (usersData || []).filter((u: any) => String(u.useFlag ?? '1') === '1');
            setUsers(activeOnly as any);

            // ✅ 캐시 저장
            sessionStorage.setItem('employeeList', JSON.stringify({
                data: activeOnly,
                timestamp: Date.now()
            }));

            console.log('✅ 직원 목록:', activeOnly.length, '명');
        } catch (err) {
            console.error('사용자 목록 조회 실패:', err);
        }
    };

    const handleCreateContract = async (employeeId: string) => {
        try {
            const newContract = await createContract(employeeId, token);
            if (newContract && (newContract as any).id) {
                navigate(`/detail/employment-contract/edit/${(newContract as any).id}`);
            } else {
                setError('계약서 생성에 실패했습니다.');
            }
        } catch (err) {
            console.error(err);
            setError('네트워크 오류가 발생했습니다.');
        }
    };

    const handleContractClick = (contract: Contract) => {
        if (contract.status === 'COMPLETED') {
            // 완료된 계약서는 조회 페이지로
            navigate(`/detail/employment-contract/view/${contract.id}`);
        } else if (
            contract.status === 'DRAFT' &&
            currentUser.role === 'ADMIN' &&
            (
                Number(currentUser.jobLevel) >= 2 ||
                (currentUser.permissions?.includes('HR_CONTRACT') && (Number(currentUser.jobLevel) === 0 || Number(currentUser.jobLevel) === 1))
            )
        ) {
            // 초안 상태이고 관리자인 경우 편집 페이지로
            navigate(`/detail/employment-contract/edit/${contract.id}`);
        } else if (contract.status === 'SENT_TO_EMPLOYEE' && contract.employeeId === currentUser.id) {
            // 발송된 계약서이고 해당 직원인 경우 사인을 넣을 수 있는 편집 페이지로
            navigate(`/detail/employment-contract/edit/${contract.id}`);
        } else {
            // 그 외의 경우 조회만 가능
            navigate(`/detail/employment-contract/view/${contract.id}`);
        }
    };

    function getStatusText(s: string) {
        switch (s) {
            case 'DRAFT': return '작성중';
            case 'SENT_TO_EMPLOYEE': return '직원 검토중';
            case 'SIGNED_BY_EMPLOYEE': return '직원 서명 완료';
            case 'RETURNED_TO_ADMIN': return '반려됨';
            case 'COMPLETED': return '완료';
            default: return s;
        }
    }

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'status-draft';
            case 'SENT_TO_EMPLOYEE': return 'status-sent';
            case 'SIGNED_BY_EMPLOYEE': return 'status-signed';
            case 'RETURNED_TO_ADMIN': return 'status-return';
            case 'COMPLETED': return 'status-completed';
            default: return '';
        }
    };

    // --- 검색 관련 로직: filteredContracts (useMemo) ---
    const filteredContracts = useMemo(() => {
        if (!searchTerm.trim()) return contracts;

        const q = searchTerm.toLowerCase();

        return contracts.filter(c => {
            switch (searchType) {
                case 'employee':
                    return (c.employeeName || c.employeeId || '').toLowerCase().includes(q);
                case 'creator':
                    return (c.creatorName || c.creatorId || '').toLowerCase().includes(q);
                case 'status':
                    return getStatusText(c.status).toLowerCase().includes(q);
                case 'all':
                default:
                    return (
                        (c.employeeName || c.employeeId || '').toLowerCase().includes(q) ||
                        (c.creatorName || c.creatorId || '').toLowerCase().includes(q) ||
                        getStatusText(c.status).toLowerCase().includes(q)
                    );
            }
        });
    }, [contracts, searchTerm, searchType]);

    // 검색어/검색타입 변경 시 페이지 초기화
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, searchType]);

    // 페이지 보정: 현재 페이지가 총 페이지 수보다 크면 마지막 페이지로 맞춤
    useEffect(() => {
        const len = filteredContracts.length;
        if (len === 0) {
            setCurrentPage(1);
            return;
        }
        const maxPage = Math.ceil(len / itemsPerPage);
        if (currentPage > maxPage) setCurrentPage(maxPage);
    }, [filteredContracts, currentPage]);

    if (loading) return <Layout>
        <div className="loading">
            로딩 중...
        </div>
    </Layout>;

    if (error) return <Layout>
        <div className="error">{error}</div>
    </Layout>;

    // pagination (검색 결과 기준)
    const totalPages = Math.ceil(filteredContracts.length / itemsPerPage);
    const startIdx   = (currentPage - 1) * itemsPerPage;
    const pageContracts = filteredContracts.slice(startIdx, startIdx + itemsPerPage);

    const noContractsAtAll = contracts.length === 0;
    const isSearching = searchTerm.trim().length > 0;
    const noSearchResults = isSearching && filteredContracts.length === 0;

    // 검색 플레이스홀더
    const getSearchPlaceholder = () => {
        switch (tab) {
            case 'inprogress': return '작성중/검토중 계약서 검색...';
            case 'completed': return '완료된 계약서 검색...';
            default: return '검색...';
        }
    };

    const pageGroupSize = 5;
    const startPage = Math.floor((currentPage - 1) / pageGroupSize) * pageGroupSize + 1;
    const endPage = Math.min(startPage + pageGroupSize - 1, totalPages);

    const handleNextGroup = () => {
        if (endPage < totalPages) {
            setCurrentPage(endPage + 1);
        }
    };

    const handlePrevGroup = () => {
        if (startPage > 1) {
            setCurrentPage(startPage - 1);
        }
    };


    return (
        <Layout>
            <div className="contract-board">
                <div className="board-header">
                    <h1>근로계약서 관리</h1>
                    {currentUser && (
                        ((currentUser.role === 'ADMIN' && currentUser.jobLevel >= '2')) ||
                        (
                            (currentUser.role === 'ADMIN') &&
                            (currentUser.permissions?.includes('HR_CONTRACT')) &&
                            ((currentUser.jobLevel === '0') || (currentUser.jobLevel === '1'))
                        )
                    ) && (
                        <button
                            className="create-button"
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            + 새 계약서 작성
                        </button>
                    )}
                </div>
                <div className="tabs">
                    <button
                        className={tab === 'inprogress' ? 'active' : ''}
                        onClick={() => {
                            setTab('inprogress');
                            setCurrentPage(1);
                        }}
                    >
                        작성중 및 검토중
                    </button>
                    <button
                        className={tab === 'completed' ? 'active' : ''}
                        onClick={() => {
                            setTab('completed');
                            setCurrentPage(1);
                        }}
                    >
                        완료된 계약서
                    </button>
                    {/* 검색영역: 기존 inline-search-section 이름 그대로 사용 */}
                    <span className="inline-search-section">
                        <select
                            value={searchType}
                            onChange={(e) => setSearchType(e.target.value as any)}
                            className="inline-search-select"
                        >
                            <option value="all">전체</option>
                            <option value="employee">직원명</option>
                            <option value="creator">작성자</option>
                            <option value="status">상태</option>
                        </select>

                        <input
                            type="text"
                            placeholder={getSearchPlaceholder()}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="inline-search-input"
                        />

                        {searchTerm && (
                            <button
                                onClick={() => { setSearchTerm(''); setSearchType('all'); }}
                                className="inline-search-reset"
                                title="검색 초기화"
                            >
                                ×
                            </button>
                        )}

                        {searchTerm && (
                            <span className="inline-search-count">
                                {filteredContracts.length}건
                            </span>
                        )}
                    </span>
                </div>

                <div className="contract-list">
                    {noContractsAtAll ? (
                        <div className="empty-state">
                            <p>등록된 계약서가 없습니다.</p>
                        </div>
                    ) : noSearchResults ? (
                        <div className="empty-state">
                            <p>해당 데이터가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="contract-list-container">
                            <div className="contract-list-header">
                                <div>ID</div>
                                <div>직원명</div>
                                <div>작성자</div>
                                <div>상태</div>
                                <div>작성일</div>
                                <div>수정일</div>
                            </div>

                            {pageContracts.map((contract, idx) => (
                                <div
                                    key={contract.id}
                                    className="contract-item"
                                    onClick={() => handleContractClick(contract)}
                                >
                                    <div className="contract-item-id">#{startIdx + idx + 1}</div>
                                    <div className="contract-item-employee">
                                        {contract.employeeName || contract.employeeId}
                                    </div>
                                    <div className="contract-item-creator">
                                        {contract.creatorName || contract.creatorId}
                                    </div>
                                    <div className={`contract-item-status ${getStatusClass(contract.status)}`}>
                                        {getStatusText(contract.status)}
                                    </div>
                                    <div className="contract-item-date">
                                        {new Date(contract.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="contract-item-updated">
                                        {new Date(contract.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                            {/* 맵핑 끝난 직후, 리스트 하단에 추가 */}
                            <div className="pagination">
                                {startPage > 1 && (
                                    <button onClick={handlePrevGroup}>&lt;</button>
                                )}
                                {Array.from({length: endPage - startPage + 1}, (_, i) => startPage + i).map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setCurrentPage(num)}
                                        className={num === currentPage ? 'active' : ''}
                                    >
                                        {num}
                                    </button>
                                ))}
                                {endPage < totalPages && (
                                    <button onClick={handleNextGroup}>&gt;</button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <CreateContractModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSubmit={handleCreateContract}
                    users={users}
                    token={token}
                />
            </div>
        </Layout>
    );
};

export default EmploymentContractBoard;