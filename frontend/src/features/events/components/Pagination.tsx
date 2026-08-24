import React from 'react';

interface PaginationProps {
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ meta, onPageChange }) => {
  if (!meta || meta.totalPages <= 1) {
    return null;
  }

  const { page, totalPages, total } = meta;

  return (
    <div className="flex items-center justify-between pt-4 border-t border-zinc-800 font-mono text-xs text-zinc-400">
      <div>
        Showing page <span className="text-zinc-100 font-bold">{page}</span> of{' '}
        <span className="text-zinc-100 font-bold">{totalPages}</span> ({total} total events)
      </div>

      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-sm disabled:opacity-30 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-300 uppercase font-bold transition-colors"
        >
          ← Prev
        </button>

        <span className="px-2 py-1 bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-sm">
          {page}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-sm disabled:opacity-30 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-300 uppercase font-bold transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default Pagination;
