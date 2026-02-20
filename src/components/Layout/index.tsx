import {useCallback, useEffect, useState} from "react";
import Header from "./Header";
import Sidebar from "../SideBar";
import "./style.css"

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    // ✅ 모바일에서는 기본적으로 닫힌 상태로 시작
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        return window.innerWidth > 768; // 데스크톱이면 true, 모바일이면 false
    });

    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    const closeSidebar = useCallback(() => {
        setIsSidebarOpen(false);
    }, []);

    // ✅ 화면 크기 변경 시 자동 조정 (선택사항)
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 768) {
                setIsSidebarOpen(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="layout">
            <Header toggleSidebar={toggleSidebar} />
            <div className="content-container">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onClose={closeSidebar}
                />
                <div className={`main-content ${isSidebarOpen ? '' : 'full-width'}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Layout;