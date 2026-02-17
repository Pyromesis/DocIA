import { motion } from "framer-motion";
import { Layers } from "lucide-react";

interface EmptyPageProps {
  title: string;
}

export function EmptyPage({ title }: EmptyPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" as const }}
      className="flex h-full min-h-[65vh] flex-col items-center justify-center"
    >
      <motion.div
        initial={{ y: 16 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex flex-col items-center text-center"
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cream-100 border border-stone-200/50"
          style={{ boxShadow: "0 2px 8px rgba(42, 37, 32, 0.04)" }}
        >
          <Layers className="h-7 w-7 text-stone-400" />
        </div>
        <h2 className="mt-5 text-[17px] font-semibold text-stone-700">{title}</h2>
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-stone-400">
          This module is under development. It will be available in an upcoming release.
        </p>
        <div className="mt-6">
          <span className="rounded-full border border-stone-200/60 bg-cream-50 px-4 py-2 text-[11px] font-medium text-stone-500">
            Coming Soon
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
