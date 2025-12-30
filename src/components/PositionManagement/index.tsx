import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { useNavigate } from 'react-router-dom';
import Layout from '../Layout';
import {
    fetchPositionsByDept,
    createPosition,
    updatePosition,
    deletePosition,
    reorderPositions,
    Position
} from '../../apis/Position';
import './style.css';
import axios from "axios";

const PositionManagement: React.FC = () => {
    const [cookies] = useCookies(['accessToken']);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // 생성/수정 모달
    const [showModal, setShowModal] = useState(false);
    const [editingPosition, setEditingPosition] = useState<Position | null>(null);
    const [positionName, setPositionName] = useState('');
    const [displayOrder, setDisplayOrder] = useState<number | null>(null);
    const navigate = useNavigate();

    const [departmentNames, setDepartmentNames] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchDepartmentNames = async () => {
            try {
                const response = await axios.get('/api/v1/departments/names', {
                    headers: { Authorization: `Bearer ${cookies.accessToken}` }
                });
                setDepartmentNames(response.data);
            } catch (error) {
                console.error('부서 이름 조회 실패:', error);
            }
        };
        fetchDepartmentNames();
    }, []);

    useEffect(() => {
        checkAccess();
    }, []);

    const checkAccess = async () => {
        try {
            const userRes = await fetch('/api/v1/user/me/permissions', {
                headers: { Authorization: `Bearer ${cookies.accessToken}` }
            });
            const userData = await userRes.json();
            const permissions: string[] = userData.permissions || [];
            // ✅ WORK_SCHEDULE_CREATE 권한 확인
            const hasCreatePermission = permissions.includes('WORK_SCHEDULE_CREATE');
            const isSuperAdmin = parseInt(userData.jobLevel) === 6;

            if (!hasCreatePermission && !isSuperAdmin) {
                alert('직책 관리 권한이 없습니다.');
                navigate('/detail/main-page');
                return;
            }

            setCurrentUser(userData); 
            await loadData();
        } catch (err) {
            navigate('/detail/main-page');
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // 현재 사용자 정보
            const userRes = await fetch('/api/v1/user/me', {
                headers: { Authorization: `Bearer ${cookies.accessToken}` }
            });
            const userData = await userRes.json();
            setCurrentUser(userData);

            // 직책 목록
            const positionsData = await fetchPositionsByDept(userData.deptCode, cookies.accessToken);
            setPositions(positionsData);

        } catch (err: any) {
            setError(err.response?.data?.error || '데이터를 불러올 수 없습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingPosition(null);
        setPositionName('');
        setDisplayOrder(null);
        setShowModal(true);
    };

    const handleEdit = (position: Position) => {
        setEditingPosition(position);
        setPositionName(position.positionName);
        setDisplayOrder(position.displayOrder);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!positionName.trim()) {
            alert('직책명을 입력하세요.');
            return;
        }

        try {
            if (editingPosition) {
                // 수정
                await updatePosition(
                    editingPosition.id,
                    positionName,
                    displayOrder,
                    cookies.accessToken
                );
                alert('직책이 수정되었습니다.');
            } else {
                // 생성
                await createPosition(
                    currentUser.deptCode,
                    positionName,
                    displayOrder,
                    cookies.accessToken
                );
                alert('직책이 생성되었습니다.');
            }

            setShowModal(false);
            await loadData();
        } catch (err: any) {
            alert(err.response?.data?.error || '저장 실패');
        }
    };

    const handleDelete = async (positionId: number) => {
        if (!window.confirm('이 직책을 삭제하시겠습니까?')) return;

        try {
            await deletePosition(positionId, cookies.accessToken);
            alert('직책이 삭제되었습니다.');
            await loadData();
        } catch (err: any) {
            alert(err.response?.data?.error || '삭제 실패');
        }
    };

    const moveUp = async (position: Position, index: number) => {
        if (index === 0) return;

        const newPositions = [...positions];
        [newPositions[index - 1], newPositions[index]] = [newPositions[index], newPositions[index - 1]];

        try {
            await reorderPositions(
                currentUser.deptCode,
                newPositions.map(p => p.id),
                cookies.accessToken
            );
            await loadData();
        } catch (err: any) {
            alert(err.response?.data?.error || '순서 변경 실패');
        }
    };

    const moveDown = async (position: Position, index: number) => {
        if (index === positions.length - 1) return;

        const newPositions = [...positions];
        [newPositions[index], newPositions[index + 1]] = [newPositions[index + 1], newPositions[index]];

        try {
            await reorderPositions(
                currentUser.deptCode,
                newPositions.map(p => p.id),
                cookies.accessToken
            );
            await loadData();
        } catch (err: any) {
            alert(err.response?.data?.error || '순서 변경 실패');
        }
    };

    if (loading) return <Layout>
        <div className="pm-loading">
            <div className="loading">로딩중...</div>
        </div>
    </Layout>;
    if (error) return <Layout><div className="pm-error">{error}</div></Layout>;

    return (
        <Layout>
            <div className="position-management">
                <div className="pm-page-header">
                    <div>
                        <h1>직책 관리</h1>
                        <span className="pm-header-info">
                            {/* 부서명 등 메타 정보 표시, 없으면 아래 텍스트 */}
                            근무표 및 결재 라인에 표시될 직책를 관리합니다.
                        </span>
                    </div>
                    {/* 상단 액션 버튼 위치 이동 */}
                    <button className="pm-btn-create" onClick={() => {
                        setEditingPosition(null);
                        setPositionName('');
                        setDisplayOrder(null);
                        setShowModal(true);
                    }}>
                        {/* + 아이콘 효과 */}
                        <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> 직위 추가
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                        데이터를 불러오는 중입니다...
                    </div>
                ) : error ? (
                    <div style={{ padding: '16px', background: '#fee2e2', color: '#ef4444', borderRadius: '8px' }}>
                        {error}
                    </div>
                ) : (
                    <div className="pm-position-list">
                        {positions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #e5e7eb' }}>
                                등록된 직책가 없습니다. '직책 추가' 버튼을 눌러 시작하세요.
                            </div>
                        ) : (
                            positions.map((pos) => (
                                <div key={pos.id} className="pm-position-card">
                                    <div className="pm-card-info">
                                        <h3>{pos.positionName}</h3>
                                        <p>표시 순서: {pos.displayOrder}</p>
                                    </div>
                                    <div className="pm-card-actions">
                                        <button
                                            className="pm-btn-edit"
                                            onClick={() => {
                                                setEditingPosition(pos);
                                                setPositionName(pos.positionName);
                                                setDisplayOrder(pos.displayOrder);
                                                setShowModal(true);
                                            }}
                                        >
                                            수정
                                        </button>
                                        <button
                                            className="pm-btn-delete"
                                            onClick={() => handleDelete(pos.id)}
                                        >
                                            삭제
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* 모달 로직 그대로 유지, 클래스 스타일만 CSS에서 변경됨 */}
                {showModal && (
                    <div className="pm-modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="pm-modal-content" onClick={(e) => e.stopPropagation()}>
                            <h2>{editingPosition ? '직책 수정' : '새 직책 추가'}</h2>

                            <div className="pm-form-group">
                                <label>직책 명칭</label>
                                <input
                                    type="text"
                                    value={positionName}
                                    onChange={(e) => setPositionName(e.target.value)}
                                    placeholder="예: 수간호사, 팀장 (필수)"
                                    className="pm-form-input"
                                    autoFocus
                                />
                            </div>

                            <div className="pm-form-group">
                                <label>표시 순서</label>
                                <input
                                    type="number"
                                    value={displayOrder || ''}
                                    onChange={(e) => setDisplayOrder(e.target.value ? parseInt(e.target.value) : null)}
                                    placeholder="숫자가 작을수록 상위에 표시됩니다"
                                    className="pm-form-input"
                                />
                                <small>비워두면 자동으로 목록의 마지막 순서로 지정됩니다.</small>
                            </div>

                            <div className="pm-modal-actions">
                                <button onClick={() => setShowModal(false)} className="pm-btn-cancel">
                                    취소
                                </button>
                                <button onClick={handleSave} className="pm-btn-confirm">
                                    {editingPosition ? '저장하기' : '추가하기'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default PositionManagement;