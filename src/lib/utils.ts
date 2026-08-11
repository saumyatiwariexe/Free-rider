import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const customTwMerge = extendTailwindMerge({
   extend: {
      classGroups: {
         // Optionally extend classGroups here if needed for custom Tailwind config
      }
   }
})

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs))
}
