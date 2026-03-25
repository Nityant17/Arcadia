import React from 'react';
import styled from 'styled-components';
import {
  BarChart3,
  BookOpen,
  CloudUpload,
  Brain,
  MessageSquare,
  Swords,
  Calendar,
  Code2,
  NotebookPen,
} from 'lucide-react';

export type QuickToolId =
  | 'ask'
  | 'upload'
  | 'quiz'
  | 'study'
  | 'planner'
  | 'challenge'
  | 'dashboard'
  | 'notes'
  | 'code';

interface QuickToolsGridProps {
  onToolClick?: (toolId: QuickToolId) => void;
  disabled?: boolean;
}

const toolItems: Array<{ id: QuickToolId; label: string; icon: React.ReactNode }> = [
  { id: 'ask', label: 'Ask AI', icon: <MessageSquare className="tool-icon" size={22} /> },
  { id: 'upload', label: 'Upload Note', icon: <CloudUpload className="tool-icon" size={22} /> },
  { id: 'quiz', label: 'Quick Quiz', icon: <Brain className="tool-icon" size={22} /> },
  { id: 'study', label: 'Study', icon: <BookOpen className="tool-icon" size={22} /> },
  { id: 'notes', label: 'Notes', icon: <NotebookPen className="tool-icon" size={22} /> },
  { id: 'challenge', label: 'Challenge', icon: <Swords className="tool-icon" size={22} /> },
  { id: 'planner', label: 'Planner', icon: <Calendar className="tool-icon" size={22} /> },
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="tool-icon" size={22} /> },
  { id: 'code', label: 'Code Lab', icon: <Code2 className="tool-icon" size={22} /> },
];

export const QuickToolsGrid = ({ onToolClick, disabled = false }: QuickToolsGridProps) => {
  return (
    <StyledWrapper>
      <div className="main">
        {toolItems.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className="card"
            data-label={tool.label}
            aria-label={tool.label}
            disabled={disabled}
            onClick={() => onToolClick?.(tool.id)}
          >
            {tool.icon}
          </button>
        ))}
        <p className="text">QUICK<br /><br />TOOLS</p>
        <div className="main_back" />
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;

  .main_back {
    position: absolute;
    border-radius: 12px;
    inset: 8px;
    background: linear-gradient(160deg, rgba(6, 182, 212, 0.52), rgba(59, 130, 246, 0.48), rgba(99, 102, 241, 0.45));
    z-index: 3;
    box-shadow:
      inset 0 0 38px rgba(2, 6, 23, 0.75),
      0 0 22px rgba(6, 182, 212, 0.2);
    pointer-events: none;
    transform: scale(0.96);
    transition: opacity 0.4s ease-in-out, transform 0.4s ease-in-out;
  }

  .main {
    display: flex;
    flex-wrap: wrap;
    width: 192px;
    height: 192px;
    align-items: center;
    align-content: center;
    justify-content: center;
    z-index: 1;
    position: relative;
    border-radius: 12px;
    overflow: visible;
  }

  .card {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    position: relative;
    border-radius: 10px;
    background: transparent;
    backdrop-filter: none;
    border: 1px solid transparent;
    transition: 0.4s ease-in-out, 0.2s background-color ease-in-out, 0.2s box-shadow ease-in-out;
    cursor: pointer;
    outline: none;
    margin: 0;
  }

  .card:nth-child(1) {
    border-top-left-radius: 12px;
  }

  .card:nth-child(3) {
    border-top-right-radius: 12px;
  }

  .card:nth-child(7) {
    border-bottom-left-radius: 12px;
  }

  .card:nth-child(9) {
    border-bottom-right-radius: 12px;
  }

  .tool-icon {
    opacity: 0;
    transform: scale(0.85);
    transition: 0.25s ease-in-out;
    color: #94a3b8;
  }

  .main:hover .main_back {
    transform: scale(1.03);
    opacity: 0;
  }

  .main:hover .card {
    margin: 0.2em;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .main:hover .text {
    opacity: 0;
    z-index: -1;
  }

  .main:hover .tool-icon {
    opacity: 1;
    transform: scale(1);
  }

  .card:nth-child(1):hover {
    background-color: #06b6d4;
    box-shadow: 0 0 18px rgba(6, 182, 212, 0.45);
  }

  .card:nth-child(2):hover {
    background-color: #3b82f6;
    box-shadow: 0 0 18px rgba(59, 130, 246, 0.45);
  }

  .card:nth-child(3):hover {
    background-color: #6366f1;
    box-shadow: 0 0 18px rgba(99, 102, 241, 0.45);
  }

  .card:nth-child(4):hover {
    background-color: #0ea5e9;
    box-shadow: 0 0 18px rgba(14, 165, 233, 0.45);
  }

  .card:nth-child(5):hover {
    background-color: #2563eb;
    box-shadow: 0 0 18px rgba(37, 99, 235, 0.45);
  }

  .card:nth-child(6):hover {
    background-color: #7c3aed;
    box-shadow: 0 0 18px rgba(124, 58, 237, 0.45);
  }

  .card:nth-child(7):hover {
    background-color: #14b8a6;
    box-shadow: 0 0 18px rgba(20, 184, 166, 0.45);
  }

  .card:nth-child(8):hover {
    background-color: #0ea5e9;
    box-shadow: 0 0 18px rgba(14, 165, 233, 0.45);
  }

  .card:nth-child(9):hover {
    background-color: #06b6d4;
    box-shadow: 0 0 18px rgba(6, 182, 212, 0.45);
  }

  .card:hover,
  .card:focus-visible {
    transform: scale(1.05);
    border-color: rgba(255, 255, 255, 0.35);
    z-index: 4;
  }

  .card:hover .tool-icon,
  .card:focus-visible .tool-icon {
    color: white;
  }

  .card::after {
    content: attr(data-label);
    position: absolute;
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%) translateX(-4px);
    opacity: 0;
    pointer-events: none;
    padding: 0.22rem 0.5rem;
    border-radius: 6px;
    white-space: nowrap;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #e2e8f0;
    border: 1px solid rgba(6, 182, 212, 0.35);
    background: rgba(2, 6, 23, 0.92);
    transition: opacity 0.18s ease, transform 0.18s ease;
  }

  .card:nth-child(3n)::after {
    left: auto;
    right: calc(100% + 8px);
    transform: translateY(-50%) translateX(4px);
  }

  .card:hover::after,
  .card:focus-visible::after {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }

  .card:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.76em;
    transition: 0.4s ease-in-out;
    color: #e2e8f0;
    text-align: center;
    font-weight: 700;
    letter-spacing: 0.28em;
    z-index: 4;
    text-shadow: 0 0 10px rgba(14, 165, 233, 0.45);
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .card,
    .tool-icon,
    .text,
    .main_back,
    .card::after {
      transition: none;
    }
  }
`;
