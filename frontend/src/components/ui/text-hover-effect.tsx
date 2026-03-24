"use client";
import React, { useRef, useEffect, useId, useState } from "react";
import { motion } from "motion/react";

export const TextHoverEffect = ({
  text,
  duration,
}: {
  text: string;
  duration?: number;
  automatic?: boolean;
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const uniqueId = useId().replace(/:/g, "");
  const gradientId = `textGradient-${uniqueId}`;
  const revealMaskId = `revealMask-${uniqueId}`;
  const textMaskId = `textMask-${uniqueId}`;
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });

  useEffect(() => {
    if (svgRef.current && cursor.x !== null && cursor.y !== null) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100;
      const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100;
      setMaskPosition({
        cx: `${cxPercentage}%`,
        cy: `${cyPercentage}%`,
      });
    }
  }, [cursor]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 900 220"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      className="select-none"
    >
      <defs>
        <motion.radialGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          r="46%"
          initial={{ cx: "50%", cy: "50%" }}
          animate={maskPosition}
          transition={{ duration: duration ?? 0.12, ease: "easeOut" }}
        >
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="1" />
          <stop offset="36%" stopColor="#22d3ee" stopOpacity="1" />
          <stop offset="70%" stopColor="#60a5fa" stopOpacity="0.98" />
          <stop offset="88%" stopColor="#a855f7" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </motion.radialGradient>

        <motion.radialGradient
          id={revealMaskId}
          gradientUnits="userSpaceOnUse"
          r="48%"
          initial={{ cx: "50%", cy: "50%" }}
          animate={maskPosition}
          transition={{ duration: duration ?? 0.08, ease: "easeOut" }}

          // example for a smoother animation below

          //   transition={{
          //     type: "spring",
          //     stiffness: 300,
          //     damping: 50,
          //   }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id={textMaskId}>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`url(#${revealMaskId})`}
          />
        </mask>
      </defs>
      <motion.text
        x="50%"
        y="53%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="1"
        stroke="#93c5fd"
        className="fill-transparent font-[helvetica] font-bold"
        style={{ opacity: 0.58, fontSize: "150px" }}
        initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
        animate={{
          strokeDashoffset: 0,
          strokeDasharray: 1000,
        }}
        transition={{
          duration: 4,
          ease: "easeInOut",
        }}
      >
        {text}
      </motion.text>
      <text
        x="50%"
        y="53%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
        mask={`url(#${textMaskId})`}
        className="fill-transparent font-[helvetica] font-bold"
        style={{
          opacity: hovered ? 1 : 0,
          fontSize: "150px",
          filter: "drop-shadow(0 0 14px rgba(56,189,248,0.75))",
        }}
      >
        {text}
      </text>
    </svg>
  );
};
