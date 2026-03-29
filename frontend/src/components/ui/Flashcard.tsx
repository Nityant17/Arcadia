import styled from "styled-components";
import { Brain, Star } from "lucide-react";

interface FlashcardProps {
  question: string;
  answer: string;
  isPinned: boolean;
  onPin: () => void;
}

export function Flashcard({ question, answer, isPinned, onPin }: FlashcardProps) {
  return (
    <StyledWrapper>
      <div className="card group">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPin();
          }}
          className={`pin-button ${isPinned ? "text-yellow-400" : "text-muted-foreground"} hover:text-yellow-300 transition-colors`}
          aria-label={isPinned ? "Unpin flashcard" : "Pin flashcard"}
        >
          <Star size={18} fill={isPinned ? "currentColor" : "none"} />
        </button>

        <div className="front-content flex flex-col items-center justify-center gap-4 h-full">
          <Brain size={48} className="text-cyan-400 group-hover:scale-0 transition-all duration-500" />
          <p className="chat-multilingual-text text-foreground/90 font-medium px-4 text-center group-hover:opacity-0 transition-all duration-500">
            {question}
          </p>
        </div>

        <div className="card__content">
          <div className="flex justify-between items-start w-full shrink-0">
            <h3 className="card__title text-cyan-400">Answer</h3>
          </div>
          <p className="chat-multilingual-text card__description text-foreground/90 mt-2">{answer}</p>
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .card {
    position: relative;
    width: 320px;
    height: 220px;
    background-color: oklch(var(--card) / 0.84);
    backdrop-filter: blur(12px);
    border: 1px solid oklch(var(--border));
    border-radius: 16px;
    overflow: hidden;
    perspective: 1000px;
    transform-style: preserve-3d;
    transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  .front-content {
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .pin-button {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 3;
    background: transparent;
    border: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .card:hover {
    transform: scale(1.02);
    border-color: color-mix(in oklab, oklch(var(--arcadia-cyan)), transparent 50%);
    box-shadow: 0 0 20px rgba(6, 182, 212, 0.15);
  }

  .card__content {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 24px;
    box-sizing: border-box;
    background-color: oklch(var(--card) / 0.98);
    transform: rotateX(-90deg);
    transform-origin: bottom;
    transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex;
    flex-direction: column;
    min-height: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .card:hover .card__content {
    transform: rotateX(0deg);
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  .card__description {
    font-size: 0.9rem;
    line-height: 1.35rem;
    overflow-y: auto;
    min-height: 0;
    flex: 1;
    padding-right: 4px;
    word-break: break-word;
  }
`;
