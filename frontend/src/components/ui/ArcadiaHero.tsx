import { BackgroundBeams } from "@/components/ui/background-beams";
import { CanvasText } from "@/components/ui/canvas-text";
import { AnimatedActionText } from "@/components/ui/AnimatedActionText";
import { SparklesCore } from "@/components/ui/sparkles";

export function ArcadiaHero() {
  return (
    <section className="h-[28rem] w-full rounded-2xl relative flex flex-col items-center justify-center overflow-hidden mb-6">
      <BackgroundBeams className="z-0" />

      <div className="relative z-10 flex flex-col items-center pointer-events-none px-4 text-center">
        <div className="w-full flex flex-col items-center justify-center mb-4">
          <h1 className="text-5xl md:text-7xl font-bold text-center text-foreground/45 dark:text-white relative z-20 tracking-[0.2em] uppercase">
            Arcadia
          </h1>
          <div className="w-full max-w-[40rem] h-20 md:h-28 relative">
            <div className="absolute inset-x-10 md:inset-x-20 top-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent h-[2px] w-3/4 blur-sm" />
            <div className="absolute inset-x-10 md:inset-x-20 top-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent h-px w-3/4" />
            <div className="absolute inset-x-20 md:inset-x-60 top-0 bg-gradient-to-r from-transparent via-purple-500 to-transparent h-[5px] w-1/4 blur-sm" />
            <div className="absolute inset-x-20 md:inset-x-60 top-0 bg-gradient-to-r from-transparent via-purple-500 to-transparent h-px w-1/4" />

            <div
              className="absolute inset-0 w-full h-full"
              style={{
                maskImage: "radial-gradient(350px 200px at top, white, transparent)",
                WebkitMaskImage:
                  "radial-gradient(350px 200px at top, white, transparent)",
              }}
            >
              <SparklesCore
                background="transparent"
                minSize={0.4}
                maxSize={1.2}
                particleDensity={800}
                className="w-full h-full"
                particleColor="#06b6d4"
              />
            </div>
          </div>
        </div>

        <h1 className="text-2xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
          <span className="text-foreground/70 dark:text-neutral-400">Master every topic at </span>
          <CanvasText
            text="Lightning Speed"
            backgroundClassName="bg-cyan-100 dark:bg-cyan-200"
            colors={[
              "var(--color-cyan-300)",
              "var(--color-sky-300)",
              "var(--color-blue-300)",
              "var(--color-violet-300)",
            ]}
            animationDuration={4.5}
            lineWidth={2.2}
            lineGap={9}
            curveIntensity={52}
            className="align-middle [filter:drop-shadow(0_0_14px_rgba(34,211,238,0.65))]"
          />
        </h1>

        <div className="mt-4 md:mt-6">
          <AnimatedActionText />
        </div>
      </div>
    </section>
  );
}
