
import React from 'react';
import { DashboardIcon, SalesIcon, InventoryIcon, ExpensesIcon, CustomersIcon, ReportsIcon, UsersIcon, CalculatorIcon } from './icons';
import { User } from '../types';

interface SidebarProps {
    activeView: string;
    setActiveView: (view: string) => void;
    currentUser: User;
}

const EkoPrintsLogo = () => (
    <div className="flex items-center justify-center p-6 bg-[#1A2232] border-b border-gray-700">
        <span className="text-3xl font-bold tracking-tighter text-white">Eko</span>
        <span className="text-3xl font-bold text-yellow-400 ml-1">Prints</span>
    </div>
);

const NavItem = ({ icon: Icon, name, isActive, onClick }: { icon: React.FC<{className?: string}>, name: string, isActive: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 py-3 px-4 rounded-lg transition-colors duration-200 relative ${
            isActive
                ? 'bg-yellow-400 text-[#1A2232] shadow-lg'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
    >
        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-white rounded-r-full"></div>}
        <Icon className="w-5 h-5" />
        <span className="font-semibold">{name}</span>
    </button>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, currentUser }) => {
    const adminNavItems = [
        { name: 'Dashboard', icon: DashboardIcon },
        { name: 'Sales', icon: SalesIcon },
        { name: 'Calculator', icon: CalculatorIcon },
        { name: 'Inventory', icon: InventoryIcon },
        { name: 'Expenses', icon: ExpensesIcon },
        { name: 'Customers', icon: CustomersIcon },
        { name: 'Reports', icon: ReportsIcon },
        { name: 'Users', icon: UsersIcon },
    ];
    
    const userNavItems = [
        { name: 'Sales', icon: SalesIcon },
        { name: 'Calculator', icon: CalculatorIcon },
        { name: 'Expenses', icon: ExpensesIcon },
    ];

    // Allow Bankers to see Reports to check Total Income
    if (currentUser.isBanker) {
        userNavItems.push({ name: 'Reports', icon: ReportsIcon });
    }

    const navItems = currentUser.role === 'admin' ? adminNavItems : userNavItems;

    return (
        <aside className="w-64 bg-[#1A2232] text-white flex-shrink-0 flex-col hidden md:flex">
            <EkoPrintsLogo />
            <nav className="flex-1 mt-6">
                <ul className="space-y-2">
                    {navItems.map((item) => (
                        <li key={item.name} className="px-4">
                            <NavItem
                                name={item.name}
                                icon={item.icon}
                                isActive={activeView === item.name}
                                onClick={() => setActiveView(item.name)}
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
    );
};

export default Sidebar;
