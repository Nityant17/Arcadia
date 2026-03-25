"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          // Base styling for all toasts (frosted glass, dark background, borders)
          toast:
            "group toast group-[.toaster]:bg-slate-950/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-slate-100 group-[.toaster]:border-white/10 group-[.toaster]:shadow-[0_0_30px_rgba(0,0,0,0.6)] rounded-xl border p-4",
          description: "group-[.toast]:text-slate-400",
          actionButton:
            "group-[.toast]:bg-cyan-500 group-[.toast]:text-cyan-950 font-medium",
          cancelButton:
            "group-[.toast]:bg-white/10 group-[.toast]:text-slate-300",
          
          // Specific colored states
          error: 
            "group-[.toaster]:bg-red-950/90 group-[.toaster]:text-red-200 group-[.toaster]:border-red-500/30",
          success: 
            "group-[.toaster]:bg-emerald-950/90 group-[.toaster]:text-emerald-200 group-[.toaster]:border-emerald-500/30",
          warning:
            "group-[.toaster]:bg-yellow-950/90 group-[.toaster]:text-yellow-200 group-[.toaster]:border-yellow-500/30",
          info:
            "group-[.toaster]:bg-blue-950/90 group-[.toaster]:text-blue-200 group-[.toaster]:border-blue-500/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };