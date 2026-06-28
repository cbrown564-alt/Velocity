import React from 'react';
import { Collaborator } from '../../types';

export const AvatarGroup: React.FC<{ users: Collaborator[] }> = ({ users }) => {
  return (
    <div className="flex items-center -space-x-2 font-body">
      {users.map((user) => (
        <div
          key={user.id}
          className="w-8 h-8 rounded-full border-2 border-[var(--bg-panel)] bg-[var(--border-color)] flex items-center justify-center text-[10px] font-bold shadow-sm relative group cursor-help"
          style={{ backgroundColor: user.color, color: 'white' }}
        >
          {user.name
            .split(' ')
            .map((n) => n[0])
            .join('')}
          <div className="absolute top-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--text-primary)] text-[var(--text-inverse)] text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
            {user.name}
          </div>
        </div>
      ))}
      <div className="w-8 h-8 rounded-full border-2 border-dashed border-[var(--border-color-muted)] flex items-center justify-center bg-[var(--bg-panel)] text-[var(--text-tertiary)] text-xs hover:border-[var(--text-tertiary)] cursor-pointer transition-colors">
        +
      </div>
    </div>
  );
};
