
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import Modal from './Modal';
import { PlusIcon, EditIcon } from './icons';
import { useToast } from '../App';

interface UserManagementViewProps {
  users: User[];
  currentUser: User;
  onAddUser: (userData: Omit<User, 'id'> & { password?: string }) => Promise<void>;
  onUpdateUser: (updatedUser: User) => Promise<void>;
}

const EditUserModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUpdate: (updatedUser: User) => void;
  currentUser: User;
}> = ({ isOpen, onClose, user, onUpdate, currentUser }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isBanker, setIsBanker] = useState(false);
  const [role, setRole] = useState<'admin' | 'user'>('user');

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setPassword(''); 
      setIsBanker(user.isBanker || false);
      setRole(user.role);
    }
  }, [user]);

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser: User = { ...user, username, role, isBanker };
    if (password.trim() !== '') {
      updatedUser.password = password.trim();
    }
    onUpdate(updatedUser);
  };

  const isSelf = currentUser.id === user.id;
  const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";
  const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit User: ${user.username}`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <div>
            <label className={labelStyle}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className={darkInput}
              required
            />
          </div>
          
          <div>
            <label className={labelStyle}>Email Address (Read-Only)</label>
            <div className="p-3 bg-gray-100 rounded-xl text-sm font-bold text-gray-500 border border-gray-200">{user.email}</div>
          </div>

          {isSelf && (
            <div>
              <label className={labelStyle}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={darkInput}
                placeholder="Leave blank to keep current"
              />
            </div>
          )}
          
          {!isSelf && (
             <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="text-[10px] text-blue-700 font-black uppercase leading-relaxed tracking-tight">Security Protocol: Password resets for other personnel are restricted. Personnel must utilize automated recovery or account re-provisioning.</p>
             </div>
          )}

          <div>
              <label className={labelStyle}>Access Level (Role)</label>
              <select 
                value={role} 
                onChange={e => setRole(e.target.value as 'admin' | 'user')} 
                className={darkInput}
                disabled={isSelf}
                title={isSelf ? "Self-role modification restricted" : ""}
              >
                <option value="user" className="bg-gray-800">User (Operational)</option>
                <option value="admin" className="bg-gray-800">Admin (Supervisory)</option>
              </select>
          </div>
          
          {role === 'user' && (
            <div className="flex items-center p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <div className="relative flex items-center">
                    <input
                        id="edit-is-banker"
                        type="checkbox"
                        checked={isBanker}
                        onChange={(e) => setIsBanker(e.target.checked)}
                        className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-purple-300 rounded-lg cursor-pointer"
                    />
                </div>
                <label htmlFor="edit-is-banker" className="ml-3 block cursor-pointer">
                    <span className="text-[11px] font-black text-purple-700 uppercase tracking-widest block">Assign Banking Credentials</span>
                    <span className="text-[9px] text-purple-500 font-bold uppercase block opacity-70">Enables viewing of sensitive financial audit reports</span>
                </label>
            </div>
          )}
        </div>
        <div className="pt-4">
          <button type="submit" className="w-full bg-[#1A2232] text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl active:scale-95 transition-all border border-yellow-400/20 hover:bg-gray-800">Commit User Updates</button>
        </div>
      </form>
    </Modal>
  );
};

const UserManagementView: React.FC<UserManagementViewProps> = ({ users, currentUser, onAddUser, onUpdateUser }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { addToast } = useToast();

  const [newUser, setNewUser] = useState<Omit<User, 'id'>>({
    username: '',
    email: '',
    password: '',
    role: 'user',
    isBanker: false
  });

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password) {
        addToast("Authentication payload incomplete.", "error");
        return;
    }
    await onAddUser(newUser);
    setNewUser({ username: '', email: '', password: '', role: 'user', isBanker: false });
    setIsAddModalOpen(false);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (updatedUser: User) => {
    await onUpdateUser(updatedUser);
    setIsEditModalOpen(false);
    setEditingUser(null);
  };

  const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";
  const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5";

  return (
    <div className="space-y-4">
      {/* Merged header bar */}
      <div className="bg-white px-4 py-3 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-3">
        <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest whitespace-nowrap">System Access Registry</span>
        <div className="ml-auto">
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-yellow-400 text-[#1A2232] px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-yellow-500 shadow-md active:scale-95 transition-all whitespace-nowrap">
            <PlusIcon className="w-3.5 h-3.5 mr-1" /> Add User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100">
        <table className="w-full table-fixed text-left">
          <thead className="bg-gray-50 text-gray-400 uppercase font-black text-[9px] tracking-widest">
            <tr>
              <th className="px-4 py-3 w-[22%]">Username</th>
              <th className="px-4 py-3 w-[34%]">Email Address</th>
              <th className="px-4 py-3 w-[36%]">Role & Clearance</th>
              <th className="px-4 py-3 w-[8%]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => (
              <tr key={user.id} className="bg-white hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-2 text-[10px] font-black text-gray-900 uppercase truncate">{user.username}</td>
                <td className="px-4 py-2 text-[10px] text-gray-500 font-medium truncate">{user.email}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-tight rounded-full border ${user.role === 'admin' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                      {user.role}
                    </span>
                    {user.isBanker && (
                      <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-tight rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                        Banker
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <button onClick={() => handleOpenEditModal(user)} title="Edit User"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 transition-all active:scale-90">
                    <EditIcon className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center text-gray-300 font-black uppercase tracking-[0.4em] text-[10px]">No personnel registered</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Personnel">
        <form onSubmit={handleAddUser} className="space-y-6">
          <div className="grid grid-cols-1 gap-5">
              <div>
                  <label className={labelStyle}>Display Name</label>
                  <input type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className={darkInput} required placeholder="Full Name" />
              </div>
              <div>
                  <label className={labelStyle}>Official Email</label>
                  <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className={darkInput} required placeholder="user@ekoprints.com" />
              </div>
               <div>
                  <label className={labelStyle}>Initial Password</label>
                  <input type="password" value={newUser.password || ''} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className={darkInput} required minLength={6} placeholder="••••••••" />
              </div>
               <div>
                  <label className={labelStyle}>Account Role</label>
                  <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'user' })} className={darkInput} required>
                    <option value="user" className="bg-gray-800">User (Standard Access)</option>
                    <option value="admin" className="bg-gray-800">Admin (Unrestricted Access)</option>
                  </select>
              </div>

              {newUser.role === 'user' && (
                <div className="flex items-center p-4 bg-purple-50 rounded-2xl border border-purple-100">
                    <input
                        id="new-is-banker"
                        type="checkbox"
                        checked={newUser.isBanker || false}
                        onChange={(e) => setNewUser({...newUser, isBanker: e.target.checked})}
                        className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-purple-300 rounded-lg cursor-pointer"
                    />
                    <label htmlFor="new-is-banker" className="ml-3 block cursor-pointer">
                        <span className="text-[11px] font-black text-purple-700 uppercase tracking-widest block">Assign Banker Privileges</span>
                        <span className="text-[9px] text-purple-500 font-bold uppercase block opacity-70">Allows access to banking and financial dashboards</span>
                    </label>
                </div>
              )}
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 transition-all hover:bg-blue-700 border border-blue-500/20">Authorize Personnel Registry</button>
          </div>
        </form>
      </Modal>

      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={editingUser}
        onUpdate={handleUpdateUser}
        currentUser={currentUser}
      />
    </div>
  );
};

export default UserManagementView;
