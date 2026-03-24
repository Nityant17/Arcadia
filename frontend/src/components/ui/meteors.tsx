"use client";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import React, { useMemo } from "react";

export const Meteors = ({
  number,
  className,
}: {
  number?: number;
  className?: string;
}) => {
  const meteorCount = number || 20;
  const meteors = useMemo(
    () =>
      new Array(meteorCount).fill(true).map(() => ({
        horizontalPosition: Math.random() * 120 - 10,
        verticalPosition: Math.random() * 120 - 10,
        animationDelay: Math.random() * 8,
        animationDuration: Math.floor(Math.random() * 4) + 6,
      })),
    [meteorCount],
  );

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {meteors.map((meteor, idx) => {
        return (
          <span
            key={"meteor" + idx}
            className={cn(
              "animate-meteor-effect absolute h-0.5 w-0.5 rotate-[215deg] rounded-[9999px] bg-cyan-200/90 shadow-[0_0_0_1px_#ffffff30]",
              "before:absolute before:top-1/2 before:h-[1px] before:w-[72px] before:-translate-y-[50%] before:transform before:bg-gradient-to-r before:from-cyan-100 before:to-transparent before:content-['']",
              className,
            )}
            style={{
              top: `${meteor.verticalPosition}%`,
              left: `${meteor.horizontalPosition}%`,
              animationDelay: `${meteor.animationDelay}s`,
              animationDuration: `${meteor.animationDuration}s`,
              willChange: "transform, opacity",
            }}
          ></span>
        );
      })}
    </motion.div>
  );
};
