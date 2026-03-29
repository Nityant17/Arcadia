"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme = "dark" } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-popover-foreground group-[.toaster]:border-border/70 group-[.toaster]:shadow-[0_0_30px_rgba(2,6,23,0.20)] dark:group-[.toaster]:shadow-[0_0_30px_rgba(0,0,0,0.6)] rounded-xl border p-4",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-accent group-[.toast]:text-accent-foreground font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: 
            "group-[.toaster]:bg-red-100 group-[.toaster]:text-red-700 group-[.toaster]:border-red-300 dark:group-[.toaster]:bg-red-950/90 dark:group-[.toaster]:text-red-200 dark:group-[.toaster]:border-red-500/30",
          success: 
            "group-[.toaster]:bg-emerald-100 group-[.toaster]:text-emerald-700 group-[.toaster]:border-emerald-300 dark:group-[.toaster]:bg-emerald-950/90 dark:group-[.toaster]:text-emerald-200 dark:group-[.toaster]:border-emerald-500/30",
          warning:
            "group-[.toaster]:bg-yellow-100 group-[.toaster]:text-yellow-800 group-[.toaster]:border-yellow-300 dark:group-[.toaster]:bg-yellow-950/90 dark:group-[.toaster]:text-yellow-200 dark:group-[.toaster]:border-yellow-500/30",
          info:
            "group-[.toaster]:bg-blue-100 group-[.toaster]:text-blue-700 group-[.toaster]:border-blue-300 dark:group-[.toaster]:bg-blue-950/90 dark:group-[.toaster]:text-blue-200 dark:group-[.toaster]:border-blue-500/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
