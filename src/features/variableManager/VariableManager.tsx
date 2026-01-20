/**
 * VariableManager Component
 * 
 * The "Data Gardening" spoke in the hub-and-spoke architecture.
 * Full-screen overlay for organizing and managing variables.
 * 
 * This is the skeleton implementation - future milestones will add:
 * - Card sorting (Milestone 2.2)
 * - Visual recoding (Milestone 2.2)
 * - Miller columns navigation
 * - Sparkline previews
 */

import React from 'react';
import { X, Search, Grid3X3, List, Layers, Tag, BarChart2 } from 'lucide-react';
import { useVelocityStore } from '../../store';

interface VariableManagerProps {
    onClose: () => void;
}

export const VariableManager: React.FC<VariableManagerProps> = ({ onClose }) => {
    const { dataset, variableSets, searchQuery, setSearchQuery } = useVelocityStore();

    const [viewStyle, setViewStyle] = React.useState<'grid' | 'list'>('grid');

    const filteredSets = variableSets.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group variables by type for quick stats
    const typeStats = React.useMemo(() => {
        const stats = { nominal: 0, ordinal: 0, scale: 0 };
        variableSets.forEach(vs => {
            if (vs.type && vs.type in stats) {
                stats[vs.type as keyof typeof stats]++;
            }
        });
        return stats;
    }, [variableSets]);

    return (
        <div className="h-full bg-white flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-600" />
                        <h1 className="text-lg font-semibold text-gray-900">Variable Manager</h1>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-3 text-xs text-gray-500 ml-4">
                        <span className="flex items-center gap-1">
                            <Tag size={12} className="text-rose-500" />
                            {typeStats.nominal} Categorical
                        </span>
                        <span className="flex items-center gap-1">
                            <BarChart2 size={12} className="text-blue-500" />
                            {typeStats.scale} Numeric
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>{variableSets.length} total</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewStyle('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewStyle === 'grid'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <Grid3X3 size={16} />
                        </button>
                        <button
                            onClick={() => setViewStyle('list')}
                            className={`p-1.5 rounded-md transition-all ${viewStyle === 'list'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <List size={16} />
                        </button>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </header>

            {/* Search Bar */}
            <div className="px-6 py-4 border-b border-gray-100 bg-white">
                <div className="relative max-w-xl">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search variables..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 focus:bg-white transition-all outline-none"
                    />
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-6">
                {viewStyle === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {filteredSets.map((vs) => (
                            <VariableCard key={vs.id} variableSet={vs} />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2 max-w-4xl">
                        {filteredSets.map((vs) => (
                            <VariableRow key={vs.id} variableSet={vs} />
                        ))}
                    </div>
                )}

                {filteredSets.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <Layers size={48} className="opacity-20 mb-4" />
                        <p className="text-sm font-medium">No variables found</p>
                        {searchQuery && (
                            <p className="text-xs mt-1">Try adjusting your search</p>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
                <span>
                    {dataset?.name} • {dataset?.rowCount.toLocaleString()} rows
                </span>
                <span className="text-gray-400">
                    Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">D</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Esc</kbd> to close
                </span>
            </footer>
        </div>
    );
};

/**
 * Variable Card for Grid View
 */
interface VariableCardProps {
    variableSet: {
        id: string;
        name: string;
        type?: 'nominal' | 'ordinal' | 'scale';
        structure: 'single' | 'multi' | 'grid';
    };
}

const VariableCard: React.FC<VariableCardProps> = ({ variableSet }) => {
    const typeColors = {
        nominal: 'bg-rose-50 border-rose-200 text-rose-700',
        ordinal: 'bg-amber-50 border-amber-200 text-amber-700',
        scale: 'bg-blue-50 border-blue-200 text-blue-700',
    };

    const typeColor = variableSet.type
        ? typeColors[variableSet.type]
        : 'bg-gray-50 border-gray-200 text-gray-600';

    return (
        <div
            className={`
                p-4 rounded-lg border-2 cursor-pointer
                hover:shadow-md hover:border-indigo-300 transition-all
                ${typeColor}
            `}
        >
            <div className="text-xs font-medium uppercase tracking-wider opacity-60 mb-1">
                {variableSet.type || 'unknown'}
            </div>
            <div className="font-medium text-sm truncate" title={variableSet.name}>
                {variableSet.name}
            </div>
            {variableSet.structure !== 'single' && (
                <div className="text-xs mt-2 opacity-60">
                    {variableSet.structure === 'multi' ? 'Multiple response' : 'Grid'}
                </div>
            )}
        </div>
    );
};

/**
 * Variable Row for List View
 */
const VariableRow: React.FC<VariableCardProps> = ({ variableSet }) => {
    const typeColors = {
        nominal: 'text-rose-600 bg-rose-50',
        ordinal: 'text-amber-600 bg-amber-50',
        scale: 'text-blue-600 bg-blue-50',
    };

    const typeColor = variableSet.type
        ? typeColors[variableSet.type]
        : 'text-gray-600 bg-gray-50';

    return (
        <div className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer transition-all">
            <span className={`text-xs font-medium px-2 py-1 rounded ${typeColor}`}>
                {variableSet.type || 'unknown'}
            </span>
            <span className="flex-1 font-medium text-sm text-gray-800 truncate">
                {variableSet.name}
            </span>
            {variableSet.structure !== 'single' && (
                <span className="text-xs text-gray-400">
                    {variableSet.structure === 'multi' ? 'Multi' : 'Grid'}
                </span>
            )}
        </div>
    );
};
