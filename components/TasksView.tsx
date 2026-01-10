
import React, { useState, useEffect, useMemo } from 'react';
import { Task, User, Sale } from '../types';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import { PlusIcon, EditIcon, TrashIcon, CalendarIcon, TaskIcon } from './icons';
import { useToast } from '../App';

interface TasksViewProps {
  tasks: Task[];
  users: User[];
  currentUser: User;
  sales: Sale[];
  onAddTask: (taskData: Omit<Task, 'id'>) => Promise<void>;
  onUpdateTask: (id: string, taskData: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

const Countdown: React.FC<{ deadline: string }> = ({ deadline }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const [isOverdue, setIsOverdue] = useState(false);

    useEffect(() => {
        const calculate = () => {
            const now = new Date().getTime();
            const target = new Date(deadline).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setTimeLeft('OVERDUE');
                setIsOverdue(true);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (days > 0) setTimeLeft(`${days}d ${hours}h left`);
            else if (hours > 0) setTimeLeft(`${hours}h ${mins}m left`);
            else setTimeLeft(`${mins}m left`);
        };

        calculate();
        const timer = setInterval(calculate, 60000);
        return () => clearInterval(timer);
    }, [deadline]);

    return (
        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isOverdue ? 'bg-red-500 text-white animate-pulse' : 'bg-yellow-400 text-gray-900'}`}>
            {timeLeft}
        </span>
    );
};

const TasksView: React.FC<TasksViewProps> = ({ tasks, users, currentUser, sales, onAddTask, onUpdateTask, onDeleteTask }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
      title: '',
      description: '',
      assignedTo: '',
      deadline: '',
      saleId: ''
  });

  const filteredTasks = useMemo(() => {
      if (currentUser.role === 'admin') return tasks;
      return tasks.filter(t => t.assignedTo === currentUser.id);
  }, [tasks, currentUser]);

  const handleOpenAdd = () => {
      setFormData({ title: '', description: '', assignedTo: '', deadline: '', saleId: '' });
      setIsAddModalOpen(true);
  };

  const handleSaveTask = async () => {
      if (!formData.title || !formData.assignedTo || !formData.deadline) return;
      
      const assignee = users.find(u => u.id === formData.assignedTo);
      const data: Omit<Task, 'id'> = {
          ...formData,
          assignedToName: assignee?.username || 'Unknown',
          assignedBy: currentUser.id,
          deadline: new Date(formData.deadline).toISOString(),
          status: 'Pending',
          createdAt: new Date().toISOString()
      };

      await onAddTask(data);
      setIsAddModalOpen(false);
  };

  const handleUpdateStatus = async (task: Task, newStatus: Task['status']) => {
      await onUpdateTask(task.id, { status: newStatus });
      addToast(`Status updated to ${newStatus}`, "info");
  };

  const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";
  const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5";

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Production Workflow</h2>
        {currentUser.role === 'admin' && (
            <button onClick={handleOpenAdd} className="bg-yellow-500 text-[#1A2232] px-8 py-3 rounded-2xl font-black flex items-center shadow-xl hover:bg-yellow-600 active:scale-95 transition-all text-xs tracking-widest uppercase">
                <PlusIcon className="w-5 h-5 mr-3"/> Create Task
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map(task => (
              <div key={task.id} className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden group flex flex-col">
                  <div className="p-8 flex-1">
                      <div className="flex justify-between items-start mb-6">
                           <Countdown deadline={task.deadline} />
                           <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${
                               task.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-100' :
                               task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                               'bg-gray-50 text-gray-400 border-gray-100'
                           }`}>
                               {task.status}
                           </span>
                      </div>
                      
                      <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-2 group-hover:text-blue-600 transition-colors">{task.title}</h3>
                      <p className="text-xs text-gray-500 font-bold leading-relaxed mb-6">{task.description}</p>
                      
                      <div className="space-y-3">
                          <div className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              <CalendarIcon className="w-3.5 h-3.5 mr-2"/> Deadline: {new Date(task.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                          {currentUser.role === 'admin' && (
                              <div className="flex items-center text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                  <TaskIcon className="w-3.5 h-3.5 mr-2"/> Assignee: {task.assignedToName}
                              </div>
                          )}
                          {task.saleId && (
                              <div className="bg-gray-50 p-2 rounded-xl text-[9px] font-black text-gray-500 border border-gray-100 uppercase text-center tracking-widest">
                                  Linked to Invoice #{task.saleId.substring(0,8).toUpperCase()}
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex gap-2">
                       {task.status !== 'Completed' ? (
                           <>
                               <button 
                                 onClick={() => handleUpdateStatus(task, task.status === 'Pending' ? 'In Progress' : 'Completed')}
                                 className="flex-1 bg-[#1A2232] text-yellow-400 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
                               >
                                   {task.status === 'Pending' ? 'Start Task' : 'Finish Task'}
                               </button>
                               {task.status === 'In Progress' && (
                                   <button 
                                      onClick={() => handleUpdateStatus(task, 'Pending')}
                                      className="px-4 bg-white text-gray-400 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border border-gray-200 active:scale-95"
                                   >
                                      Pause
                                   </button>
                               )}
                           </>
                       ) : (
                           <div className="w-full text-center text-green-600 font-black uppercase text-[10px] tracking-widest py-3">Task Finished</div>
                       )}
                       {currentUser.role === 'admin' && (
                           <button 
                              onClick={() => { setTaskToDelete(task); setIsConfirmDeleteOpen(true); }}
                              className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                           >
                               <TrashIcon className="w-4 h-4"/>
                           </button>
                       )}
                  </div>
              </div>
          ))}
          {filteredTasks.length === 0 && (
              <div className="col-span-full py-32 flex flex-col items-center opacity-30">
                  <TaskIcon className="w-24 h-24 text-gray-400 mb-6" />
                  <p className="text-xs font-black uppercase tracking-[0.4em] text-gray-400">Clean Slate: No production tickets</p>
              </div>
          )}
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="New Production Ticket">
          <div className="space-y-6">
              <div>
                  <label className={labelStyle}>Task Title</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className={darkInput} placeholder="e.g. Design Logo for Client" />
              </div>
              <div>
                  <label className={labelStyle}>Description / Requirements</label>
                  <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className={`${darkInput} min-h-[120px] resize-none`} placeholder="Detailed workflow..."></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className={labelStyle}>Assign Personnel</label>
                      <select value={formData.assignedTo} onChange={e => setFormData({...formData, assignedTo: e.target.value})} className={darkInput}>
                          <option value="">Choose Staff...</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className={labelStyle}>Completion Deadline</label>
                      <input type="datetime-local" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className={darkInput} />
                  </div>
              </div>
              <div>
                  <label className={labelStyle}>Link to Existing Order (Optional)</label>
                  <select value={formData.saleId} onChange={e => setFormData({...formData, saleId: e.target.value})} className={darkInput}>
                      <option value="">None</option>
                      {sales.slice(0, 10).map(s => <option key={s.id} value={s.id}>#{s.id.substring(0,8).toUpperCase()}</option>)}
                  </select>
              </div>
              <button 
                  onClick={handleSaveTask}
                  disabled={!formData.title || !formData.assignedTo || !formData.deadline}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all disabled:opacity-50"
              >
                  Authorize Task Assignment
              </button>
          </div>
      </Modal>

      <ConfirmationModal 
        isOpen={isConfirmDeleteOpen} 
        onClose={() => setIsConfirmDeleteOpen(false)} 
        onConfirm={() => taskToDelete && onDeleteTask(taskToDelete.id)} 
        title="Purge Task" 
        message="Authorize permanent removal of this workflow item? Historical records will be updated." 
      />
    </div>
  );
};

export default TasksView;
