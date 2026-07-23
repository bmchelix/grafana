import { isRtl } from '../../utils/rtl';

/**
 * Returns whether the provided element overflows the viewport bounds
 *
 * @param element The element we want to know about
 * @param BMC Change: rtlMode When set, overrides global document RTL (use `useDirection().isRtl` from React)
 */
export const isElementOverflowing = (element: HTMLElement | null, rtlMode?: boolean) => {
  if (!element) {
    return false;
  }

  const wrapperPos = element.parentElement!.getBoundingClientRect();
  const pos = element.getBoundingClientRect();

  const rtl = rtlMode ?? isRtl();

  // BMC Change: Flip the logic for RTL
  return !rtl
    ? pos.width !== 0 && wrapperPos.right + pos.width + 10 > window.innerWidth
    : pos.width !== 0 && wrapperPos.left - pos.width - 10 < 0;
};
