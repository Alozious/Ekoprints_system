
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit User: ${user.username}`}>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required
            />
          </div>
          
          {/* Email is generally not editable as it links to Auth UID, displayed for info */}
          <div>
            <label className="block text-sm font-medium text-gray-500">Email</label>
            <p className="mt-1 text-sm text-gray-800">{user.email}</p>
          </div>

          {isSelf && (
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Leave blank to keep current"
              />
            </div>
          )}
          
          {!isSelf && (
             <div>
                <label className="block text-sm font-medium text-gray-500">Password</label>
                <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded border">Password updates for other users are not supported here. Please delete and recreate the user if a password reset is required and they cannot login.</p>
             </div>
          )}

          <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select 
                value={role} 
                onChange={e => setRole(e.target.value as 'admin' | 'user')} 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" 
                disabled={isSelf}
                title={isSelf ? "Cannot change your own role" : ""}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
          </div>
          
          {role === 'user' && (
            <div className="flex items-center mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                <input
                    id="edit-is-banker"
                    type="checkbox"
                    checked={isBanker}
                    onChange={(e) => setIsBanker(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="edit-is-banker" className="ml-2 block text-sm text-gray-900">
                    Assign Banking Role <span className="text-gray-500 text-xs block">(User collects total daily income)</span>
                </label>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700">Save Changes</button>
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
        addToast("Email and password are required.", "error");
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


  const getRoleBadgeColor = (role: User['role']) => {
    return role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-md hover:bg-yellow-600 transition-colors font-semibold">
            <PlusIcon className="w-5 h-5 mr-2"/> Add User
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                    <th scope="col" className="px-6 py-3">Username</th>
                    <th scope="col" className="px-6 py-3">Email</th>
                    <th scope="col" className="px-6 py-3">Role</th>
                    <th scope="col" className="px-6 py-3">Actions</th>
                </tr>
                </thead>
                <tbody>
                {users.map((user, index) => (
                    <tr key={user.id} className="bg-white border-b hover:bg-gray-50 slide-in-up" style={{ animationDelay: `${index * 20}ms` }}>
                        <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{user.username}</th>
                        <td className="px-6 py-4 text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 flex items-center gap-2">
                             <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                                {user.role.toUpperCase()}
                            </span>
                            {user.isBanker && (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                    Banker
                                </span>
                            )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit User"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
      </div>
      
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New User">
        <form onSubmit={handleAddUser}>
          <div className="grid grid-cols-1 gap-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <input type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
              </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input type="password" value={newUser.password || ''} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required minLength={6} />
              </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'user' })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
              </div>

              {newUser.role === 'user' && (
                <div className="flex items-center mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <input
                        id="new-is-banker"
                        type="checkbox"
                        checked={newUser.isBanker || false}
                        onChange={(e) => setNewUser({...newUser, isBanker: e.target.checked})}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="new-is-banker" className="ml-2 block text-sm text-gray-900">
                        Assign Banking Role <span className="text-gray-500 text-xs block">(User collects total daily income)</span>
                    </label>
                </div>
              )}
          </div>
          <div className="mt-6 flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 transition-colors">Create User</button>
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