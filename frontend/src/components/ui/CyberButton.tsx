import React from 'react';
import styled from 'styled-components';

interface CyberButtonProps {
  text?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const CyberButton = ({ text = 'START QUIZ', onClick, disabled = false }: CyberButtonProps) => {
  return (
    <StyledWrapper className="w-full flex justify-center py-4">
      <button className="button" data-text={text} onClick={onClick} disabled={disabled}>
        <span className="actual-text">&nbsp;{text}&nbsp;</span>
        <span className="hover-text" aria-hidden="true">&nbsp;{text}&nbsp;</span>
      </button>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .button {
    margin: 0;
    height: auto;
    background: transparent;
    padding: 0;
    border: none;
    cursor: pointer;
    --border-right: 6px;
    --text-stroke-color: oklch(var(--foreground) / 0.35);
    --animation-color: oklch(var(--arcadia-teal));
    --fs-size: 2rem;
    letter-spacing: 4px;
    text-decoration: none;
    font-size: var(--fs-size);
    font-family: inherit;
    font-weight: 800;
    position: relative;
    text-transform: uppercase;
    color: transparent;
    -webkit-text-stroke: 1px var(--text-stroke-color);
    transition: transform 0.2s ease;
  }

  .button:active {
    transform: scale(0.95);
  }

  .button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .hover-text {
    position: absolute;
    box-sizing: border-box;
    content: attr(data-text);
    color: var(--animation-color);
    width: 0%;
    inset: 0;
    border-right: var(--border-right) solid var(--animation-color);
    overflow: hidden;
    transition: 0.5s cubic-bezier(0.25, 1, 0.5, 1);
    -webkit-text-stroke: 1px var(--animation-color);
    white-space: nowrap;
  }

  .button:hover .hover-text {
    width: 100%;
    filter: drop-shadow(0 0 20px rgba(6, 182, 212, 0.8));
  }

  .button:disabled .hover-text {
    width: 0%;
    filter: none;
  }
`;
