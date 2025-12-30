import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Search } from 'lucide-react'; // 아이콘 추가
import './style.css';
import hospitalImage from './assets/images/newExecution.png';

interface HeaderProps {
    toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
    const navigate = useNavigate();

    return (
        <header className='header'>
            <div className='contents'>
                {/* 왼쪽 섹션: 메뉴 버튼 + 서비스 로고 */}
                <div className='header-left'>
                    <button
                        className="menu-toggle-btn"
                        onClick={toggleSidebar}
                        title="메뉴 열기/닫기"
                    >
                        <Menu size={24} />
                    </button>

                    <div className='logo-area' onClick={() => navigate('/detail/main-page')}>
                        <img src={hospitalImage} alt="선한병원 로고" className="hospital-image"/>
                        <span className='image-text'>선한병원 <span style={{color: '#6b7280', fontWeight: 400}}>전자결재</span></span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;