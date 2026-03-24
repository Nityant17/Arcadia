import styled from "styled-components";
import { Paperclip, Send } from "lucide-react";

interface GlowingChatInputProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
}

export function GlowingChatInput({ value, onChange, onSubmit }: GlowingChatInputProps) {
  return (
    <StyledWrapper className="w-full max-w-3xl mx-auto">
      <div id="poda" className="w-full relative">
        <div className="glow" />
        <div className="darkBorderBg" />
        <div className="darkBorderBg" />
        <div className="darkBorderBg" />
        <div className="white" />
        <div className="border" />

        <div id="main" className="w-full relative flex items-center">
          <input
            type="text"
            placeholder="Ask Arcadia anything..."
            className="input w-full"
            value={value}
            onChange={onChange}
            onKeyDown={(event) => event.key === "Enter" && onSubmit()}
            data-ocid="chat.input"
          />
          <button
            type="button"
            className="absolute right-3 p-2 text-arcadia-teal hover:text-foreground transition-colors z-10"
            onClick={onSubmit}
            data-ocid="chat.send.button"
          >
            <Send size={20} />
          </button>
          <button
            type="button"
            className="absolute right-12 p-2 text-muted-foreground hover:text-foreground transition-colors z-10"
          >
            <Paperclip size={20} />
          </button>
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  #poda {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 60px;
  }

  .input {
    border: 1px solid oklch(var(--arcadia-border));
    background: oklch(var(--background) / 0.85);
    color: oklch(var(--foreground));
    height: 56px;
    border-radius: 12px;
    padding-inline: 20px;
    padding-right: 90px;
    font-size: 16px;
    z-index: 2;
  }

  .input::placeholder {
    color: oklch(var(--muted-foreground));
  }

  .input:focus {
    outline: none;
  }

  .white,
  .border,
  .darkBorderBg,
  .glow {
    position: absolute;
    overflow: hidden;
    z-index: 0;
    border-radius: 14px;
    filter: blur(3px);
    width: 100%;
    height: 100%;
  }

  .white::before {
    content: "";
    z-index: -2;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(83deg);
    position: absolute;
    width: 1600px;
    height: 1600px;
    background-repeat: no-repeat;
    background-image: conic-gradient(
      rgba(0, 0, 0, 0) 0%,
      oklch(var(--arcadia-cyan)),
      rgba(0, 0, 0, 0) 10%,
      rgba(0, 0, 0, 0) 50%,
      oklch(var(--arcadia-purple)),
      rgba(0, 0, 0, 0) 60%
    );
    transition: all 2s;
  }

  .border::before {
    content: "";
    z-index: -2;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(70deg);
    position: absolute;
    width: 1600px;
    height: 1600px;
    background-repeat: no-repeat;
    background-image: conic-gradient(
      oklch(var(--background)),
      oklch(var(--arcadia-teal)) 5%,
      oklch(var(--background)) 14%,
      oklch(var(--background)) 50%,
      oklch(var(--arcadia-purple)) 60%,
      oklch(var(--background)) 64%
    );
    transition: all 2s;
  }

  .darkBorderBg::before {
    content: "";
    z-index: -2;
    text-align: center;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(82deg);
    position: absolute;
    width: 2000px;
    height: 2000px;
    background-repeat: no-repeat;
    background-image: conic-gradient(
      rgba(0, 0, 0, 0),
      oklch(var(--arcadia-teal)),
      rgba(0, 0, 0, 0) 10%,
      rgba(0, 0, 0, 0) 50%,
      oklch(var(--arcadia-purple)),
      rgba(0, 0, 0, 0) 60%
    );
    transition: all 2s;
  }

  #poda:focus-within > .darkBorderBg::before {
    transform: translate(-50%, -50%) rotate(442deg);
    transition: all 4s;
  }

  #poda:hover > .darkBorderBg::before {
    transform: translate(-50%, -50%) rotate(-98deg);
  }

  .glow {
    filter: blur(25px);
    opacity: 0.5;
  }

  .glow:before {
    content: "";
    z-index: -2;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(60deg);
    position: absolute;
    width: 2000px;
    height: 2000px;
    background-image: conic-gradient(
      oklch(var(--background)),
      oklch(var(--arcadia-teal)) 5%,
      oklch(var(--background)) 38%,
      oklch(var(--background)) 50%,
      oklch(var(--arcadia-purple)) 60%,
      oklch(var(--background)) 87%
    );
    transition: all 2s;
  }

  #poda:focus-within > .glow::before {
    transform: translate(-50%, -50%) rotate(420deg);
    transition: all 4s;
  }

  #poda:hover > .glow::before {
    transform: translate(-50%, -50%) rotate(-120deg);
  }

  #poda:hover > .white::before {
    transform: translate(-50%, -50%) rotate(-97deg);
  }

  #poda:hover > .border::before {
    transform: translate(-50%, -50%) rotate(-110deg);
  }

  #poda:focus-within > .white::before {
    transform: translate(-50%, -50%) rotate(443deg);
    transition: all 4s;
  }

  #poda:focus-within > .border::before {
    transform: translate(-50%, -50%) rotate(430deg);
    transition: all 4s;
  }
`;
