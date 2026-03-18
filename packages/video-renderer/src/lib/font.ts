import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '600', '700'],
  subsets: ['latin'],
});

export const videoFontFamily = fontFamily;
