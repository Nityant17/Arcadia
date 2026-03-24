import { BackgroundBeams } from "@/components/ui/background-beams";
import { CanvasText } from "@/components/ui/canvas-text";
import { AnimatedActionText } from "@/components/ui/AnimatedActionText";

export function ArcadiaHero() {
  return (
    <section className="h-[28rem] w-full rounded-2xl relative flex flex-col items-center justify-center overflow-hidden mb-6">
      <BackgroundBeams className="z-0" />

      <div className="relative z-10 flex flex-col items-center pointer-events-none px-4 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white">
          Master every topic at{" "}
          <CanvasText
            text="Lightning Speed"
            backgroundClassName="bg-cyan-500/10"
            colors={["rgba(6,182,212,1)", "rgba(59,130,246,0.8)"]}
            className="align-middle"
          />
        </h1>

        <div className="mt-4 md:mt-6">
          <AnimatedActionText />
        </div>
      </div>
    </section>
  );
}
