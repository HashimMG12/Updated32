import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

/**
 * Global responsive helpers: design pixels → wp/hp
 *
 * Usage: use pixel values from your design (Figma, etc.) directly.
 * - rw(150) → width/margin-h/padding-h from design width
 * - rh(80) → height/margin-v/padding-v from design height
 *
 * Set DESIGN_BASE to your design canvas size (e.g. 375x812).
 */
export const DESIGN_BASE = {
  width: 375,
  height: 812,
};

/**
 * Convert design width in pixels to responsive width (equivalent to wp).
 * Use for: width, marginHorizontal, paddingHorizontal, left, right, etc.
 * @param px - Pixel value from your design
 * @returns Responsive dimension (scales with screen width)
 */
export const rw = (px: number): number => {
  const percent = (px / DESIGN_BASE.width) * 100;
  return wp(percent);
};

/**
 * Convert design height in pixels to responsive height (equivalent to hp).
 * Use for: height, marginVertical, paddingVertical, top, bottom, fontSize, etc.
 * @param px - Pixel value from your design
 * @returns Responsive dimension (scales with screen height)
 */
export const rh = (px: number): number => {
  const percent = (px / DESIGN_BASE.height) * 100;
  return hp(percent);
};
