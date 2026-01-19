
import React from 'react';
import { Collaborator } from '../../types';

export const AvatarGroup: React.FC<{ users: Collaborator[] }> = ({ users }) => {
  return (
    <div className="flex items-center -space-x-2">
      {users.map((user) => (
        <div
          key={user.id}
          className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold shadow-sm relative group cursor-help"
          style={{ backgroundColor: user.color, color: 'white' }}
        >
          {user.name.split(' ').map(n => n[0]).join('')}
          <div className="absolute top-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
            {user.name}
          </div>
        </div>
      ))}
      <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-white text-gray-400 text-xs hover:border-gray-400 cursor-pointer transition-colors">
        +
      </div>
    </div>
  );
};
