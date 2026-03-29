import React from 'react';
import styled from 'styled-components';

export const AnimatedActionText = () => {
  return (
    <Wrapper>
      <div className="loader">
        <p className="text-foreground/70">Turn notes into</p>
        <div className="words">
          <span className="word">Answers</span>
          <span className="word">Quizzes</span>
          <span className="word">Flashcards</span>
          <span className="word">Cheatsheets</span>
          <span className="word">Answers</span>
        </div>
      </div>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  .loader {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-weight: 600;
    font-size: 1.5rem;
    box-sizing: content-box;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .words {
    overflow: hidden;
    position: relative;
    height: 100%;
    margin-left: 10px;
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
  }
  .word {
    display: block;
    height: 100%;
    color: #06b6d4; /* Arcadia Cyan */
    animation: spin_words 6s infinite cubic-bezier(0.4, 0, 0.2, 1);
  }
  @keyframes spin_words {
    10% { transform: translateY(-102%); }
    25% { transform: translateY(-100%); }
    35% { transform: translateY(-202%); }
    50% { transform: translateY(-200%); }
    60% { transform: translateY(-302%); }
    75% { transform: translateY(-300%); }
    85% { transform: translateY(-402%); }
    100% { transform: translateY(-400%); }
  }
  @media (min-width: 768px) {
    .loader { font-size: 2.5rem; height: 60px; }
  }
`;
