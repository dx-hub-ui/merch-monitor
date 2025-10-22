"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";

export interface BsrSliderProps {
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function BsrSlider({ value, onValueChange, min = 1, max = 500000, step = 1 }: BsrSliderProps) {
  const handleChange = (next: number[]) => {
    if (next.length < 2) return;
    const [nextMin, nextMax] = next;
    const clampedMin = Math.max(min, Math.min(nextMin, nextMax));
    const clampedMax = Math.min(max, Math.max(nextMin, nextMax));
    onValueChange([clampedMin, clampedMax]);
  };

  return (
    <SliderPrimitive.Root
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={handleChange}
      className="relative flex h-6 w-full touch-none select-none items-center"
      aria-label="Best Sellers Rank range"
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-slate-200 dark:bg-slate-800">
        <SliderPrimitive.Range className="absolute h-1.5 rounded-full bg-brand" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block h-4 w-4 rounded-full border border-white bg-brand shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 dark:border-slate-900"
        aria-label="Minimum Best Sellers Rank"
      />
      <SliderPrimitive.Thumb
        className="block h-4 w-4 rounded-full border border-white bg-brand shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 dark:border-slate-900"
        aria-label="Maximum Best Sellers Rank"
      />
    </SliderPrimitive.Root>
  );
}
