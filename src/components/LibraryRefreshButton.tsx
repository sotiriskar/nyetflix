'use client';

import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';

export interface LibraryRefreshButtonProps {
  onRefresh: () => void;
  loading: boolean;
  visible: boolean;
}

export function LibraryRefreshButton({ onRefresh, loading, visible }: LibraryRefreshButtonProps) {
  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => onRefresh()}
        disabled={loading}
        className="fixed bottom-8 right-8 z-40 p-3 rounded-full bg-white/10 text-white opacity-40 hover:opacity-100 hover:bg-white/25 hover:scale-110 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#141414] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Scan library and refresh data"
        title="Click to scan your library folder and refresh data"
      >
        <RefreshOutlined sx={{ fontSize: 28 }} />
      </button>
      <Snackbar
        open={loading}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Scanning library…
        </Alert>
      </Snackbar>
    </>
  );
}
