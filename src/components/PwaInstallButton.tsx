import { Download } from 'lucide-react';
import { usePwaInstall } from '@/lib/usePwaInstall';

export function PwaInstallButton({ className = '' }: { className?: string }) {
  const { canShow, promptInstall } = usePwaInstall();
  if (!canShow) return null;
  return (
    <button
      onClick={promptInstall}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-espresso-700 text-sm font-medium hover:bg-amber-300 transition-colors ${className}`}
    >
      <Download className="w-4 h-4" />
      <span className="hidden sm:inline">Install App</span>
    </button>
  );
}
