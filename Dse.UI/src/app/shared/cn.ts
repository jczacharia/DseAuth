import clsx, {type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';

/**
 * `clsx` + `tailwind-merge` in one call.
 *
 * @remarks
 * `cn` stands for "class name"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
