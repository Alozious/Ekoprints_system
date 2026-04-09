
import React from 'react';
import { DashboardIcon, SalesIcon, InventoryIcon, ExpensesIcon, CustomersIcon, ReportsIcon, UsersIcon, CalculatorIcon, CogIcon } from './icons';
import { User } from '../types';
import Logo from './Logo';

interface SidebarProps {
    activeView: string;
    setActiveView: (view: string) => void;
    currentUser: User;
    isOpen?: boolean;
    onClose?: () => void;
}

const NavItem = ({ icon: Icon, name, isActive, onClick }: { icon: React.FC<{ className?: string }>, name: string, isActive: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 py-3 px-4 rounded-lg transition-colors duration-200 relative ${isActive
                ? 'bg-yellow-400 text-[#1A2232] shadow-lg'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
    >
        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-white rounded-r-full"></div>}
        <Icon className="w-5 h-5" />
        <span className="font-semibold">{name}</span>
    </button>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, currentUser, isOpen = false, onClose }) => {
    const handleNav = (view: string) => {
        setActiveView(view);
        if (onClose) onClose();
    };
    const adminNavItems = [
        { name: 'Dashboard', icon: DashboardIcon },
        { name: 'Sales', icon: SalesIcon },
        { name: 'Calculator', icon: CalculatorIcon },
        { name: 'Inventory', icon: InventoryIcon },
        { name: 'Expenses', icon: ExpensesIcon },
        { name: 'Customers', icon: CustomersIcon },
        { name: 'Reports', icon: ReportsIcon },
        { name: 'Users', icon: UsersIcon },
        { name: 'Settings', icon: CogIcon },
    ];

    const userNavItems = [
        { name: 'Sales', icon: SalesIcon },
        { name: 'Calculator', icon: CalculatorIcon },
        { name: 'Expenses', icon: ExpensesIcon },
    ];

    if (currentUser.isBanker) {
        userNavItems.push({ name: 'Reports', icon: ReportsIcon });
    }

    const navItems = currentUser.role === 'admin' ? adminNavItems : userNavItems;

    return (
        <>
            {/* Mobile backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={`
                w-64 bg-[#1A2232] text-white flex-shrink-0 flex flex-col
                fixed inset-y-0 left-0 z-50
                transition-transform duration-300 ease-in-out
                md:static md:z-auto md:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex items-center justify-center p-4 bg-[#1A2232] border-b border-gray-700">
                    <Logo className="h-16" />
                </div>
                <nav className="flex-1 mt-6 overflow-y-auto">
                    <ul className="space-y-2">
                        {navItems.map((item) => (
                            <li key={item.name} className="px-4">
                                <NavItem
                                    name={item.name}
                                    icon={item.icon}
                                    isActive={activeView === item.name}
                                    onClick={() => handleNav(item.name)}
                                />
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="p-4 border-t border-gray-700 text-center text-xs text-gray-400">
                    <p>&copy; {new Date().getFullYear()} Eko Prints</p>
                    <p>All rights reserved.</p>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
