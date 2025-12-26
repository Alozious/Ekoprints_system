
import React, { useState } from 'react';
import { SearchIcon, BellIcon, ChevronDownIcon, LogoutIcon, MenuIcon } from './icons';
import { User } from '../types';

interface HeaderProps {
    pageTitle: string;
    currentUser: User;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ pageTitle, currentUser, onLogout }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    return (
        <header className="bg-white shadow-sm h-16 flex-shrink-0 z-10">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-full">
                <div className="flex items-center justify-between h-full">
                    <div className="flex items-center">
                        <button className="md:hidden mr-4 text-gray-600">
                            <MenuIcon className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-semibold text-gray-800 hidden md:block">
                            Welcome To Eko Prints Management System
                        </h1>
                        <h1 className="text-xl font-semibold text-gray-800 md:hidden">
                            {pageTitle}
                        </h1>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                         <div className="relative hidden md:block">
                            <input
                                type="text"
                                placeholder="Search Here..."
                                className="w-full pl-4 pr-10 py-2 bg-gray-800 text-white border-transparent rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400"
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <SearchIcon className="w-5 h-5 text-gray-300" />
                            </div>
                        </div>

                        <button className="relative text-gray-600 hover:text-gray-800">
                            <BellIcon className="w-6 h-6" />
                            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                        </button>

                        <div className="relative">
                            <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-2">
                                <img
                                    className="h-9 w-9 rounded-full object-cover"
                                    src={`https://ui-avatars.com/api/?name=${currentUser.username.replace(' ', '+')}&background=FBBF24&color=fff`}
                                    alt="User avatar"
                                />
                                <div className="hidden md:block text-left">
                                    <div className="text-sm font-semibold text-gray-800">{currentUser.username}</div>
                                    <div className="text-xs text-gray-500 capitalize">{currentUser.role}</div>
                                </div>
                                <ChevronDownIcon className="w-4 h-4 text-gray-500 hidden md:block" />
                            </button>
                            {isDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20">
                                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Profile</a>
                                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Settings</a>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button
                                        onClick={onLogout}
                                        className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                    >
                                        <LogoutIcon className="w-5 h-5 mr-2" />
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
